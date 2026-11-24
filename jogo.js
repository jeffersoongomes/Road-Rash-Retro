const canvas = document.getElementById("jogo");
const ctx = canvas.getContext("2d");

let deslocamento = 0;
let velocidade = 1.0;
const velocidadeMin = 0.6;
const velocidadeMax = 4.5;

let motoX = 400;
const motoY = 425;
let inclinacao = 0;
let energiaJogador = 100;
let tempoInvencivel = 0;

// Distância da corrida (55 KM) com avanço lento e realista
let distanciaKm = 0;
const distanciaMetaKm = 55;
let corridaEncerrada = false;
let tempoSegundos = 0;

// Variáveis das curvas da pista (com trechos de reta)
let curvaAtual = 0;
let curvaAlvo = 0;
let distanciaSegmento = 0;
let proximoTrecho = 850;
let centroPistaNaMoto = 400;

// Objetos laterais (árvores e placas) em profundidade
const profundidadeMax = 700;
const objetosLateral = [];

function criarObjetoLateral(zInicial = 1) {
  const lado = Math.random() < 0.5 ? -1 : 1;
  const tipo = Math.random() < 0.72 ? "arvore" : "placa";
  const distanciaFora = 1.2 + Math.random() * 0.65;
  return { lado, tipo, distanciaFora, z: zInicial };
}

for (let i = 0; i < 14; i++) {
  objetosLateral.push(criarObjetoLateral((i / 14) * profundidadeMax));
}

// Apenas 1 carro por vez, vindo de frente, bem espaçado, em uma faixa lateral ou na outra
const coresCarros = ["#c53030", "#d69e2e", "#e2e8f0", "#4a5568"];
const faixasCarroFrente = [-0.46, 0.46];

let carroFrente = {
  ativo: false,
  z: 1,
  posRelativa: -0.46,
  cor: "#c53030",
  espera: 420
};

function agendarProximoCarroFrente() {
  carroFrente = {
    ativo: false,
    z: 1,
    posRelativa: faixasCarroFrente[Math.floor(Math.random() * faixasCarroFrente.length)],
    cor: coresCarros[Math.floor(Math.random() * coresCarros.length)],
    espera: 560 + Math.random() * 480
  };
}

// 12 motos rivais (todas azuis, do mesmo porte da moto do jogador e em linhas estáveis na pista)
const totalRivais = 12;
const linhasRivais = [-0.42, 0.42];
const motosRivais = [];

for (let i = 0; i < totalRivais; i++) {
  const linhaBase = linhasRivais[i % linhasRivais.length];
  motosRivais.push({
    id: i + 1,
    ultrapassada: false,
    kmAlvo: ((i + 1) / (totalRivais + 1)) * distanciaMetaKm,
    linhaBase,
    posRelativa: linhaBase,
    alvoPosRelativa: linhaBase
  });
}

function obterPosicaoCorrida() {
  let restantes = 0;
  for (const rival of motosRivais) {
    if (!rival.ultrapassada) restantes++;
  }
  const posicaoAtual = restantes + 1;
  return { posicaoAtual, totalPilotos: totalRivais + 1, restantes };
}

// Controle das teclas pressionadas
const teclas = {
  esquerda: false,
  direita: false,
  cima: false,
  baixo: false
};

function reiniciarCorrida() {
  deslocamento = 0;
  velocidade = 1.0;
  motoX = 400;
  inclinacao = 0;
  energiaJogador = 100;
  tempoInvencivel = 0;
  distanciaKm = 0;
  tempoSegundos = 0;
  corridaEncerrada = false;
  curvaAtual = 0;
  curvaAlvo = 0;
  distanciaSegmento = 0;
  proximoTrecho = 850;
  agendarProximoCarroFrente();

  for (let i = 0; i < motosRivais.length; i++) {
    const linhaBase = linhasRivais[i % linhasRivais.length];
    motosRivais[i].ultrapassada = false;
    motosRivais[i].linhaBase = linhaBase;
    motosRivais[i].posRelativa = linhaBase;
    motosRivais[i].alvoPosRelativa = linhaBase;
  }
}

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") teclas.esquerda = true;
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") teclas.direita = true;
  if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") teclas.cima = true;
  if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") teclas.baixo = true;
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
  const proximoRival = motosRivais.find((r) => !r.ultrapassada);
  if (!proximoRival) return;

  const gapKm = Math.max(0, proximoRival.kmAlvo - distanciaKm);
  const proximidade = Math.max(0, 1 - gapKm / 3.5);
  const zRival = Math.max(15, proximidade * (profundidadeMax * 0.85));

  // Se houver carro vindo de frente na mesma faixa lateral e perto do rival, desvia para o outro lado
  if (carroFrente.ativo && gapKm < 3.5) {
    const distanciaZ = Math.abs(carroFrente.z - zRival);
    const mesmaFaixa = Math.abs(carroFrente.posRelativa - proximoRival.alvoPosRelativa) < 0.35;

    if (distanciaZ < 170 && mesmaFaixa) {
      proximoRival.alvoPosRelativa = carroFrente.posRelativa > 0 ? -0.42 : 0.42;
    } else if (distanciaZ > 220) {
      proximoRival.alvoPosRelativa = proximoRival.linhaBase;
    }
  } else {
    proximoRival.alvoPosRelativa = proximoRival.linhaBase;
  }

  // Transição suave sem tremor
  proximoRival.posRelativa += (proximoRival.alvoPosRelativa - proximoRival.posRelativa) * 0.06;
}

