# Como construir um túnel subterrâneo — animação 3D

Vídeo didático (2:09, 1280×720, 30 fps) feito com Three.js, numa vista em corte do terreno.
Primeiro constroem o túnel **do jeito errado** e ele desaba e inunda. Depois o vídeo **rebobina**
e mostra a construção **do jeito certo** com tuneladora (TBM). O roteiro completo, com narração,
está em [ROTEIRO.md](ROTEIRO.md).

| Tempo | Parte |
|---|---|
| 0:00–0:06 | Abertura |
| 0:06–0:40 | Jeito errado: sem sondagem, poço sem contenção, túnel sem revestimento → desabamento |
| 0:40–0:45 | Rebobinando |
| 0:45–2:09 | Jeito certo: 8 etapas, da sondagem ao primeiro trem |

## Ver no navegador

```bash
npx serve .        # ou qualquer servidor estático
# abra http://localhost:3000  (use ?t=45 para começar no jeito certo)
```

## Renderizar o MP4

```bash
npm install
node render.mjs --out video/tunel.mp4          # vídeo completo
node render.mjs --start 33 --end 48 --out e4.mp4   # só um trecho
node render.mjs --still 10,44 --png quadro.png     # quadros soltos
```

Requer Node 18+, ffmpeg e Playwright (Chromium). Tudo na cena é função do tempo,
então cada renderização é idêntica.
