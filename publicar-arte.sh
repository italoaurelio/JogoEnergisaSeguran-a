#!/bin/bash
# Leva o que saiu do Blender para public/, comprimindo as texturas e a malha.
#
# --join false e obrigatorio nos dois: juntar malhas apagaria a separacao dos
# riscos no cenario, e no personagem apagaria a separacao das pecas de EPI -
# que e o que permite ligar e desligar cada peca conforme o jogador veste.
set -e
cd "$(dirname "$0")"
mkdir -p public/modelos

comprimir() {
  local origem="$1" destino="$2" tam="$3"
  [ -f "$origem" ] || { echo "sem $origem, pulando"; return; }
  # --palette false e tao obrigatorio quanto --join false: o palette funde
  # materiais que so diferem na cor base numa textura unica, e as pecas de EPI
  # nao tem UV (so a pele e o olho tem, que sao os assados). Sem UV a paleta
  # amostra o pixel errado e a roupa sai branca.
  npx -y @gltf-transform/cli@4 optimize "$origem" "$destino" \
    --compress draco --texture-compress webp --texture-size "$tam" \
    --join false --simplify false --palette false
}

# sem `;;&`: o /bin/bash do macOS e 3.2 e nao tem fallthrough em case
alvo="${1:-tudo}"

if [ "$alvo" = "cenario" ] || [ "$alvo" = "tudo" ]; then
  comprimir arte/export/cenario.glb public/modelos/cenario.glb 1024
  [ -f arte/export/riscos.json ] && cp arte/export/riscos.json public/modelos/
fi

if [ "$alvo" = "personagem" ] || [ "$alvo" = "tudo" ]; then
  comprimir arte/export/personagem.glb public/modelos/personagem.glb 1024
  [ -f arte/export/personagem.json ] && cp arte/export/personagem.json public/modelos/
fi

if [ "$alvo" = "motorista" ] || [ "$alvo" = "tudo" ]; then
  comprimir arte/export/motorista.glb public/modelos/motorista.glb 1024
  [ -f arte/export/motorista.json ] && cp arte/export/motorista.json public/modelos/
fi

if [ "$alvo" = "cabine" ] || [ "$alvo" = "tudo" ]; then
  comprimir arte/export/cabine.glb public/modelos/cabine.glb 1024
  [ -f arte/export/cabine.json ] && cp arte/export/cabine.json public/modelos/
fi

if [ "$alvo" = "via" ] || [ "$alvo" = "tudo" ]; then
  comprimir arte/export/via.glb public/modelos/via.glb 1024
  [ -f arte/export/via.json ] && cp arte/export/via.json public/modelos/
fi

if [ "$alvo" = "ocorrencia" ] || [ "$alvo" = "tudo" ]; then
  comprimir arte/export/ocorrencia.glb public/modelos/ocorrencia.glb 1024
  [ -f arte/export/ocorrencia.json ] && cp arte/export/ocorrencia.json public/modelos/
fi

if [ "$alvo" = "eletricista" ] || [ "$alvo" = "tudo" ]; then
  comprimir arte/export/eletricista.glb public/modelos/eletricista.glb 512
  [ -f arte/export/eletricista.json ] && cp arte/export/eletricista.json public/modelos/
fi

echo "publicado:"
ls -lh public/modelos/