function atualizarPista() {
  if (corridaEncerrada) return;

  tempoSegundos += 1 / 60;
  distanciaSegmento += velocidade;

  if (distanciaSegmento >= proximoTrecho) {
    distanciaSegmento = 0;
    proximoTrecho = 750 + Math.random() * 800;

    const opcoesCurva = [0, 0, -1.8, 1.8, 0, -3.0, 3.0, 0];
    curvaAlvo = opcoesCurva[Math.floor(Math.random() * opcoesCurva.length)];
  }

  curvaAtual += (curvaAlvo - curvaAtual) * 0.014;

  // Árvores e placas
  for (let i = 0; i < objetosLateral.length; i++) {
    objetosLateral[i].z += velocidade * 0.44;
    if (objetosLateral[i].z >= profundidadeMax) {
      objetosLateral[i] = criarObjetoLateral(1);
    }
  }

  // Carro vindo de frente: apenas 1 por vez, bem espaçado, em uma faixa lateral ou na outra
  if (!carroFrente.ativo) {
    carroFrente.espera -= velocidade;
    if (carroFrente.espera <= 0) {
      carroFrente.ativo = true;
      carroFrente.z = 1;
    }
  } else {
    carroFrente.z += velocidade * 0.44 + 1.35;
    if (carroFrente.z >= profundidadeMax) {
      agendarProximoCarroFrente();
    }
  }

  // KM percorrido bem mais lento e fiel à velocidade real
  const proporcaoVel = Math.max(0, (velocidade - velocidadeMin) / (velocidadeMax - velocidadeMin));
  const kmPorSegundo = 0.012 + proporcaoVel * 0.045;
  distanciaKm += kmPorSegundo / 60;

  if (distanciaKm >= distanciaMetaKm) {
    distanciaKm = distanciaMetaKm;
    corridaEncerrada = true;
  }

  for (const rival of motosRivais) {
    if (!rival.ultrapassada && distanciaKm >= rival.kmAlvo) {
      rival.ultrapassada = true;
    }
  }

  atualizarRivais();
}

function atualizarMoto() {
  if (tempoInvencivel > 0) tempoInvencivel--;

  if (corridaEncerrada) {
    velocidade = Math.max(0, velocidade - 0.03);
    inclinacao *= 0.85;
    return;
  }

  if (teclas.cima) {
    velocidade = Math.min(velocidade + 0.006, velocidadeMax);
  } else if (teclas.baixo) {
    velocidade = Math.max(velocidade - 0.025, velocidadeMin);
  } else {
    if (velocidade > 1.0) velocidade -= 0.006;
  }

  motoX -= curvaAtual * (velocidade * 0.07);

  if (teclas.esquerda) {
    motoX -= 2;
    inclinacao = Math.max(inclinacao - 0.02, -0.24);
  } else if (teclas.direita) {
    motoX += 2;
    inclinacao = Math.min(inclinacao + 0.02, 0.24);
  } else {
    inclinacao *= 0.85;
  }

  const margemPista = 175;
  const limiteEsquerdo = centroPistaNaMoto - margemPista;
  const limiteDireito = centroPistaNaMoto + margemPista;

  if (motoX < limiteEsquerdo) motoX = limiteEsquerdo;
  if (motoX > limiteDireito) motoX = limiteDireito;
}

