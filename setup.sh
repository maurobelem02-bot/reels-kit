#!/usr/bin/env bash
# Prepara um projeto de vídeo a partir do kit: bash reels-kit/setup.sh ~/proj
#  - copia o motor (fixo) e as ferramentas; se não houver story.js, copia o exemplo
#  - instala three@0.170 + postprocessing@6.36 (registo npm)
#  - modelos KayKit (CC0) para proj/m/ (git clone uma vez para $ASSETS)
set -euo pipefail
KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJ="${1:?uso: bash setup.sh PASTA_DO_PROJETO}"
ASSETS="${ASSETS:-$HOME/assets}"
mkdir -p "$PROJ/m" "$ASSETS"
cp -r "$KIT/motor/." "$PROJ/"
cp "$KIT/ferramentas/"* "$PROJ/"
[ -f "$PROJ/story.js" ] || cp "$KIT/exemplo/"* "$PROJ/"
cd "$PROJ"
[ -f package.json ] || npm init -y >/dev/null
[ -d node_modules/postprocessing ] || npm i -s three@0.170 postprocessing@6.36
for r in KayKit-City-Builder-Bits-1.0 KayKit-Restaurant-Bits-1.0; do
  [ -d "$ASSETS/$r" ] || git clone -q --depth 1 "https://github.com/KayKit-Game-Assets/$r" "$ASSETS/$r"
  cp "$ASSETS/$r"/addons/*/Assets/gltf/*.{gltf,bin,png} m/ 2>/dev/null || true
done
fc-list 2>/dev/null | grep -i poppins >/dev/null || echo "AVISO: falta a fonte Poppins (as legendas usam-na)"
command -v ffmpeg >/dev/null || echo "AVISO: falta o ffmpeg"
[ -x /usr/bin/google-chrome ] || [ -n "${CHROME:-}" ] || echo "AVISO: falta o Chrome (/usr/bin/google-chrome ou CHROME=...)"
echo "ok: projeto em $PROJ ($(ls m/*.gltf | wc -l) modelos). Edita só story.js; testa com: node stills.mjs st \"0,1,2\""
