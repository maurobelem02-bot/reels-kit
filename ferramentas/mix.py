"""Mistura com níveis medidos nos Reels de referência (fundo ~20 dB abaixo da fala).
Uso: python3 mix.py voz.mp3 music.wav sfx.wav [--musica faixa.mp3] [--mdb -18] [--sdb -10]
 - música: RMS a -18 dB da voz (RMS com gate). Antes era -6 dB: competia com a fala.
 - SFX: RMS a -10 dB da voz, picos <= 0.5x o pico da voz.
 - --musica: usa uma faixa do utilizador (pasta musica/) em vez da sintetizada: corta/repete, fade in 0.4 s, fade out 1.5 s.
A voz nunca é alterada. Saída: mix.wav"""
import sys, subprocess, argparse, numpy as np
SR = 44100
ap = argparse.ArgumentParser(); ap.add_argument('voz'); ap.add_argument('music'); ap.add_argument('sfx')
ap.add_argument('--musica'); ap.add_argument('--mdb', type=float, default=-18); ap.add_argument('--sdb', type=float, default=-10)
a = ap.parse_args()
def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 's16le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, '<i2').reshape(-1, 2).astype(np.float64) / 32768
def grms(x, gate_db=-40):
    m = x.mean(1); w = int(.05 * SR); n = len(m) // w
    r = np.sqrt((m[:n * w].reshape(n, w) ** 2).mean(1) + 1e-12)
    g = r[20 * np.log10(r) > gate_db]
    return np.sqrt((g ** 2).mean()) if len(g) else 1e-6
db = lambda v: 20 * np.log10(v + 1e-12)
v = load(a.voz); n = len(v)
mu = load(a.musica) if a.musica else load(a.music)
if a.musica:
    mu = np.tile(mu, (int(np.ceil(n / len(mu))), 1))[:n]
    k = np.arange(n); f = np.minimum(1, np.minimum(k / (.4 * SR), (n - k) / (1.5 * SR))); mu = mu * f[:, None]
sf = load(a.sfx)
fit = lambda x: np.pad(x, ((0, max(0, n - len(x))), (0, 0)))[:n]
mu, sf = fit(mu), fit(sf)
rv = grms(v); gm, gs = 10 ** (a.mdb / 20), 10 ** (a.sdb / 20)
mu *= rv * gm / grms(mu, -90)  # ganho calculado uma vez, sem gate (o gate escondia a música baixa e o volume disparava +51 dB)
if np.abs(sf).max() > 0: sf *= rv * gs / grms(sf, -90)
pk = np.abs(v).max() * .5
if np.abs(sf).max() > pk: sf *= pk / np.abs(sf).max()
mix = v + mu + sf
print(f'voz {db(rv):.1f} dBFS | música {db(grms(mu, -90)) - db(rv):+.1f} dB vs voz | sfx {db(grms(sf, -90)) - db(rv):+.1f} dB vs voz (pico {db(np.abs(sf).max()) - db(np.abs(v).max()):+.1f} dB vs pico da voz)')
pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ac', '2', '-ar', str(SR), '-i', '-', 'mix.wav'], input=pcm.tobytes(), check=True)
print('ok mix.wav')