function desenharEstrada() {
  const horizonteY = 200;
  const baseY = 485;
  const alturaPista = baseY - horizonteY;

  for (let y = horizonteY; y < baseY; y += 2) {
    const t = (y - horizonteY) / alturaPista;

    const deslocamentoCurva = curvaAtual * 55 * Math.pow(1 - t, 2);
    const centroX = 400 + deslocamentoCurva;

    if (Math.abs(y - motoY) <= 2) {
      centroPistaNaMoto = centroX;
    }

    const meiaLargura = 50 + t * 250;
    const larguraBorda = 4 + t * 6;

    ctx.fillStyle = "#555555";
    ctx.fillRect(centroX - meiaLargura, y, meiaLargura * 2, 2);

    ctx.fillStyle = "#FFFF00";
    ctx.fillRect(centroX - meiaLargura - larguraBorda / 2, y, larguraBorda, 2);
    ctx.fillRect(centroX + meiaLargura - larguraBorda / 2, y, larguraBorda, 2);

    const z = (deslocamento * 0.045) - Math.pow(t, 1.35) * 18;
    const fase = ((Math.floor(z) % 10) + 10) % 10;
    if (fase < 5) {
      const larguraFaixa = 2 + t * 8;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(centroX - larguraFaixa / 2, y, larguraFaixa, 2);
    }
  }
}

