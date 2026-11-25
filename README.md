# 🍬 SuperCrush

Jogo de combinar 3 doces no estilo Candy Crush, **mobile first**, feito em HTML5 Canvas + JavaScript puro (sem build, sem dependências). Todos os doces e efeitos são desenhados por código; os sons são sintetizados com WebAudio.

**Jogar:** https://mqzgames.github.io/SuperCrush/

## Como jogar

- Arraste um doce (ou toque em dois vizinhos) para trocar de lugar e formar 3 ou mais iguais.
- Cumpra a meta da fase antes de acabarem as jogadas. Jogadas que sobram viram bônus no **Super Crush!**

## Doces especiais

| Combinação | Cria | Efeito |
|---|---|---|
| 4 em linha | Listrado | Limpa uma linha ou coluna inteira |
| Formato L ou T | Embrulhado | Explode a área 3x3 ao redor |
| 5 em linha | Bomba de chocolate | Remove todos os doces de uma cor |

Trocar dois especiais entre si gera combos: listrado + listrado (cruz), listrado + embrulhado (cruz tripla), embrulhado + embrulhado (explosão 5x5), bomba + doce (todos daquela cor), bomba + listrado/embrulhado (todos daquela cor viram especiais e explodem), bomba + bomba (limpa o tabuleiro).

## Dica

Após 5 s parado, o jogo destaca a jogada que mais ajuda a vencer a fase (não só a primeira trinca): simula cada troca, as cascatas e a melhor jogada seguinte, e pesa geleia, doces da meta, pontos, especiais e combos. Um balão explica o motivo (ex.: "Abra caminho para formar uma bomba de chocolate na próxima").

## Modo Infinito

Jogue sem limite de jogadas: a cada meta de pontos você sobe de nível e o recorde fica salvo. Quando não sobra nenhuma jogada possível (você perdeu), aparece o botão **😈 Sacanear**, que coloca especiais prontos no tabuleiro (bomba de chocolate, dupla listrada, dupla embrulhada...) para você continuar.

## Fases

60 fases que alternam três tipos de meta: **pontuação**, **coletar doces** e **limpar geleia** (geleia dupla a partir da fase 15). Progresso, estrelas e recordes ficam salvos no navegador.

## Rodar localmente

```bash
npx http-server . -p 5180
```

Depois abra http://localhost:5180.

## Instalar como app

O SuperCrush é um web app (PWA): funciona offline e pode ser instalado na tela inicial. No Android/Chrome use o botão **📲 Instalar app** da tela inicial; no iPhone toque em Compartilhar → Adicionar à Tela de Início.

## Testes

```bash
node --test tests/hint.test.mjs   # casos da dica
node tests/hint-sim.mjs 6 1-60      # bot joga as fases: dica antiga x nova
```

## Estrutura

- `js/board.js` – regras, cascatas, especiais, animações e efeitos do tabuleiro
- `js/art.js` – arte procedural dos doces
- `js/hint.js` – motor da dica (simulação sem animação; espelha as regras de `board.js`)
- `js/levels.js` – gerador de fases
- `js/audio.js` – efeitos sonoros sintetizados
- `js/main.js` – telas, mapa, HUD e modais
