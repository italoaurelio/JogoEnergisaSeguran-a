# Gravação de gameplay

`gravar.mjs` joga uma partida completa e grava em vídeo: vestiário,
conferência do veículo, trajeto e ocorrência, até o relatório.

```bash
npm run dev            # o servidor precisa estar no ar
node gravacao/gravar.mjs
```

O vídeo bruto sai em `gravacao/bruto/*.webm`. Para converter:

```bash
ffmpeg -i gravacao/bruto/*.webm -c:v libx264 -crf 24 -pix_fmt yuv420p \
  -movflags +faststart gravacao/jogo-seguranca-gameplay.mp4
```

Três coisas que não são óbvias:

- **O Playwright vem do projeto vizinho** (`frontIngressosEnergisa`), que já o
  tem instalado com o Chromium baixado. Não vale acrescentar 130 MB de
  dependência aqui só para gravar vídeo.
- **Roda com janela visível** (`headless: false`) de propósito: sem janela o
  Chromium cai no SwiftShader e o 3D fica lento e feio no vídeo.
- **O roteiro sai de sincronia em silêncio.** Ele clica por TEXTO, então uma
  tela refeita não quebra a gravação: ela trava esperando um botão que não
  existe mais, ou clica no botão errado. A versão anterior clicava "Ir para a
  arara de EPI" e uma altura de 1,86 m que nunca esteve no catálogo — o vídeo
  de 28/09 foi gravado com um roteiro já velho. **Depois de mexer em tela,
  abrir o vídeo e assistir**, não só olhar se o processo saiu com zero.

## O que o roteiro mostra de propósito

O piloto automático joga *bem*: respeita o limite de cada trecho, para na
faixa de pedestre, reduz na lombada e guarda distância do veículo à frente.
Ele lê o estado pelo gancho de desenvolvimento `window.__trajeto` e responde
com tecla de verdade, para a gravação mostrar o jogo reagindo a entrada real.

Fora isso, há três pausas plantadas para a câmera pegar o que importa:

1. **A bancada de etiqueta do vestiário** fica 2,1 s em quadro por peça — é
   tempo de ler o número do CA e a data do ensaio, que é o conteúdo da fase.
2. **Na pergunta da distância da sinalização**, o piloto marca de propósito a
   opção ERRADA antes da certa, e espera nas duas. É a única maneira de o
   vídeo mostrar para que serve a prévia: colado no caminhão, a vista de quem
   chega dirigindo não tem nada; recuado, o cavalete chega de longe.
3. **Ao separar a escada** no ferramental, espera 2,6 s: a escada é a única
   peça do kit com malha, e é aí que ela aparece em prévia encostada no poste.
