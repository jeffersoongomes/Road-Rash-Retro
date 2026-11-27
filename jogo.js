const canvas = document.getElementById("jogo");
const ctx = canvas.getContext("2d");

// Áudio retrô via Web Audio API (sem arquivos externos)
let audioCtx = null;
let somAtivo = true;
let ultimoSomMotor = 0;

function garantirAudio() {
  if (!somAtivo) return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function tocarBip(freqInicial, freqFinal, duracao, tipo = "square", volume = 0.06) {
  const ctxAudio = garantirAudio();
  if (!ctxAudio) return;

  const agora = ctxAudio.currentTime;
  const osc = ctxAudio.createOscillator();
  const gain = ctxAudio.createGain();

  osc.type = tipo;
  osc.frequency.setValueAtTime(freqInicial, agora);
  if (freqFinal !== freqInicial) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqFinal), agora + duracao);
  }

  gain.gain.setValueAtTime(volume, agora);
  gain.gain.exponentialRampToValueAtTime(0.0008, agora + duracao);

  osc.connect(gain);
  gain.connect(ctxAudio.destination);

  osc.start(agora);
  osc.stop(agora + duracao);
}

function tocarRuido(duracao, volume = 0.08) {
  const ctxAudio = garantirAudio();
  if (!ctxAudio) return;

  const bufferSize = Math.floor(ctxAudio.sampleRate * duracao);
  const buffer = ctxAudio.createBuffer(1, bufferSize, ctxAudio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctxAudio.createBufferSource();
  noise.buffer = buffer;

  const gain = ctxAudio.createGain();
  gain.gain.setValueAtTime(volume, ctxAudio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctxAudio.currentTime + duracao);

  noise.connect(gain);
  gain.connect(ctxAudio.destination);

  noise.start();
  noise.stop(ctxAudio.currentTime + duracao);
}

function atualizarSomMotor(agoraMs) {
  if (!somAtivo || corridaEncerrada) return;
  const intervalo = Math.max(42, 145 - velocidade * 24);
  if (agoraMs - ultimoSomMotor >= intervalo) {
    ultimoSomMotor = agoraMs;
    const freqBase = estadoJogador === "caindo" ? 55 : 66 + velocidade * 28;
    tocarBip(freqBase, freqBase * 0.85, 0.042, "sawtooth", 0.025);
  }
}

// Estado da moto e do piloto
let deslocamento = 0;
let velocidade = 1.5;
const velocidadeMin = 0.25;
const velocidadeMax = 3.8;

let motoX = 400;
const motoY = 425;
let alturaSalto = 0;
let velVerticalSalto = 0;
let inclinacao = 0;
let energiaJogador = 100;
let tempoInvencivel = 0;
let estadoJogador = "correndo"; // "correndo" | "caindo" | "levantando"
let timerEstadoJogador = 0;
let velocidadeDeslize = 0;

// Combate, corrente e grana
let temCorrente = false;
let animacaoGolpe = 0;
let tipoGolpe = null;
let ladoGolpe = 1;
let dinheiro = 0;
let rivaisDerrubados = 0;
let msgCombate = "";
let timerMsgCombate = 0;
let motivoEncerramento = "META"; // "META" | "PRESO" | "QUEDA_TOTAL"

// Distância da corrida (55 KM)
let distanciaKm = 0;
const distanciaMetaKm = 55;
let corridaEncerrada = false;
let tempoSegundos = 0;

// Variáveis das curvas e morros (relevo) da pista
let curvaAtual = 0;
let curvaAlvo = 0;
let elevacaoAtual = 0;
let elevacaoAlvo = 0;
let distanciaSegmento = 0;
let proximoTrecho = 620;
let centroPistaNaMoto = 400;

// Objetos laterais (árvores e placas) em profundidade
const profundidadeMax = 700;
const objetosLateral = [];

function criarObjetoLateral(zInicial = 1) {
  const lado = Math.random() < 0.5 ? -1 : 1;
  const tipo = Math.random() < 0.72 ? "arvore" : "placa";
  const distanciaFora = 1.18 + Math.random() * 0.65;
  return { lado, tipo, distanciaFora, z: zInicial };
}

for (let i = 0; i < 14; i++) {
  objetosLateral.push(criarObjetoLateral((i / 14) * profundidadeMax));
}

// Tráfego nos dois sentidos:
// - mesmoSentido: vai na mesma direção da corrida (mais lento que o topo da moto, mostra traseira com lanternas vermelhas)
// - contramao: vem no sentido oposto (mostra frente com faróis amarelos)
const coresCarros = ["#b91c1c", "#ca8a04", "#cbd5e1", "#334155", "#2563eb"];
const faixasMesmoSentido = [0.18, 0.46];
const faixasContramao = [-0.46, -0.2];

const trafego = [];

function criarCarroTrafego(sentido, zInicial = 1, ativo = true, espera = 0) {
  const ehMesmoSentido = sentido === "mesmoSentido";
  const faixas = ehMesmoSentido ? faixasMesmoSentido : faixasContramao;
  return {
    sentido,
    ativo,
    z: zInicial,
    posRelativa: faixas[Math.floor(Math.random() * faixas.length)],
    cor: coresCarros[Math.floor(Math.random() * coresCarros.length)],
    // Velocidade própria de cruzeiro para carros no mesmo sentido (abaixo do máximo da moto)
    velPropria: ehMesmoSentido ? 1.45 + Math.random() * 0.85 : 2.2 + Math.random() * 1.1,
    espera
  };
}

function inicializarTrafego() {
  trafego.length = 0;
  trafego.push(criarCarroTrafego("mesmoSentido", 140, true, 0));
  trafego.push(criarCarroTrafego("mesmoSentido", 430, true, 0));
  trafego.push(criarCarroTrafego("contramao", 260, true, 0));
  trafego.push(criarCarroTrafego("contramao", 1, false, 180));
}

inicializarTrafego();

// 12 motos rivais com ritmo independente para ultrapassar quando você tira o pé
const nomesRivais = [
  "BIFF",
  "SLATER",
  "NATASHA",
  "SHIVA",
  "VIPER",
  "AXEL",
  "RAVEN",
  "BLAZE",
  "KANE",
  "ROXY",
  "TORQUE",
  "VEX"
];
const totalRivais = 12;
const faixasDisponiveis = [-0.54, -0.24, 0.22, 0.52];
const motosRivais = [];

function obterKmPorSegundoJogador() {
  if (estadoJogador === "caindo") return velocidadeDeslize * 0.015;
  const fator = Math.max(0, (velocidade - velocidadeMin) / (velocidadeMax - velocidadeMin));
  return 0.005 + fator * 0.085;
}

function criarRivaisIniciais() {
  motosRivais.length = 0;
  for (let i = 0; i < totalRivais; i++) {
    const faixaInicial = faixasDisponiveis[i % faixasDisponiveis.length];
    const kmInicial = 0.08 + i * 0.055;
    const kmPorSegBase = 0.044 + (i % 6) * 0.0065;

    motosRivais.push({
      id: i + 1,
      nome: nomesRivais[i % nomesRivais.length],
      ultrapassada: false,
      kmAlvo: kmInicial,
      kmPorSegBase,
      posRelativa: faixaInicial,
      alvoPosRelativa: faixaInicial,
      timerTrocaFaixa: 55 + ((i * 27) % 90),
      temCorrente: i % 3 === 1,
      energia: 40,
      atordoadoTimer: 0,
      caiuTimer: 0
    });
  }
}

criarRivaisIniciais();

const policial = {
  ativo: false,
  distanciaAtras: 1.0,
  posRelativa: -0.35,
  alvoPosRelativa: -0.35,
  tempoAtivo: 0,
  cooldownRetorno: 5
};

function mostrarAviso(texto) {
  msgCombate = texto;
  timerMsgCombate = 100;
}

function obterRivalEmDisputa() {
  let escolhido = null;
  let menorAbsGap = Infinity;
  for (const rival of motosRivais) {
    const gap = Math.abs(rival.kmAlvo - distanciaKm);
    if (gap < menorAbsGap && gap < 0.35) {
      menorAbsGap = gap;
      escolhido = rival;
    }
  }
  return escolhido;
}

function obterPosicaoCorrida() {
  let aFrente = 0;
  for (const rival of motosRivais) {
    if (rival.kmAlvo > distanciaKm) aFrente++;
  }
  const posicaoAtual = aFrente + 1;
  return { posicaoAtual, totalPilotos: totalRivais + 1 };
}

function derrubarJogador(motivoTexto = "QUEDA NA PISTA!") {
  if (estadoJogador === "caindo" || corridaEncerrada) return;
  estadoJogador = "caindo";
  timerEstadoJogador = 55;
  velocidadeDeslize = Math.max(0.35, velocidade * 0.5);
  velocidade = velocidadeMin;
  inclinacao = (Math.random() < 0.5 ? -1 : 1) * 0.65;
  tempoInvencivel = 65;
  mostrarAviso(motivoTexto);
  tocarRuido(0.28, 0.12);
  tocarBip(180, 55, 0.25, "sawtooth", 0.08);
}

const teclas = {
  esquerda: false,
  direita: false,
  cima: false,
  baixo: false
};

function executarGolpe(tipo) {
  if (corridaEncerrada || animacaoGolpe > 0 || estadoJogador !== "correndo") return;

  tipoGolpe = tipo;
  animacaoGolpe = 16;

  if (teclas.esquerda) ladoGolpe = -1;
  else if (teclas.direita) ladoGolpe = 1;
  else {
    let maisPerto = null;
    let menorDist = Infinity;
    const posJogadorRel = (motoX - centroPistaNaMoto) / 220;
    for (const rival of motosRivais) {
      if (rival.caiuTimer > 0) continue;
      const gapKm = rival.kmAlvo - distanciaKm;
      if (gapKm > -0.07 && gapKm < 0.19) {
        const dx = Math.abs(rival.posRelativa - posJogadorRel);
        if (dx < menorDist) {
          menorDist = dx;
          maisPerto = rival;
        }
      }
    }
    if (maisPerto) {
      const posJogador = (motoX - centroPistaNaMoto) / 220;
      ladoGolpe = maisPerto.posRelativa >= posJogador ? 1 : -1;
    }
  }

  tocarBip(
    temCorrente ? 420 : tipo === "chute" ? 260 : 340,
    temCorrente ? 140 : 90,
    0.09,
    temCorrente ? "sawtooth" : "square",
    0.07
  );

  const alcanceKm = temCorrente ? 0.19 : 0.15;
  const alcanceLateral = temCorrente ? 0.48 : 0.38;
  const dano = tipo === "chute" ? (temCorrente ? 32 : 24) : (temCorrente ? 26 : 18);
  const posJogadorRel = (motoX - centroPistaNaMoto) / 220;

  for (const rival of motosRivais) {
    if (rival.caiuTimer > 0) continue;
    const gapKm = rival.kmAlvo - distanciaKm;
    const deltaLateral = rival.posRelativa - posJogadorRel;
    const noLadoCerto =
      (ladoGolpe === 1 && deltaLateral >= -0.15) ||
      (ladoGolpe === -1 && deltaLateral <= 0.15);

    if (
      gapKm >= -0.07 &&
      gapKm <= alcanceKm &&
      Math.abs(deltaLateral) <= alcanceLateral &&
      noLadoCerto
    ) {
      rival.energia -= dano;
      rival.atordoadoTimer = 45;
      rival.alvoPosRelativa = Math.max(
        -0.56,
        Math.min(0.56, rival.alvoPosRelativa + ladoGolpe * 0.28)
      );
      rival.kmAlvo -= tipo === "chute" ? 0.09 : 0.05;

      tocarRuido(0.08, 0.09);

      if (rival.temCorrente) {
        rival.temCorrente = false;
        temCorrente = true;
        dinheiro += 150;
        mostrarAviso(`CORRENTE ROUBADA DE ${rival.nome}! +$150`);
        tocarBip(520, 880, 0.14, "triangle", 0.08);
      } else if (rival.energia <= 0) {
        rival.energia = 40;
        rival.caiuTimer = 95;
        rival.kmAlvo = distanciaKm - 0.28;
        rivaisDerrubados++;
        dinheiro += 100;
        mostrarAviso(`${rival.nome} DERRUBADO! +$100`);
        tocarBip(300, 75, 0.2, "sawtooth", 0.08);
      } else if (tipo === "chute") {
        dinheiro += 25;
        mostrarAviso(`CHUTE EM ${rival.nome}! +$25`);
      } else {
        dinheiro += 15;
        mostrarAviso(`SOCO EM ${rival.nome}! +$15`);
      }
      break;
    }
  }
}

function reiniciarCorrida() {
  deslocamento = 0;
  velocidade = 1.5;
  motoX = 400;
  alturaSalto = 0;
  velVerticalSalto = 0;
  inclinacao = 0;
  energiaJogador = 100;
  tempoInvencivel = 0;
  estadoJogador = "correndo";
  timerEstadoJogador = 0;
  velocidadeDeslize = 0;
  temCorrente = false;
  animacaoGolpe = 0;
  tipoGolpe = null;
  dinheiro = 0;
  rivaisDerrubados = 0;
  msgCombate = "";
  timerMsgCombate = 0;
  motivoEncerramento = "META";
  distanciaKm = 0;
  tempoSegundos = 0;
  corridaEncerrada = false;
  curvaAtual = 0;
  curvaAlvo = 0;
  elevacaoAtual = 0;
  elevacaoAlvo = 0;
  distanciaSegmento = 0;
  proximoTrecho = 620;
  inicializarTrafego();
  criarRivaisIniciais();

  policial.ativo = false;
  policial.distanciaAtras = 1.0;
  policial.posRelativa = -0.35;
  policial.alvoPosRelativa = -0.35;
  policial.tempoAtivo = 0;
  policial.cooldownRetorno = 5;
}

window.addEventListener("keydown", (e) => {
  garantirAudio();
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") teclas.esquerda = true;
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") teclas.direita = true;
  if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") teclas.cima = true;
  if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") teclas.baixo = true;

  if (e.key === "j" || e.key === "J" || e.key === "z" || e.key === "Z") {
    executarGolpe("soco");
  }
  if (e.key === "k" || e.key === "K" || e.key === "x" || e.key === "X") {
    executarGolpe("chute");
  }
  if (e.key === "m" || e.key === "M") {
    somAtivo = !somAtivo;
    mostrarAviso(somAtivo ? "SOM LIGADO" : "SOM MUDO");
  }

  if ((e.key === "r" || e.key === "R" || e.key === "Enter") && corridaEncerrada) {
    reiniciarCorrida();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") teclas.esquerda = false;
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") teclas.direita = false;
  if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") teclas.cima = false;
  if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") teclas.baixo = false;
});

function atualizarRivais() {
  const dt = 1 / 60;

  for (const rival of motosRivais) {
    if (rival.caiuTimer > 0) {
      rival.caiuTimer--;
      rival.kmAlvo -= 0.012 * dt;
      rival.ultrapassada = distanciaKm >= rival.kmAlvo;
      continue;
    }

    if (rival.atordoadoTimer > 0) {
      rival.atordoadoTimer--;
    } else {
      rival.kmAlvo += rival.kmPorSegBase * dt;
    }

    rival.timerTrocaFaixa--;
    if (rival.timerTrocaFaixa <= 0) {
      rival.timerTrocaFaixa = 55 + Math.floor(Math.random() * 90);
      const candidatas = faixasDisponiveis.filter((f) => {
        return !motosRivais.some(
          (outro) =>
            outro.id !== rival.id &&
            outro.caiuTimer <= 0 &&
            Math.abs(outro.kmAlvo - rival.kmAlvo) < 0.14 &&
            Math.abs(outro.alvoPosRelativa - f) < 0.25
        );
      });
      if (candidatas.length > 0) {
        rival.alvoPosRelativa = candidatas[Math.floor(Math.random() * candidatas.length)];
      }
    }

    const gapKm = rival.kmAlvo - distanciaKm;
    for (const carro of trafego) {
      if (!carro.ativo || carro.sentido !== "contramao") continue;
      if (gapKm > 0 && gapKm < 1.1) {
        const proximidade = 1 - gapKm / 1.1;
        const zRival = Math.max(15, proximidade * (profundidadeMax * 0.85));
        const distanciaZ = Math.abs(carro.z - zRival);
        const mesmaFaixa = Math.abs(carro.posRelativa - rival.alvoPosRelativa) < 0.35;

        if (distanciaZ < 170 && mesmaFaixa) {
          rival.alvoPosRelativa = carro.posRelativa < 0 ? 0.34 : -0.34;
        }
      }
    }

    rival.posRelativa = Math.max(
      -0.58,
      Math.min(0.58, rival.posRelativa + (rival.alvoPosRelativa - rival.posRelativa) * 0.065)
    );
    rival.ultrapassada = distanciaKm >= rival.kmAlvo;
  }
}

function atualizarPolicial() {
  const dt = 1 / 60;

  if (corridaEncerrada) {
    policial.ativo = false;
    return;
  }

  if (!policial.ativo) {
    policial.cooldownRetorno -= dt;
    if (policial.cooldownRetorno <= 0 && (velocidade > 1.7 || Math.random() < 0.02)) {
      policial.ativo = true;
      policial.distanciaAtras = 0.72;
      policial.tempoAtivo = 0;
      policial.posRelativa = motoX < centroPistaNaMoto ? 0.35 : -0.35;
      policial.alvoPosRelativa = policial.posRelativa;
      mostrarAviso("POLICIA ENTROU NA PISTA!");
      tocarBip(740, 520, 0.16, "square", 0.05);
    }
    return;
  }

  policial.tempoAtivo += dt;

  const posRelativaJogador = Math.max(-0.55, Math.min(0.55, (motoX - centroPistaNaMoto) / 220));
  policial.alvoPosRelativa = posRelativaJogador;
  policial.posRelativa += (policial.alvoPosRelativa - policial.posRelativa) * 0.05;

  const diferencaVelocidade = (velocidade - 2.3) * 0.00055;
  policial.distanciaAtras = Math.max(
    0.05,
    Math.min(1.1, policial.distanciaAtras - diferencaVelocidade)
  );

  if (estadoJogador === "caindo" && policial.distanciaAtras < 0.35) {
    dinheiro = Math.max(0, dinheiro - 200);
    corridaEncerrada = true;
    motivoEncerramento = "PRESO";
    return;
  }

  if (policial.distanciaAtras <= 0.08 && tempoInvencivel === 0) {
    energiaJogador = Math.max(0, energiaJogador - 14);
    velocidade = Math.max(velocidadeMin, velocidade * 0.78);
    policial.distanciaAtras = 0.52;
    tempoInvencivel = 45;
    tocarRuido(0.14, 0.09);

    if (energiaJogador <= 0) {
      corridaEncerrada = true;
      motivoEncerramento = "PRESO";
      return;
    }
    derrubarJogador("DERRUBADO PELA POLICIA!");
  }

  if (policial.tempoAtivo >= 10.5 || policial.distanciaAtras >= 1.05) {
    policial.ativo = false;
    policial.cooldownRetorno = 8 + Math.random() * 5;
    mostrarAviso("POLICIA PARA POR ENQUANTO...");
  }
}

function atualizarTrafego(fluxoCenario) {
  for (let i = 0; i < trafego.length; i++) {
    const carro = trafego[i];

    if (!carro.ativo) {
      carro.espera -= Math.max(1.2, velocidade);
      if (carro.espera <= 0) {
        const novo = criarCarroTrafego(carro.sentido, 1, true, 0);
        // Evita nascer exatamente em cima de outro carro na mesma faixa
        const colideNoSpawn = trafego.some(
          (outro, idx) =>
            idx !== i &&
            outro.ativo &&
            outro.z < 110 &&
            Math.abs(outro.posRelativa - novo.posRelativa) < 0.25
        );
        if (!colideNoSpawn) {
          trafego[i] = novo;
        } else {
          carro.espera = 45;
        }
      }
      continue;
    }

    if (carro.sentido === "contramao") {
      // Vem de frente: aproxima rápido independente de você tirar o pé
      carro.z += fluxoCenario + carro.velPropria * 0.75;
    } else {
      // Vai no mesmo sentido: se você estiver mais rápido, você encosta; se tirar o pé, ele segue à frente
      const diferencaRelativa = velocidade - carro.velPropria;
      carro.z += Math.max(0.35, diferencaRelativa * 0.95 + 0.65);
    }

    if (carro.z >= profundidadeMax || carro.z < 0) {
      trafego[i] = criarCarroTrafego(
        carro.sentido,
        1,
        false,
        carro.sentido === "contramao" ? 180 + Math.random() * 240 : 210 + Math.random() * 260
      );
    }
  }
}

function atualizarPista() {
  if (corridaEncerrada) return;

  tempoSegundos += 1 / 60;
  distanciaSegmento += Math.max(0.8, velocidade);

  if (distanciaSegmento >= proximoTrecho) {
    distanciaSegmento = 0;
    proximoTrecho = 580 + Math.random() * 620;

    const opcoesCurva = [0, -2.2, 2.2, 0, -3.4, 3.4, 0];
    curvaAlvo = opcoesCurva[Math.floor(Math.random() * opcoesCurva.length)];

    const opcoesMorro = [0, 44, -38, 56, -46, 0];
    elevacaoAlvo = opcoesMorro[Math.floor(Math.random() * opcoesMorro.length)];

    if (elevacaoAlvo >= 44 && velocidade > 2.3 && alturaSalto === 0 && estadoJogador === "correndo") {
      velVerticalSalto = 4.4;
      tocarBip(220, 440, 0.12, "triangle", 0.05);
    }
  }

  curvaAtual += (curvaAlvo - curvaAtual) * 0.018;
  elevacaoAtual += (elevacaoAlvo - elevacaoAtual) * 0.016;

  const fluxoCenario = 0.85 + velocidade * 0.65;
  for (let i = 0; i < objetosLateral.length; i++) {
    objetosLateral[i].z += fluxoCenario;
    if (objetosLateral[i].z >= profundidadeMax) {
      objetosLateral[i] = criarObjetoLateral(1);
    }
  }

  atualizarTrafego(fluxoCenario);

  distanciaKm += obterKmPorSegundoJogador() / 60;

  if (distanciaKm >= distanciaMetaKm) {
    distanciaKm = distanciaMetaKm;
    corridaEncerrada = true;
    motivoEncerramento = "META";
    tocarBip(440, 880, 0.25, "triangle", 0.08);
  }

  atualizarRivais();
  atualizarPolicial();
}

function atualizarMoto() {
  if (tempoInvencivel > 0) tempoInvencivel--;
  if (animacaoGolpe > 0) animacaoGolpe--;
  if (timerMsgCombate > 0) timerMsgCombate--;

  if (alturaSalto > 0 || velVerticalSalto !== 0) {
    alturaSalto += velVerticalSalto;
    velVerticalSalto -= 0.26;
    if (alturaSalto <= 0) {
      alturaSalto = 0;
      velVerticalSalto = 0;
    }
  }

  if (corridaEncerrada) {
    velocidade = Math.max(0, velocidade - 0.03);
    inclinacao *= 0.85;
    return;
  }

  if (estadoJogador === "caindo") {
    timerEstadoJogador--;
    velocidadeDeslize = Math.max(0, velocidadeDeslize - 0.012);
    motoX += inclinacao * 2.2;
    if (timerEstadoJogador <= 0) {
      estadoJogador = "levantando";
      timerEstadoJogador = 28;
      inclinacao = 0;
      mostrarAviso("SUBINDO NA MOTO!");
    }
  } else if (estadoJogador === "levantando") {
    timerEstadoJogador--;
    if (timerEstadoJogador <= 0) {
      estadoJogador = "correndo";
      velocidade = 1.1;
    }
  } else {
    if (teclas.cima) {
      velocidade = Math.min(velocidade + 0.018, velocidadeMax);
    } else if (teclas.baixo) {
      velocidade = Math.max(velocidade - 0.045, velocidadeMin);
    } else {
      if (velocidade > velocidadeMin) {
        velocidade = Math.max(velocidadeMin, velocidade - 0.016);
      }
    }

    motoX -= curvaAtual * (velocidade * 0.075);

    if (teclas.esquerda) {
      motoX -= 3.2;
      inclinacao = Math.max(inclinacao - 0.035, -0.4);
    } else if (teclas.direita) {
      motoX += 3.2;
      inclinacao = Math.min(inclinacao + 0.035, 0.4);
    } else {
      const inclinacaoCurva = Math.max(-0.24, Math.min(0.24, -curvaAtual * 0.07));
      inclinacao += (inclinacaoCurva - inclinacao) * 0.16;
    }
  }

  const margemPista = 175;
  const limiteEsquerdo = centroPistaNaMoto - margemPista;
  const limiteDireito = centroPistaNaMoto + margemPista;

  if (motoX < limiteEsquerdo) motoX = limiteEsquerdo;
  if (motoX > limiteDireito) motoX = limiteDireito;
}

function desenharCenarioFundo(horizonteY) {
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(0, 0, 800, horizonteY * 0.45);
  ctx.fillStyle = "#7dd3fc";
  ctx.fillRect(0, horizonteY * 0.45, 800, horizonteY * 0.35);
  ctx.fillStyle = "#bae6fd";
  ctx.fillRect(0, horizonteY * 0.8, 800, horizonteY * 0.2 + 4);

  const deslocMontanha = ((((curvaAtual * 28 + motoX * 0.04) % 200) + 200) % 200);
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.moveTo(-220, horizonteY);
  for (let mx = -220; mx <= 1020; mx += 100) {
    const pico = mx % 200 === 0 ? 34 : 18;
    ctx.lineTo(mx - deslocMontanha, horizonteY - pico);
  }
  ctx.lineTo(1020, horizonteY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#15803d";
  ctx.fillRect(0, horizonteY, 800, 485 - horizonteY);

  for (let gy = horizonteY; gy < 485; gy += 6) {
    const t = (gy - horizonteY) / Math.max(1, 485 - horizonteY);
    const faixa = (((Math.floor(gy * 0.12 - deslocamento * 0.04) % 4) + 4) % 4);
    if (faixa === 0 && t > 0.08) {
      ctx.fillStyle = "#166534";
      ctx.fillRect(0, gy, 800, 2);
    }
  }
}

function desenharEstrada() {
  const horizonteY = Math.max(145, Math.min(242, 200 - elevacaoAtual));
  const baseY = 485;
  const alturaPista = baseY - horizonteY;

  for (let y = horizonteY; y < baseY; y += 2) {
    const t = (y - horizonteY) / alturaPista;

    const ondaMorro = Math.sin(t * Math.PI) * (elevacaoAtual * 0.42);
    const deslocamentoCurva = curvaAtual * 65 * Math.pow(1 - t, 2);
    const centroX = 400 + deslocamentoCurva;
    const py = y + ondaMorro * 0.18;

    if (Math.abs(y - motoY) <= 2) {
      centroPistaNaMoto = centroX;
    }

    const meiaLargura = 50 + t * 250;
    const larguraBorda = 5 + t * 8;

    const zPista = deslocamento * 0.065 - Math.pow(t, 1.35) * 20;
    const tomAsfalto = (((Math.floor(y * 0.28 - deslocamento * 0.06) % 2) + 2) % 2);
    ctx.fillStyle = tomAsfalto === 0 ? "#3f3f46" : "#37373d";
    ctx.fillRect(centroX - meiaLargura, py, meiaLargura * 2, 2);

    const zebradoPar = (((Math.floor(zPista) % 8) + 8) % 8) < 4;
    ctx.fillStyle = zebradoPar ? "#dc2626" : "#f8fafc";
    ctx.fillRect(centroX - meiaLargura - larguraBorda, py, larguraBorda, 2);
    ctx.fillRect(centroX + meiaLargura, py, larguraBorda, 2);

    const fase = (((Math.floor(zPista) % 10) + 10) % 10);
    if (fase < 5) {
      const larguraFaixa = 2 + t * 8;
      ctx.fillStyle = "#facc15";
      ctx.fillRect(centroX - larguraFaixa / 2, py, larguraFaixa, 2);
    }
  }
}

function desenharCarroItem(carro, x, yBase, escala) {
  ctx.save();
  ctx.translate(x, yBase);
  ctx.scale(escala, escala);

  const ehMesmoSentido = carro.sentido === "mesmoSentido";

  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.ellipse(0, 2, 50, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#09090b";
  ctx.fillRect(-45, -15, 11, 15);
  ctx.fillRect(34, -15, 11, 15);

  ctx.fillStyle = carro.cor;
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.rect(-39, -29, 78, 22);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#18181b";
  ctx.fillRect(-37, -10, 74, 4);

  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.rect(-28, -43, 56, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = carro.cor;
  ctx.fillRect(-30, -46, 60, 5);
  ctx.strokeRect(-30, -46, 60, 5);

  if (ehMesmoSentido) {
    // Traseira do carro: lanternas vermelhas de freio/posição
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(-34, -22, 12, 6);
    ctx.fillRect(22, -22, 12, 6);

    ctx.fillStyle = "#334155";
    ctx.fillRect(-15, -21, 30, 6);
  } else {
    // Frente do carro na contramão: faróis amarelos e grade escura
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(-34, -22, 12, 6);
    ctx.fillRect(22, -22, 12, 6);

    ctx.fillStyle = "#09090b";
    ctx.fillRect(-15, -21, 30, 6);
  }

  ctx.restore();
}

function desenharMotoRivalItem(x, yBase, escala, possuiCorrente = false, caido = false) {
  ctx.save();
  ctx.translate(x, yBase);
  ctx.scale(escala, escala);
  if (caido) {
    ctx.rotate(1.25);
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
  ctx.beginPath();
  ctx.ellipse(0, 26, 23, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#09090b";
  ctx.fillRect(-11, 4, 22, 22);

  ctx.fillStyle = "#d4d4d8";
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 2;
  ctx.fillRect(9, 10, 6, 13);
  ctx.strokeRect(9, 10, 6, 13);

  ctx.fillStyle = "#1d4ed8";
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-12, 12);
  ctx.lineTo(-9, -8);
  ctx.lineTo(9, -8);
  ctx.lineTo(12, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#93c5fd";
  ctx.fillRect(-5, -6, 10, 6);

  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-16, -7);
  ctx.lineTo(16, -7);
  ctx.stroke();

  ctx.fillStyle = "#1e3a8a";
  ctx.beginPath();
  ctx.ellipse(0, -16, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#2563eb";
  ctx.beginPath();
  ctx.arc(0, -31, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#bae6fd";
  ctx.fillRect(-6, -33, 12, 3.5);

  if (possuiCorrente && !caido) {
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(19, -10);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function desenharElementosCenario() {
  const horizonteY = Math.max(145, Math.min(242, 200 - elevacaoAtual));
  const baseY = 485;
  const alturaPista = baseY - horizonteY;

  const itens = [];

  for (const obj of objetosLateral) {
    const linear = obj.z / profundidadeMax;
    const t = Math.pow(linear, 1.55);
    const yBase = horizonteY + t * alturaPista;
    if (yBase <= horizonteY || yBase > baseY) continue;

    const deslocamentoCurva = curvaAtual * 65 * Math.pow(1 - t, 2);
    const centroX = 400 + deslocamentoCurva;
    const meiaLargura = 50 + t * 250;
    const x = centroX + obj.lado * meiaLargura * obj.distanciaFora;
    const escala = 0.15 + t * 0.75;

    itens.push({ kind: "lateral", obj, x, yBase, escala, z: obj.z });
  }

  if (!corridaEncerrada) {
    for (const rival of motosRivais) {
      const gapKm = rival.kmAlvo - distanciaKm;
      if (gapKm > -0.25 && gapKm < 0.95) {
        const proximidade = Math.max(0.04, Math.min(1.02, 1 - (gapKm + 0.25) / 1.2));
        const zRival = Math.max(15, proximidade * (profundidadeMax * 0.88));
        const linear = zRival / profundidadeMax;
        const t = Math.pow(linear, 1.55);
        const yBase = horizonteY + t * alturaPista;

        if (yBase > horizonteY && yBase <= baseY) {
          const deslocamentoCurva = curvaAtual * 65 * Math.pow(1 - t, 2);
          const centroX = 400 + deslocamentoCurva;
          const meiaLargura = 50 + t * 250;
          const x = centroX + rival.posRelativa * meiaLargura;
          const escala = 0.22 + t * 0.95;

          if (
            t > 0.85 &&
            t < 0.98 &&
            tempoInvencivel === 0 &&
            rival.atordoadoTimer === 0 &&
            rival.caiuTimer === 0 &&
            estadoJogador === "correndo" &&
            alturaSalto < 8
          ) {
            if (Math.abs(motoX - x) < 24 * escala) {
              const danoColisao = rival.temCorrente ? 14 : 8;
              energiaJogador = Math.max(0, energiaJogador - danoColisao);
              velocidade = Math.max(velocidadeMin, velocidade * 0.78);
              if (energiaJogador <= 0) {
                corridaEncerrada = true;
                motivoEncerramento = "QUEDA_TOTAL";
              } else {
                derrubarJogador(
                  rival.temCorrente ? "QUEDA POR CORRENTE!" : "BATIDA COM RIVAL!"
                );
              }
            }
          }

          itens.push({ kind: "rival", rival, x, yBase, escala, z: zRival });
        }
      }
    }
  }

  for (let i = 0; i < trafego.length; i++) {
    const carro = trafego[i];
    if (!carro.ativo || corridaEncerrada) continue;

    const linear = carro.z / profundidadeMax;
    const t = Math.pow(linear, 1.55);
    const yBase = horizonteY + t * alturaPista;

    if (yBase > horizonteY && yBase <= baseY) {
      const deslocamentoCurva = curvaAtual * 65 * Math.pow(1 - t, 2);
      const centroX = 400 + deslocamentoCurva;
      const meiaLargura = 50 + t * 250;
      const x = centroX + carro.posRelativa * meiaLargura;
      const escala = 0.18 + t * 0.95;

      if (
        t > 0.78 &&
        t < 0.96 &&
        tempoInvencivel === 0 &&
        estadoJogador === "correndo" &&
        alturaSalto < 10
      ) {
        const larguraColisao = 42 * escala;
        if (Math.abs(motoX - x) < larguraColisao) {
          energiaJogador = Math.max(0, energiaJogador - 18);
          velocidade = Math.max(velocidadeMin, velocidade * 0.55);
          trafego[i] = criarCarroTrafego(
            carro.sentido,
            1,
            false,
            200 + Math.random() * 220
          );

          if (energiaJogador <= 0) {
            corridaEncerrada = true;
            motivoEncerramento = "QUEDA_TOTAL";
          } else {
            derrubarJogador(
              carro.sentido === "mesmoSentido"
                ? "BATIDA NA TRASEIRA DO CARRO!"
                : "BATIDA FORTE NA CONTRAMAO!"
            );
          }
          continue;
        }
      }

      itens.push({ kind: "carro", carro, x, yBase, escala, z: carro.z });
    }
  }

  itens.sort((a, b) => a.z - b.z);

  for (const item of itens) {
    if (item.kind === "carro") {
      desenharCarroItem(item.carro, item.x, item.yBase, item.escala);
      continue;
    }

    if (item.kind === "rival") {
      desenharMotoRivalItem(
        item.x,
        item.yBase,
        item.escala,
        item.rival.temCorrente,
        item.rival.caiuTimer > 0
      );
      continue;
    }

    const obj = item.obj;
    ctx.save();
    ctx.translate(item.x, item.yBase);
    ctx.scale(item.escala, item.escala);

    if (obj.tipo === "arvore") {
      ctx.fillStyle = "#5c2d16";
      ctx.strokeStyle = "#09090b";
      ctx.lineWidth = 2;
      ctx.fillRect(-6, -34, 12, 34);
      ctx.strokeRect(-6, -34, 12, 34);

      ctx.fillStyle = "#166534";
      ctx.beginPath();
      ctx.arc(0, -44, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(-6, -50, 16, 0, Math.PI * 2);
      ctx.arc(7, -47, 14, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#94a3b8";
      ctx.strokeStyle = "#09090b";
      ctx.lineWidth = 2;
      ctx.fillRect(-16, -24, 3, 24);
      ctx.fillRect(13, -24, 3, 24);

      ctx.fillStyle = "#facc15";
      ctx.fillRect(-23, -47, 46, 25);
      ctx.strokeRect(-23, -47, 46, 25);

      ctx.fillStyle = "#09090b";
      ctx.fillRect(-15, -42, 6, 15);
      ctx.fillRect(-3, -42, 6, 15);
      ctx.fillRect(9, -42, 6, 15);
    }

    ctx.restore();
  }
}

function desenharMoto() {
  if (tempoInvencivel > 0 && Math.floor(tempoInvencivel / 4) % 2 === 0 && estadoJogador === "correndo") {
    return;
  }

  ctx.save();
  const yDesenhado = motoY - alturaSalto;
  ctx.translate(motoX, yDesenhado);

  ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
  ctx.beginPath();
  ctx.ellipse(0, 26 + alturaSalto, Math.max(10, 23 - alturaSalto * 0.2), 7, 0, 0, Math.PI * 2);
  ctx.fill();

  if (estadoJogador === "caindo") {
    ctx.rotate(1.35);
  } else {
    ctx.rotate(inclinacao);
  }

  ctx.fillStyle = "#09090b";
  ctx.fillRect(-11, 4, 22, 22);

  ctx.fillStyle = "#e4e4e7";
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 2;
  ctx.fillRect(9, 10, 6, 13);
  ctx.strokeRect(9, 10, 6, 13);

  ctx.fillStyle = "#dc2626";
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-13, 12);
  ctx.lineTo(-9, -8);
  ctx.lineTo(9, -8);
  ctx.lineTo(13, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-5, -6, 10, 6);

  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-16, -7);
  ctx.lineTo(16, -7);
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, -16, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#dc2626";
  ctx.fillRect(-7, -21, 14, 7);

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, -31, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#dc2626";
  ctx.fillRect(-7, -33, 14, 3);

  ctx.fillStyle = "#1e293b";
  ctx.fillRect(-5, -30, 10, 3);

  if (animacaoGolpe > 0) {
    const ext = Math.sin((animacaoGolpe / 16) * Math.PI);
    if (tipoGolpe === "soco") {
      const alcanceX = ladoGolpe * (16 + ext * (temCorrente ? 22 : 12));
      const yBraco = -18;

      ctx.strokeStyle = temCorrente ? "#facc15" : "#fde68a";
      ctx.lineWidth = temCorrente ? 4 : 5;
      if (temCorrente) ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(ladoGolpe * 8, yBraco);
      ctx.lineTo(alcanceX, yBraco - 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = temCorrente ? "#eab308" : "#fbbf24";
      ctx.beginPath();
      ctx.arc(alcanceX, yBraco - 2, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (tipoGolpe === "chute") {
      const alcanceX = ladoGolpe * (18 + ext * 16);
      const yPerna = -4;

      ctx.strokeStyle = "#fde047";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(ladoGolpe * 6, 4);
      ctx.lineTo(alcanceX, yPerna);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function desenharRetrovisor(x, y, largura, altura, ladoEspelho) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, largura, altura);
  ctx.clip();

  const horizonteEspelho = Math.max(
    y + altura * 0.25,
    Math.min(y + altura * 0.65, y + altura * 0.45 - elevacaoAtual * 0.25)
  );
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(x, y, largura, horizonteEspelho - y);
  ctx.fillStyle = "#15803d";
  ctx.fillRect(x, horizonteEspelho, largura, y + altura - horizonteEspelho);

  const anguloExtra = ladoEspelho * 6;
  const offsetEspelho = (motoX - centroPistaNaMoto) * 0.08 + curvaAtual * 2.5 + anguloExtra;
  ctx.fillStyle = "#3f3f46";
  ctx.beginPath();
  ctx.moveTo(x + largura * 0.42 + offsetEspelho, horizonteEspelho);
  ctx.lineTo(x + largura * 0.58 + offsetEspelho, horizonteEspelho);
  ctx.lineTo(x + largura * 0.85 + offsetEspelho, y + altura);
  ctx.lineTo(x + largura * 0.15 + offsetEspelho, y + altura);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#facc15";
  let cicloEspelho = (((deslocamento * 0.18) % 16) + 16) % 16;
  for (let i = 0; i < 3; i++) {
    let fy = horizonteEspelho + 2 + i * 14 + cicloEspelho;
    if (fy < y + altura) {
      ctx.fillRect(x + largura / 2 - 1 + offsetEspelho, fy, 2, 7);
    }
  }

  for (const rival of motosRivais) {
    const atrasKm = distanciaKm - rival.kmAlvo;
    if (atrasKm > 0.01 && atrasKm < 0.85) {
      const aprox = 1 - atrasKm / 0.85;
      const ry = horizonteEspelho + 2 + Math.pow(aprox, 1.4) * (y + altura - horizonteEspelho - 6);
      const rx = x + largura * 0.5 + offsetEspelho + rival.posRelativa * (largura * 0.25);
      const rEscala = 0.14 + aprox * 0.22;

      ctx.save();
      ctx.translate(rx, ry);
      ctx.scale(rEscala, rEscala);
      ctx.fillStyle = "#2563eb";
      ctx.fillRect(-8, -18, 16, 18);
      ctx.fillStyle = "#93c5fd";
      ctx.beginPath();
      ctx.arc(0, -23, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  if (policial.ativo) {
    const aproxPol = 1 - policial.distanciaAtras;
    const py = horizonteEspelho + 3 + Math.pow(aproxPol, 1.35) * (y + altura - horizonteEspelho - 6);
    const px = x + largura * 0.5 + offsetEspelho + policial.posRelativa * (largura * 0.26);
    const pEscala = 0.2 + aproxPol * 0.34;

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(pEscala, pEscala);

    ctx.fillStyle = "#111827";
    ctx.fillRect(-10, -22, 20, 22);

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, -28, 7, 0, Math.PI * 2);
    ctx.fill();

    const pisca = Math.floor(tempoSegundos * 12) % 2 === 0;
    ctx.fillStyle = pisca ? "#ff1e1e" : "#3b82f6";
    ctx.beginPath();
    ctx.arc(0, -37, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  ctx.restore();

  ctx.strokeStyle = "#18181b";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, largura, altura);
}

function desenharPainel() {
  const painelY = 485;
  const painelAltura = 115;

  ctx.fillStyle = "#a1a1aa";
  ctx.fillRect(0, painelY, 800, painelAltura);

  ctx.fillStyle = "#18181b";
  ctx.fillRect(0, painelY, 800, 4);

  desenharRetrovisor(18, painelY + 34, 155, 72, -1);
  desenharRetrovisor(627, painelY + 34, 155, 72, 1);

  ctx.fillStyle = "#111111";
  ctx.fillRect(18, painelY + 8, 250, 22);
  ctx.fillRect(178, painelY + 34, 90, 26);

  ctx.fillStyle = energiaJogador > 35 ? "#00cc00" : "#ef4444";
  ctx.fillRect(21, painelY + 11, (244 * energiaJogador) / 100, 16);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px monospace";
  ctx.fillText("PLAYER 1", 183, painelY + 52);

  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 11px monospace";
  ctx.fillText(`$${dinheiro} | ${somAtivo ? "SOM [M]" : "MUDO [M]"}`, 18, painelY + 76);

  const rivalAlvo = obterRivalEmDisputa();
  ctx.fillStyle = "#111111";
  ctx.fillRect(532, painelY + 8, 250, 22);
  ctx.fillRect(532, painelY + 34, 90, 26);

  const energiaRivalPct = rivalAlvo ? Math.max(0, Math.min(100, (rivalAlvo.energia / 40) * 100)) : 100;
  ctx.fillStyle = rivalAlvo ? "#38bdf8" : "#00cc00";
  ctx.fillRect(535, painelY + 11, (244 * energiaRivalPct) / 100, 16);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px monospace";
  ctx.fillText(rivalAlvo ? rivalAlvo.nome : "BIKE", 542, painelY + 51);

  ctx.fillStyle = temCorrente ? "#facc15" : "#d1d5db";
  ctx.font = "bold 11px monospace";
  ctx.fillText(temCorrente ? "CORRENTE [J/K]" : "SOCO [J] CHUTE [K]", 532, painelY + 76);

  const centroX = 335;
  const centroY = painelY + 60;
  const raio = 49;

  ctx.fillStyle = "#52525b";
  ctx.beginPath();
  ctx.arc(centroX, centroY, raio + 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111111";
  ctx.beginPath();
  ctx.arc(centroX, centroY, raio, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  for (let a = 0.75 * Math.PI; a <= 2.25 * Math.PI; a += (1.5 * Math.PI) / 10) {
    ctx.beginPath();
    ctx.moveTo(centroX + Math.cos(a) * (raio - 10), centroY + Math.sin(a) * (raio - 10));
    ctx.lineTo(centroX + Math.cos(a) * (raio - 3), centroY + Math.sin(a) * (raio - 3));
    ctx.stroke();
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 10px monospace";
  ctx.fillText("20", centroX - 31, centroY + 18);
  ctx.fillText("60", centroX - 33, centroY - 11);
  ctx.fillText("100", centroX - 11, centroY - 26);
  ctx.fillText("140", centroX + 16, centroY + 18);

  ctx.fillStyle = "#1f2937";
  ctx.fillRect(centroX - 22, centroY + 16, 44, 15);
  ctx.strokeStyle = "#6b7280";
  ctx.lineWidth = 1;
  ctx.strokeRect(centroX - 22, centroY + 16, 44, 15);

  ctx.fillStyle = "#e5e7eb";
  ctx.font = "bold 9px monospace";
  const kmFormatado = distanciaKm.toFixed(1).padStart(4, "0");
  ctx.fillText(kmFormatado, centroX - 18, centroY + 27);

  const proporcaoVel = Math.max(
    0,
    Math.min(1, (velocidade - velocidadeMin) / (velocidadeMax - velocidadeMin))
  );
  const anguloPonteiro = 0.75 * Math.PI + proporcaoVel * (1.5 * Math.PI);

  ctx.strokeStyle = "#ff2222";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(centroX, centroY);
  ctx.lineTo(
    centroX + Math.cos(anguloPonteiro) * (raio - 9),
    centroY + Math.sin(anguloPonteiro) * (raio - 9)
  );
  ctx.stroke();

  ctx.fillStyle = "#cccccc";
  ctx.beginPath();
  ctx.arc(centroX, centroY, 5, 0, Math.PI * 2);
  ctx.fill();

  const totalSeg = Math.floor(tempoSegundos);
  const mins = String(Math.floor(totalSeg / 60)).padStart(2, "0");
  const segs = String(totalSeg % 60).padStart(2, "0");

  ctx.fillStyle = "#111111";
  ctx.fillRect(405, painelY + 34, 115, 32);
  ctx.fillStyle = "#00ff00";
  ctx.font = "bold 20px monospace";
  ctx.fillText(`${mins}:${segs}`, 430, painelY + 56);

  const { posicaoAtual, totalPilotos } = obterPosicaoCorrida();
  ctx.fillStyle = "#111111";
  ctx.fillRect(405, painelY + 72, 115, 32);
  ctx.fillStyle = "#ffcc00";
  ctx.font = "bold 16px monospace";
  ctx.fillText(`${String(posicaoAtual).padStart(2, "0")}/${totalPilotos}`, 432, painelY + 93);

  if (policial.ativo && !corridaEncerrada && Math.floor(tempoSegundos * 6) % 2 === 0) {
    ctx.fillStyle = "rgba(185, 28, 28, 0.85)";
    ctx.fillRect(250, 18, 300, 28);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(250, 18, 300, 28);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px monospace";
    ctx.fillText("POLICIA NA PERSEGUICAO!", 305, 37);
  }

  if (timerMsgCombate > 0 && msgCombate && !corridaEncerrada) {
    ctx.fillStyle = "rgba(17, 24, 39, 0.88)";
    ctx.fillRect(215, 54, 370, 26);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 2;
    ctx.strokeRect(215, 54, 370, 26);
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 12px monospace";
    ctx.fillText(msgCombate, 235, 71);
  }

  if (corridaEncerrada) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
    ctx.fillRect(150, 115, 500, 215);
    ctx.strokeStyle = "#ffcc00";
    ctx.lineWidth = 3;
    ctx.strokeRect(150, 115, 500, 215);

    const tituloFinal =
      motivoEncerramento === "PRESO"
        ? "VOCE FOI PEGO PELA POLICIA!"
        : motivoEncerramento === "QUEDA_TOTAL"
        ? "FIM DE CORRIDA - QUEDA!"
        : "FINISHED! 55.0 KM CONCLUIDOS!";

    ctx.fillStyle = motivoEncerramento === "META" ? "#ffcc00" : "#f87171";
    ctx.font = "bold 24px monospace";
    ctx.fillText(tituloFinal, 185, 162);

    const ultrapassadas = totalPilotos - posicaoAtual;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px monospace";
    ctx.fillText(`POSICAO FINAL: ${posicaoAtual}/${totalPilotos}`, 250, 200);
    ctx.fillText(`DERRUBADOS: ${rivaisDerrubados} | GRANA: $${dinheiro}`, 215, 230);
    ctx.fillText(`MOTOS A FRENTE PASSADAS: ${ultrapassadas}/12`, 215, 260);

    ctx.fillStyle = "#00ff00";
    ctx.font = "bold 15px monospace";
    ctx.fillText("PRESSIONE [R] PARA CORRER NOVAMENTE", 215, 302);
  }
}

function desenhar(agoraMs = 0) {
  atualizarPista();
  atualizarMoto();
  atualizarSomMotor(agoraMs);

  const horizonteY = Math.max(145, Math.min(242, 200 - elevacaoAtual));
  desenharCenarioFundo(horizonteY);

  desenharEstrada();
  desenharElementosCenario();

  desenharMoto();
  desenharPainel();

  deslocamento += velocidade;
  requestAnimationFrame(desenhar);
}

requestAnimationFrame(desenhar);
