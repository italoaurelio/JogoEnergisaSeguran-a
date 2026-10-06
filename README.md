# Olho no Risco

Jogo de treinamento em segurança do trabalho para equipes de campo da Energisa.
O jogador chega ao local de um serviço em poste de distribuição e precisa
identificar os comportamentos inseguros antes que alguém se machuque.

Não tem tempo, não tem vidas, não tem andar. Quem joga pode ter 60 anos e nunca
ter pegado num jogo: a câmera fica parada em pontos de observação, o jogador
arrasta para olhar em volta e toca no que está errado.

## Como rodar

```bash
npm install
npm run dev          # navegador, porta 5273
npm run electron:dev # janela do Electron apontando para o dev server
```

Empacotamento:

```bash
npm run dist:win           # app Windows em empacotado/ (roda no Mac, sem instalador)
npm run dist:win:instalador # instalador NSIS — exige Windows ou Wine
```

`TOTEM=1` abre em tela cheia.

## O conteúdo

Os 9 riscos do cenário cobrem os 8 comportamentos inseguros levantados pela
segurança do trabalho. Estão em [`src/dados.ts`](src/dados.ts) — cada um com o
que está errado, por que machuca, o procedimento correto e a norma. É o arquivo
a editar quando o conteúdo mudar; nada disso está espalhado pelo código.

| Item | Risco no cenário |
|---|---|
| 1 — condução e via | Área de trabalho sem sinalização (cone tombado) |
| 2 — análise de risco | APR em branco na prancheta |
| 3 — falhas no sistema | Isolador solto sobre a cruzeta |
| 4 — não usar EPI | Capacete no chão |
| 5 — usar EPI errado | Luva isolante fora do estojo |
| 6 — ferramenta errada | Chave de grifo como alavanca · escada mal apoiada |
| 7 — transporte | Carga solta na caçamba |
| 8 — desorganização | Ferramental espalhado pelo chão |

## A arte

Tudo modelado do zero em Blender por script — não há asset comprado nem baixado
pronto. As texturas PBR vêm do Poly Haven (CC0).

```
arte/blender/comum.py     utilitários de cena, material e geometria
arte/blender/poste.py     poste DT 11/300, cruzeta, isoladores, transformador
arte/blender/cenario.py   caminhonete, escada, EPI, ferramentas, via, quadra
arte/blender/exportar.py  assa as texturas em UV e exporta o .glb
```

Fluxo para mexer na arte:

```bash
cd arte/blender
/Applications/Blender.app/Contents/MacOS/Blender -b -P cenario.py   # confere por render
/Applications/Blender.app/Contents/MacOS/Blender -b -P exportar.py  # assa e exporta
cd ../.. && npm run arte                                            # comprime e publica
```

Três armadilhas que já custaram caro e estão resolvidas no código:

- **Projeção BOX e ruído procedural não existem em glTF.** Sem assar em UV, o
  modelo chega no navegador como plástico colorido. `exportar.py` assa cor
  (com oclusão embutida), rugosidade e normal.
- **Peça criada fora da origem e girada com `rotation_euler` voa para longe**,
  porque gira em torno da origem do objeto. Use o parâmetro `rot` de
  `C.caixa`/`C.cilindro`, que gira a geometria antes de mover.
- **`optimize` do gltf-transform funde malhas por padrão.** Isso apagaria a
  separação dos riscos, que é o que permite saber no que o jogador clicou —
  por isso `publicar-arte.sh` passa `--join false`.

## Estrutura do jogo

```
src/dados.ts    conteúdo dos riscos e pontos de observação
src/Cena.tsx    cena 3D, câmera por pontos fixos, clique com tolerância
src/App.tsx     fluxo abertura → briefing → vistoria → relatório
```

O clique tem **tolerância**: alvo pequeno como a luva ou o isolador lá em cima é
quase impossível de acertar no pixel, então um toque perto de um risco visível
vale como acerto. A verificação de oclusão impede acertar a luva através da
caminhonete.
