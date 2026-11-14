"""Volume final + QA. Uso: python3 finish.py mudo.mp4 mix.wav final.mp4
Ganho linear para -14 LUFS + limitador -1 dBFS, H.264 CRF 17 + AAC 192k, depois QA:
frames congelados >= 0.4 s, frames pretos, loudness final e qa_sheet.jpg.
(Em Python de propósito: num .sh, os argumentos posicionais eram trocados pelo texto do pedido quando a skill era chamada com argumentos.)"""
import sys, re, subprocess
V, A, OUT = sys.argv[1:4]
run = lambda *c: subprocess.run(list(c), capture_output=True, text=True)
I = float(re.findall(r'^\s+I:\s+(-?[\d.]+) LUFS', run('ffmpeg', '-hide_banner', '-i', A, '-af', 'ebur128', '-f', 'null', '-').stderr, re.M)[-1])
G = round(-14 - I, 2); print(f'loudness original: {I} LUFS -> ganho {G} dB')
r = run('ffmpeg', '-v', 'error', '-y', '-i', V, '-i', A, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17',
        '-pix_fmt', 'yuv420p', '-af', f'volume={G}dB,alimiter=limit=0.891:level=false', '-c:a', 'aac', '-b:a', '192k', '-shortest', OUT)
if r.returncode: sys.exit(r.stderr)
print('--- QA ---')
q = run('ffmpeg', '-hide_banner', '-i', OUT, '-vf', 'freezedetect=n=0.002:d=0.4,blackdetect=d=0.1:pix_th=0.05', '-map', '0:v', '-f', 'null', '-').stderr
bad = [l.strip() for l in q.splitlines() if 'freeze_start' in l or 'black_start' in l]
print('\n'.join(bad) if bad else 'sem congelados >=0.4 s nem frames pretos')
print('\n'.join([l.strip() for l in run('ffmpeg', '-hide_banner', '-i', OUT, '-af', 'ebur128=peak=true', '-map', '0:a', '-f', 'null', '-').stderr.splitlines() if re.match(r'^\s+(I|Peak):', l)][-2:]))
run('ffmpeg', '-v', 'error', '-y', '-i', OUT, '-vf', 'fps=1/3,scale=180:-1,tile=10x1', '-frames:v', '1', 'qa_sheet.jpg'); print('qa_sheet.jpg')
