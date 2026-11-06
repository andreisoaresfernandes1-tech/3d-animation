# Instruções para o Claude neste repositório

Animação 3D didática feita com Three.js (`main.js` + `index.html`), renderizada quadro a quadro
para MP4 (`render.mjs`), com narração em pt-BR e efeitos sonoros (`narracao/`).
Fale com o usuário em português.

## Quando o usuário disser "pronto"

"Pronto" quer dizer: **faça as cenas e o vídeo agora, sem perguntar nada.** Siga esta ordem:

1. Leia `PROXIMO-VIDEO.md`.
   - Se a seção **Ideia** estiver preenchida (tema novo): escreva o roteiro cena a cena em
     `ROTEIRO.md` (substitua o do túnel; ele continua no histórico do git), atualize
     `narracao/falas.json`, construa as cenas em `main.js` (ajuste `DURATION`), e ajuste em
     `narracao/montar.py` as constantes `DUR`/`INTRO`/`STEP`/`T_S`, os efeitos sonoros e a lista
     `CENAS` (nome e início/fim de cada clipe). Atualize o README.
   - Se a seção **Ideia** estiver vazia: só renderize de novo o vídeo atual (passo 3).
   - Se houver itens em **Ajustes**, aplique-os primeiro.
2. Confira alguns quadros antes do render longo:
   `node render.mjs --still 3,20,60,100 --png /tmp/q.png` (e `--vertical` também) e olhe as imagens.
   Corrija o que estiver cortado, sobreposto ou ilegível.
3. Rode `./fazer-video.sh` **em segundo plano** (Bash com `run_in_background`, timeout máximo):
   são ~4 mil quadros por formato e cada formato leva mais de 20 min na nuvem. Use `--so-16x9`
   só se o usuário pedir pressa. Não faça commit de vídeo pela metade.
4. Envie ao usuário `video/tunel-narrado.mp4` e `video/tunel-vertical-narrado.mp4`
   (ou os nomes novos) e liste os clipes de `video/cenas*/`.
5. Faça commit (mensagem em português) e push no branch de trabalho.
6. Limpe `PROXIMO-VIDEO.md`: mova a ideia feita para a seção **Já feitos** e deixe **Ideia**
   e **Ajustes** vazias.

## Regras do estilo (manter nos próximos vídeos)

- Tudo na cena é função do tempo `t` (`window.renderAt(t)`), para o render ser determinístico.
- Vista em corte, personagem de capacete, balões de fala, legendas curtas embaixo, contador
  de tentativas quando houver erros e acertos.
- Dois formatos: 16:9 (1280×720) e 9:16 (1080×1920, `?vertical`). Testar os dois.
- Narração: voz `pt-BR-AntonioNeural`; cada fala cabe no seu `max` em `falas.json`.
