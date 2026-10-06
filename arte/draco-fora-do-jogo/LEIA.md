# Draco que não entra no jogo

Estes arquivos estavam em `public/draco/` e iam para o pacote sem nunca serem
pedidos. Foram MOVIDOS para cá, não apagados — o projeto não está em git.

- **Os quatro da raiz** (`draco_decoder.js`, `.wasm`, `draco_encoder.js`,
  `draco_wasm_wrapper.js`): os seis consumidores do jogo apontam todos para
  `./draco/gltf/`, nunca para `./draco/`. A pasta raiz era uma cópia inteira
  que ninguém abria.
- **`gltf/draco_encoder.js`**: o ENCODER só serve para COMPRIMIR malha. O jogo
  só descomprime. Quem comprime é o `publicar-arte.sh`, pelo
  `@gltf-transform/cli`, que traz o próprio Draco.

Somados, 2,9 MB de 14 MB do pacote — 21%.

O que o jogo precisa e continua em `public/draco/gltf/`: `draco_decoder.js`,
`draco_decoder.wasm` e `draco_wasm_wrapper.js`.

Para desfazer: devolver tudo para `public/draco/`.
