"""Modo referência: mede um Reel de que o utilizador gosta para tirar a ficha de estilo.
Uso: python3 -I ref.py ref.mp4 [pasta_saida=ref]
Saída: ref/folha.jpg (um frame a cada 0,5 s, com o tempo), ref/f_XXX.jpg (frames soltos a cada 2 s),
       ref/ficha.json (duração, cortes, cortes por 10 s, movimento por segundo, paleta 6 cores hex, nível do som).
Depois: olha para a folha com Read e escreve a ficha de estilo (2.2e)."""
import sys, os, json, subprocess, re, glob
import numpy as np
from PIL import Image

src = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else 'ref'
os.makedirs(out, exist_ok=True)
run = lambda *a: subprocess.run(a, capture_output=True, text=True)
dur = float(run('ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src).stdout.strip())

# 1. cortes (mudança de cena)
log = run('ffmpeg', '-hide_banner', '-i', src, '-vf', "select='gt(scene,0.32)',showinfo", '-an', '-f', 'null', '-').stderr
cortes = [round(float(x), 2) for x in re.findall(r'pts_time:([0-9.]+)', log)]

# 2. folha de frames (0,5 s) com o tempo escrito + frames soltos a cada 2 s
for f in glob.glob(os.path.join(out, 'f_*.jpg')): os.remove(f)
fr_s = run('ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', src).stdout.strip().split('/')
fps_v = float(fr_s[0]) / float(fr_s[1] if len(fr_s) > 1 else 1); passo = max(1, round(fps_v / 2))   # frames EXATOS a cada 0,5 s
n = max(1, int(dur * 2)); cols = 8; rows = (n + cols - 1) // cols
run('ffmpeg', '-v', 'error', '-y', '-i', src, '-vf',
    f"select='not(mod(n\\,{passo}))',drawtext=text='%{{pts\\:hms}}':x=8:y=8:fontsize=96:fontcolor=white:box=1:boxcolor=black@0.6,scale=200:-2,tile={cols}x{rows}:padding=4:color=white",
    '-frames:v', '1', '-fps_mode', 'passthrough', os.path.join(out, 'folha.jpg'))
run('ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', 'fps=0.5,scale=540:-2', os.path.join(out, 'f_%03d.jpg'))

# 3. movimento: diferença média entre frames a 10 fps (0 = parado, >15 = muito movimento)
buf = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-vf', 'fps=10,scale=90:160,format=gray', '-f', 'rawvideo', '-'],
                     capture_output=True).stdout
fr = np.frombuffer(buf, np.uint8).reshape(-1, 160, 90).astype(np.float32)
d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2)) if len(fr) > 1 else np.zeros(1)
por_seg = [round(float(d[i:i + 10].mean()), 1) for i in range(0, len(d), 10)]
parado = [round(i / 10, 1) for i in range(len(d)) if d[i] < 0.4]

# 4. paleta: 6 cores dominantes de frames espalhados
amostra = Image.new('RGB', (60 * 12, 106))
for i, t in enumerate(np.linspace(0, max(0, dur - 0.1), 12)):
    b = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.2f}', '-i', src, '-frames:v', '1', '-vf', 'scale=60:106',
                        '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    if len(b) == 60 * 106 * 3: amostra.paste(Image.frombytes('RGB', (60, 106), b), (60 * i, 0))
q = amostra.quantize(colors=6, method=Image.Quantize.MEDIANCUT)
pal = q.getpalette()[:18]; cont = sorted(q.getcolors(), reverse=True)
paleta = [{'hex': '#%02x%02x%02x' % tuple(pal[3 * k:3 * k + 3]), 'pct': round(100 * c / (60 * 12 * 106))} for c, k in cont]

# 5. som: volume médio (se tiver áudio)
vol = re.search(r'mean_volume: (-?[0-9.]+) dB', run('ffmpeg', '-i', src, '-af', 'volumedetect', '-vn', '-f', 'null', '-').stderr)

ficha = {'ficheiro': os.path.basename(src), 'duracao_s': round(dur, 2), 'cortes_s': cortes,
         'cortes_por_10s': round(10 * len(cortes) / dur, 1),
         'movimento_por_segundo': por_seg, 'movimento_medio': round(float(d.mean()), 1),
         'momentos_parados_s': parado[:40], 'paleta': paleta,
         'volume_medio_db': float(vol.group(1)) if vol else None}
json.dump(ficha, open(os.path.join(out, 'ficha.json'), 'w'), ensure_ascii=False, indent=1)
print(f"ok {out}/folha.jpg + ficha.json | {dur:.1f}s, {len(cortes)} cortes ({ficha['cortes_por_10s']}/10 s), "
      f"movimento médio {ficha['movimento_medio']}, paleta {' '.join(p['hex'] for p in paleta)}")
