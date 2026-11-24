# 🏍️ Road Rash Retro

Jogo de corrida retrô em **HTML5 Canvas** e **JavaScript puro**, inspirado nos clássicos de corrida de moto dos consoles de 8/16 bits (como *Road Rash* no Master System), com ritmo cadenciado, física de curvas e painel de instrumentos analógico/digital.

---

## ✨ Funcionalidades Atuais

* **Estrada em perspectiva:** renderização por fatias horizontais com trechos de reta, curvas dinâmicas e força centrífuga lateral na moto.
* **Cenário lateral em profundidade:** árvores e placas surgindo do horizonte até as margens da pista.
* **Trânsito e rivais:**
  * **1 carro por vez** vindo de frente em faixas laterais, bem espaçado.
  * **12 motos rivais azuis** do mesmo porte para ultrapassar ao longo da prova, com desvio quando há carro na mesma faixa.
* **Painel retrô inferior:** velocímetro de **20 a 140 KM/H** com odômetro digital embutido marcando o progresso até **55.0 KM**, cronômetro (`00:00`), posição (`13/13` até `1/13`), barras de status e retrovisores dinâmicos.
* **Tela de conclusão:** resumo ao atingir **55.0 KM** com reinício rápido (`R` ou `Enter`).

---

## 🎮 Controles

| Tecla | Ação |
| :--- | :--- |
| `W` ou `↑` | Acelerar |
| `S` ou `↓` | Frear / Reduzir |
| `A` / `D` ou `←` / `→` | Inclinar e esterçar para esquerda / direita |
| `R` ou `Enter` | Reiniciar corrida (ao concluir os 55.0 KM) |

---

## 🛠️ Tecnologias

* **HTML5** (`<canvas>` responsivo com proporção `4:3`)
* **CSS3**
* **JavaScript (Vanilla JS)**

---

## 🚀 Como Executar Localmente

1. Baixe ou clone este repositório.
2. Abra o arquivo `index.html` diretamente no seu navegador (ou utilize um servidor local / Live Server).

---

## 📌 Próximos Passos Planejados

* Combate corpo a corpo (socos e chutes contra motos rivais)
* Colisões e quedas mais elaboradas com os rivais
* Efeitos sonoros retrô e melhorias visuais

---

Desenvolvido por **Jefferson Gilvan Gomes dos Santos** ([github.com/jeffersoongomes](https://github.com/jeffersoongomes)).
