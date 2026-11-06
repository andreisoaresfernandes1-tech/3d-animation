#!/usr/bin/env bash
# Gera o produto em ../metodo-asf.zip a partir da pasta metodo-asf/ (que fica fora do Git).
set -e
cd "$(dirname "$0")/.."
OUT="metodo-asf.zip"
rm -f "$OUT"
zip -qr -9 "$OUT" metodo-asf -x '*.DS_Store'
echo "Pronto: $(realpath "$OUT") — suba no Google Drive/Dropbox e use o link direto como ZIP_URL."
