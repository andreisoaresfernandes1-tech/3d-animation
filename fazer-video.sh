#!/usr/bin/env bash
# Faz tudo de uma vez: instala o que falta, renderiza o vídeo (16:9 e 9:16),
# gera a narração, mixa os efeitos e corta os clipes de cada cena.
#
# Uso:  ./fazer-video.sh              (completo: 16:9 + 9:16 + narração nova)
#       ./fazer-video.sh --so-16x9    (pula o vertical, mais rápido)
#       ./fazer-video.sh --sem-tts    (reaproveita os .mp3 de narracao/audio)
#
# Saída: video/tunel.mp4, video/tunel-vertical.mp4,
#        video/tunel-narrado.mp4, video/tunel-vertical-narrado.mp4,
#        video/cenas/*.mp4 e video/cenas-vertical/*.mp4
set -euo pipefail
cd "$(dirname "$0")"

VERTICAL=1; TTS=--tts
for a in "$@"; do
  case "$a" in
    --so-16x9) VERTICAL=0 ;;
    --sem-tts) TTS= ;;
    *) echo "opção desconhecida: $a"; exit 1 ;;
  esac
done

passo() { echo; echo "==> $*"; }

passo "Conferindo ferramentas"
command -v node   >/dev/null || { echo "Falta o Node 18+"; exit 1; }
command -v ffmpeg >/dev/null || { echo "Falta o ffmpeg"; exit 1; }
[ -d node_modules/three ] || npm install --no-audit --no-fund
node -e "require('playwright')" 2>/dev/null || npm install --no-save --no-audit --no-fund playwright
if [ -n "$TTS" ]; then
  python3 -c "import edge_tts" 2>/dev/null || pip install -q edge-tts
fi

passo "Renderizando 16:9 (1280×720)"
node render.mjs --out video/tunel.mp4

if [ "$VERTICAL" = 1 ]; then
  passo "Renderizando 9:16 (1080×1920)"
  node render.mjs --vertical --out video/tunel-vertical.mp4
fi

passo "Narração, efeitos e clipes das cenas"
python3 narracao/montar.py $TTS

passo "Pronto!"
ls -lh video/*.mp4 video/cenas*/ 2>/dev/null
