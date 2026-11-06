#!/usr/bin/env bash
# Gera o pacote para venda em ../tunel-3d-pacote.zip (FORA do repositório, para não ficar público).
set -e
cd "$(dirname "$0")/.."
OUT="../tunel-3d-pacote.zip"
rm -f "$OUT"
zip -r -9 "$OUT" video ROTEIRO.md -x '*.DS_Store'
echo "Pronto: $(realpath "$OUT")"
