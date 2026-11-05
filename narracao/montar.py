"""Monta a trilha de áudio (narração + efeitos) e coloca nos vídeos.

Uso:  python narracao/montar.py            (usa os .mp3 já gerados em narracao/audio)
      python narracao/montar.py --tts      (gera as falas de novo com narracao/tts.py)
Precisa de ffmpeg; para --tts, do pacote edge-tts.
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N = os.path.join(ROOT, 'narracao')
AUD = os.path.join(N, 'audio')
DUR = 136.5
INTRO, STEP, T_S = 7.0, 14.5, 79.5
sh = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True).stdout
dur = lambda f: float(sh('ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f))

falas = json.load(open(os.path.join(N, 'falas.json'), encoding='utf-8'))
if '--tts' in sys.argv or not all(os.path.exists(os.path.join(AUD, f"{f['id']}.mp3")) for f in falas):
    subprocess.run([sys.executable, os.path.join(N, 'tts.py'), os.path.join(N, 'falas.json'), AUD, 'pt-BR-AntonioNeural'], check=True)

tmp = os.path.join(N, '_tmp'); os.makedirs(tmp, exist_ok=True)
inputs, filters, labels = [], [], []

def add(path, start, chain, label):
    i = len(inputs) // 2; inputs.extend(['-i', path])
    ms = int(start * 1000)
    filters.append(f'[{i}:a]{chain},adelay={ms}|{ms}[{label}]'); labels.append(f'[{label}]')

# falas: tira silêncio das pontas e acelera se não couber no tempo da cena
for f in falas:
    src = os.path.join(AUD, f"{f['id']}.mp3"); clean = os.path.join(tmp, f"{f['id']}.wav")
    sh('ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-af',
       'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse',
       '-ar', '48000', '-ac', '2', clean)
    d = dur(clean); tempo = max(1.0, d / f['max'])
    if tempo > 1.3: print(f"aviso: {f['id']} dura {d:.1f}s para {f['max']}s (atempo {tempo:.2f})")
    print(f"{f['id']:12s} {d:5.2f}s / {f['max']:.1f}s" + (f"  → acelerado {tempo:.2f}x" if tempo > 1 else ''))
    add(clean, f['start'], f'atempo={tempo:.3f},volume=1.6', f"v{len(labels)}")

# efeitos sonoros gerados
def lavfi(name, expr, d):
    out = os.path.join(tmp, name + '.wav')
    sh('ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', expr, '-t', str(d), '-ar', '48000', '-ac', '2', out); return out
rumble = lavfi('rumble', 'anoisesrc=color=brown:amplitude=1:seed=7', 2.6)
crack = lavfi('crack', 'anoisesrc=color=white:amplitude=0.8:seed=3', 0.18)
rewind = lavfi('rewind', "aevalsrc='0.35*sin(2*PI*(1400*t-260*t*t))*(0.6+0.4*sin(2*PI*14*t))':s=48000", 2.0)
chime = lavfi('chime', "aevalsrc='0.3*(sin(2*PI*523*t)*lt(t,0.35)+sin(2*PI*659*t)*between(t,0.25,0.7)+sin(2*PI*784*t)*gt(t,0.55))*exp(-1.6*t)':s=48000", 1.8)
whoosh = lavfi('whoosh', 'anoisesrc=color=pink:amplitude=0.7:seed=5', 6.0)
for k in range(5):
    s = INTRO + k * STEP
    for j in range(3): add(crack, s + 6.9 + j * 0.55, 'highpass=f=1200,afade=t=out:st=0:d=0.18,volume=0.35', f'c{k}{j}')
    add(rumble, s + 8.6, 'lowpass=f=160,afade=t=in:d=0.05,afade=t=out:st=0.8:d=1.8,volume=2.2', f'r{k}')
    add(rewind, s + 12.5, 'afade=t=in:d=0.1,afade=t=out:st=1.6:d=0.4,volume=0.5', f'w{k}')
add(chime, T_S + 0.2, 'volume=0.9', 'ch')
add(whoosh, T_S + (74.6 - 33), 'bandpass=f=500:width_type=o:w=2,afade=t=in:d=2.5,afade=t=out:st=3.5:d=2.5,volume=1.2', 'tr')
add(chime, T_S + (85.6 - 33), 'volume=0.9', 'ch2')

graph = ';'.join(filters) + f";{''.join(labels)}amix=inputs={len(labels)}:normalize=0,alimiter=limit=0.95,apad=whole_dur={DUR}[out]"
mix = os.path.join(N, 'trilha.m4a')
sh('ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', graph, '-map', '[out]', '-t', str(DUR), '-c:a', 'aac', '-b:a', '192k', mix)
print('trilha:', mix)

# coloca o áudio nos vídeos e nas cenas
CENAS = [('cena-00-abertura', 0, 7), ('cena-01-so-cavar', 7, 21.5), ('cena-02-escoras-de-madeira', 21.5, 36), ('cena-03-teto-reto', 36, 50.5),
         ('cena-04-arco-de-tijolos', 50.5, 65), ('cena-05-tuneladora-errada', 65, 79.5), ('cena-06-jeito-certo', 79.5, DUR)]
for src, dst, cdir in [('tunel.mp4', 'tunel-narrado.mp4', 'cenas'), ('tunel-vertical.mp4', 'tunel-vertical-narrado.mp4', 'cenas-vertical')]:
    v = os.path.join(ROOT, 'video', src)
    if not os.path.exists(v): continue
    out = os.path.join(ROOT, 'video', dst)
    sh('ffmpeg', '-y', '-loglevel', 'error', '-i', v, '-i', mix, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', out)
    print('vídeo:', out)
    for name, a, b in CENAS:
        c = os.path.join(ROOT, 'video', cdir, name + '.mp4')
        sh('ffmpeg', '-y', '-loglevel', 'error', '-ss', str(a), '-to', str(b), '-i', out, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p',
           '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', c)
    print('cenas com áudio:', cdir)