function desenharCarroFrenteItem(carro, x, yBase, escala) {
  ctx.save();
  ctx.translate(x, yBase);
  ctx.scale(escala, escala);

  ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
  ctx.beginPath();
  ctx.ellipse(0, 2, 48, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#181818";
  ctx.fillRect(-44, -14, 10, 14);
  ctx.fillRect(34, -14, 10, 14);

  ctx.fillStyle = carro.cor;
  ctx.fillRect(-38, -28, 76, 22);

  ctx.fillStyle = "#2d3748";
  ctx.fillRect(-36, -10, 72, 5);

  ctx.fillStyle = "#2d3748";
  ctx.fillRect(-28, -42, 56, 14);

  ctx.fillStyle = carro.cor;
  ctx.fillRect(-30, -45, 60, 5);

  ctx.fillStyle = "#fff59d";
  ctx.fillRect(-33, -21, 12, 6);
  ctx.fillRect(21, -21, 12, 6);

  ctx.fillStyle = "#1a202c";
  ctx.fillRect(-14, -20, 28, 5);

  ctx.restore();
}

function desenharMotoRivalItem(rival, x, yBase, escala) {
  ctx.save();
  ctx.translate(x, yBase);
  ctx.scale(escala, escala);

  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 26, 22, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(-10, 4, 20, 22);

  ctx.fillStyle = "#b0b0b0";
  ctx.fillRect(9, 10, 5, 13);

  ctx.fillStyle = "#1d4ed8";
  ctx.beginPath();
  ctx.moveTo(-12, 12);
  ctx.lineTo(-9, -8);
  ctx.lineTo(9, -8);
  ctx.lineTo(12, 12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#93c5fd";
  ctx.fillRect(-5, -6, 10, 6);
  ctx.fillRect(-11, 2, 4, 7);
  ctx.fillRect(7, 2, 4, 7);

  ctx.strokeStyle = "#222222";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-15, -7);
  ctx.lineTo(15, -7);
  ctx.stroke();

  ctx.fillStyle = "#1e3a8a";
  ctx.beginPath();
  ctx.ellipse(0, -16, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#60a5fa";
  ctx.fillRect(-7, -21, 14, 7);

  ctx.fillStyle = "#2563eb";
  ctx.beginPath();
  ctx.arc(0, -31, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#bfdbfe";
  ctx.fillRect(-7, -33, 14, 3);

  ctx.restore();
}

function desenharElementosCenario() {
  const horizonteY = 200;
  const baseY = 485;
  const alturaPista = baseY - horizonteY;

  const itens = [];

  for (const obj of objetosLateral) {
    const linear = obj.z / profundidadeMax;
    const t = Math.pow(linear, 1.55);
    const yBase = horizonteY + t * alturaPista;
    if (yBase <= horizonteY || yBase > baseY) continue;

    const deslocamentoCurva = curvaAtual * 55 * Math.pow(1 - t, 2);
    const centroX = 400 + deslocamentoCurva;
    const meiaLargura = 50 + t * 250;
    const x = centroX + obj.lado * meiaLargura * obj.distanciaFora;
    const escala = 0.15 + t * 0.75;

    itens.push({ kind: "lateral", obj, x, yBase, escala, z: obj.z });
  }

  const proximoRival = motosRivais.find((r) => !r.ultrapassada);
  if (proximoRival && !corridaEncerrada) {
    const gapKm = Math.max(0, proximoRival.kmAlvo - distanciaKm);
    if (gapKm < 3.5) {
      const proximidade = 1 - gapKm / 3.5;
      const zRival = Math.max(15, proximidade * (profundidadeMax * 0.85));
      const linear = zRival / profundidadeMax;
      const t = Math.pow(linear, 1.55);
      const yBase = horizonteY + t * alturaPista;

      if (yBase > horizonteY && yBase <= baseY) {
        const deslocamentoCurva = curvaAtual * 55 * Math.pow(1 - t, 2);
        const centroX = 400 + deslocamentoCurva;
        const meiaLargura = 50 + t * 250;
        const x = centroX + proximoRival.posRelativa * meiaLargura;
        const escala = 0.22 + t * 0.92;

        itens.push({ kind: "rival", rival: proximoRival, x, yBase, escala, z: zRival });
      }
    }
  }

  if (carroFrente.ativo && !corridaEncerrada) {
    const linear = carroFrente.z / profundidadeMax;
    const t = Math.pow(linear, 1.55);
    const yBase = horizonteY + t * alturaPista;

    if (yBase > horizonteY && yBase <= baseY) {
      const deslocamentoCurva = curvaAtual * 55 * Math.pow(1 - t, 2);
      const centroX = 400 + deslocamentoCurva;
      const meiaLargura = 50 + t * 250;
      const x = centroX + carroFrente.posRelativa * meiaLargura;
      const escala = 0.18 + t * 0.95;

      if (t > 0.78 && t < 0.96 && tempoInvencivel === 0) {
        const larguraColisao = 42 * escala;
        if (Math.abs(motoX - x) < larguraColisao) {
          velocidade = Math.max(velocidadeMin, velocidade * 0.6);
          energiaJogador = Math.max(0, energiaJogador - 12);
          tempoInvencivel = 40;
          agendarProximoCarroFrente();
        } else {
          itens.push({ kind: "carroFrente", carro: carroFrente, x, yBase, escala, z: carroFrente.z });
        }
      } else {
        itens.push({ kind: "carroFrente", carro: carroFrente, x, yBase, escala, z: carroFrente.z });
      }
    }
  }

  itens.sort((a, b) => a.z - b.z);

  for (const item of itens) {
    if (item.kind === "carroFrente") {
      desenharCarroFrenteItem(item.carro, item.x, item.yBase, item.escala);
      continue;
    }

    if (item.kind === "rival") {
      desenharMotoRivalItem(item.rival, item.x, item.yBase, item.escala);
      continue;
    }

    const obj = item.obj;
    ctx.save();
    ctx.translate(item.x, item.yBase);
    ctx.scale(item.escala, item.escala);

    if (obj.tipo === "arvore") {
      ctx.fillStyle = "#6b3e26";
      ctx.fillRect(-6, -34, 12, 34);

      ctx.fillStyle = "#145a24";
      ctx.beginPath();
      ctx.arc(0, -44, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#1e7e34";
      ctx.beginPath();
      ctx.arc(-6, -50, 18, 0, Math.PI * 2);
      ctx.arc(7, -47, 16, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#b5b5b5";
      ctx.fillRect(-16, -24, 3, 24);
      ctx.fillRect(13, -24, 3, 24);

      ctx.fillStyle = "#ffd000";
      ctx.fillRect(-22, -46, 44, 24);
      ctx.strokeStyle = "#222222";
      ctx.lineWidth = 2;
      ctx.strokeRect(-22, -46, 44, 24);

      ctx.fillStyle = "#222222";
      ctx.fillRect(-14, -42, 6, 16);
      ctx.fillRect(8, -42, 6, 16);
    }

    ctx.restore();
  }
}

function desenharMoto() {
  if (tempoInvencivel > 0 && Math.floor(tempoInvencivel / 4) % 2 === 0) {
    return;
  }

  ctx.save();
  ctx.translate(motoX, motoY);

  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 26, 22, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(inclinacao);

  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(-10, 4, 20, 22);

  ctx.fillStyle = "#b0b0b0";
  ctx.fillRect(9, 10, 5, 13);

  ctx.fillStyle = "#d91e2a";
  ctx.beginPath();
  ctx.moveTo(-12, 12);
  ctx.lineTo(-9, -8);
  ctx.lineTo(9, -8);
  ctx.lineTo(12, 12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-5, -6, 10, 6);
  ctx.fillRect(-11, 2, 4, 7);
  ctx.fillRect(7, 2, 4, 7);

  ctx.strokeStyle = "#222222";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-15, -7);
  ctx.lineTo(15, -7);
  ctx.stroke();

  ctx.fillStyle = "#f2f2f2";
  ctx.beginPath();
  ctx.ellipse(0, -16, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#d91e2a";
  ctx.fillRect(-7, -21, 14, 7);

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, -31, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#d91e2a";
  ctx.fillRect(-7, -33, 14, 3);

  ctx.restore();
}

function desenharRetrovisor(x, y, largura, altura) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, largura, altura);
  ctx.clip();

  ctx.fillStyle = "#87CEEB";
  ctx.fillRect(x, y, largura, altura * 0.45);
  ctx.fillStyle = "#228B22";
  ctx.fillRect(x, y + altura * 0.45, largura, altura * 0.55);

  const offsetEspelho = (centroPistaNaMoto - motoX) * 0.08 - curvaAtual * 3;
  ctx.fillStyle = "#555555";
  ctx.beginPath();
  ctx.moveTo(x + largura * 0.42 + offsetEspelho, y + altura * 0.45);
  ctx.lineTo(x + largura * 0.58 + offsetEspelho, y + altura * 0.45);
  ctx.lineTo(x + largura * 0.85 + offsetEspelho, y + altura);
  ctx.lineTo(x + largura * 0.15 + offsetEspelho, y + altura);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#FFFF00";
  let cicloEspelho = ((deslocamento * 0.18) % 16 + 16) % 16;
  for (let i = 0; i < 3; i++) {
    let fy = y + altura * 0.5 + i * 16 + cicloEspelho;
    if (fy < y + altura) {
      ctx.fillRect(x + largura / 2 - 1 + offsetEspelho, fy, 2, 8);
    }
  }

  ctx.restore();

  ctx.strokeStyle = "#222222";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, largura, altura);
}

function desenharPainel() {
  const painelY = 485;
  const painelAltura = 115;

  ctx.fillStyle = "#9e9e9e";
  ctx.fillRect(0, painelY, 800, painelAltura);

  ctx.fillStyle = "#222222";
  ctx.fillRect(0, painelY, 800, 4);

  desenharRetrovisor(18, painelY + 34, 155, 72);
  desenharRetrovisor(627, painelY + 34, 155, 72);

  ctx.fillStyle = "#111111";
  ctx.fillRect(18, painelY + 8, 250, 22);
  ctx.fillRect(178, painelY + 34, 90, 26);

  ctx.fillStyle = "#00cc00";
  ctx.fillRect(21, painelY + 11, (244 * energiaJogador) / 100, 16);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px monospace";
  ctx.fillText("PLAYER 1", 183, painelY + 52);

  ctx.fillStyle = "#111111";
  ctx.fillRect(532, painelY + 8, 250, 22);
  ctx.fillRect(532, painelY + 34, 90, 26);

  ctx.fillStyle = "#00cc00";
  ctx.fillRect(535, painelY + 11, 244, 16);

  ctx.fillStyle = "#ffffff";
  ctx.fillText("BIKE", 557, painelY + 52);

  const centroX = 335;
  const centroY = painelY + 60;
  const raio = 49;

  ctx.fillStyle = "#555555";
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

  const proporcaoVel = Math.max(0, Math.min(1, (velocidade - velocidadeMin) / (velocidadeMax - velocidadeMin)));
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

  if (corridaEncerrada) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillRect(160, 125, 480, 185);
    ctx.strokeStyle = "#ffcc00";
    ctx.lineWidth = 3;
    ctx.strokeRect(160, 125, 480, 185);

    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 28px monospace";
    ctx.fillText("55.0 KM CONCLUIDOS!", 242, 175);

    const ultrapassadas = totalPilotos - posicaoAtual;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px monospace";
    ctx.fillText(`POSICAO FINAL: ${posicaoAtual}/${totalPilotos}`, 265, 215);
    ctx.fillText(`MOTOS ULTRAPASSADAS: ${ultrapassadas}/12`, 242, 245);

    ctx.fillStyle = "#00ff00";
    ctx.font = "bold 15px monospace";
    ctx.fillText("PRESSIONE [R] PARA CORRER NOVAMENTE", 218, 285);
  }
}

function desenhar() {
  atualizarPista();
  atualizarMoto();

  ctx.fillStyle = "#87CEEB";
  ctx.fillRect(0, 0, 800, 200);

  ctx.fillStyle = "#228B22";
  ctx.fillRect(0, 200, 800, 285);

  desenharEstrada();
  desenharElementosCenario();

  desenharMoto();
  desenharPainel();

  deslocamento += velocidade;
  requestAnimationFrame(desenhar);
}

desenhar();