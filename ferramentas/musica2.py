"""Música de fundo motivacional com tensão (cinematográfica): pad quente, pulso em colcheias, piano suave, baixo, subida antes do fecho.
Uso: python3 musica2.py DURACAO T_VIRADA saida.wav"""
import sys, numpy as np, wave
SR = 44100; dur = float(sys.argv[1]); tv = float(sys.argv[2]); out = sys.argv[3]
n = int(dur * SR); L = np.zeros(n); R = np.zeros(n)
bpm = 96; beat = 60 / bpm; bar = 4 * beat
def hz(m): return 440 * 2 ** ((m - 69) / 12)
# Si menor - Sol - Ré - Lá (vi-IV-I-V em Ré maior): esperançoso, com tensão
CH = [(47, [59, 62, 66]), (43, [59, 62, 67]), (38, [57, 62, 66]), (45, [57, 61, 64])]
def put(x, at, gl=1, gr=1):
    i = int(at * SR)
    if i >= n or i < 0: return
    x = x[:n - i]; L[i:i + len(x)] += x * gl; R[i:i + len(x)] += x * gr
def tt(d): return np.arange(int(d * SR)) / SR
def pad(notes, d):
    t = tt(d + 1.2); x = 0
    for m in notes:
        for det in (-.004, 0, .004):
            f = hz(m) * (1 + det); x = x + np.sin(2 * np.pi * f * t) + .25 * np.sin(4 * np.pi * f * t) + .08 * np.sin(6 * np.pi * f * t)
    env = np.minimum(1, t / .9) * np.minimum(1, (d + 1.2 - t) / 1.2)
    return x * env / 9
def pluck(m, d=.26, bright=.35):
    t = tt(d); f = hz(m)
    x = np.sin(2 * np.pi * f * t) + bright * np.sin(4 * np.pi * f * t) * np.exp(-t * 22) + .15 * np.sin(6 * np.pi * f * t) * np.exp(-t * 40)
    return x * np.exp(-t * 13) * np.minimum(1, t / .004)
def piano(m, d=2.2):
    t = tt(d); f = hz(m)
    x = sum(a * np.sin(2 * np.pi * f * k * t) * np.exp(-t * (1.6 + .9 * k)) for k, a in ((1, 1), (2, .42), (3, .2), (4, .09)))
    return x * np.minimum(1, t / .006)
def sub(m, d):
    t = tt(d); f = hz(m); return (np.sin(2 * np.pi * f * t) + .2 * np.sin(4 * np.pi * f * t)) * np.minimum(1, t / .08) * np.minimum(1, (d - t) / .25)
def kick():
    t = tt(.32); f = 48 + 70 * np.exp(-t * 28); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)
def hat(seed):
    r = np.random.default_rng(seed); t = tt(.06); x = r.standard_normal(len(t)); x = x - np.convolve(x, np.ones(6) / 6, 'same'); return x * np.exp(-t * 70)
def riser(d):
    r = np.random.default_rng(5); t = tt(d); x = r.standard_normal(len(t)); k = 60; x = np.convolve(x, np.ones(k) / k, 'same') * 6
    tone = np.sin(2 * np.pi * np.cumsum(hz(62) * (1 + .5 * (t / d) ** 2)) / SR) * .25
    return (x + tone) * (t / d) ** 2.2
nb = int(dur / bar) + 2; vb = tv / bar   # compasso da virada
for b in range(nb):
    t0 = b * bar; root, notes = CH[b % 4]; big = t0 >= tv - .05
    lvl = min(1, .55 + b / 24)             # cresce devagar ao longo do vídeo
    put(pad(notes, bar) * (.50 if not big else .62), t0, 1, .92)
    put(pad([m + 12 for m in notes[:2]], bar) * (.14 if not big else .3), t0, .85, 1)
    # pulso em colcheias: a tensão que prende
    if b >= 1:
        for e in range(8):
            acc = (1, .5, .7, .5, .85, .5, .7, .6)[e]; m = root + 12 if e not in (3, 7) else root + 19
            put(pluck(m) * .34 * acc * lvl, t0 + e * beat / 2, .8 if e % 2 else 1, 1 if e % 2 else .8)
    # piano: motivo simples nas notas de cima
    if b >= 2:
        seq = [(0, notes[2] + 12), (1.5, notes[1] + 12), (2.5, notes[2] + 12), (3.5, notes[0] + 12)] if b % 2 == 0 else [(0, notes[1] + 12), (1.5, notes[2] + 12), (3, notes[0] + 12)]
        for bt, m in seq: put(piano(m) * .2 * lvl * (1.25 if big else 1), t0 + bt * beat, .9, 1)
    if b >= 4: put(sub(root - 12 if root - 12 >= 31 else root, bar) * .42 * lvl, t0)
    if b >= 8:
        for bt in ((0, 2.5) if not big else (0, 1, 2, 3)): put(kick() * .5 * lvl, t0 + bt * beat)
    if b >= 12:
        for e in range(8):
            if e % 2: put(hat(b * 8 + e) * .05, t0 + e * beat / 2, .6, 1)
put(riser(2.4) * .22, tv - 2.4)
t = tt(3.0); r = np.random.default_rng(9).standard_normal(len(t)); r = r - np.convolve(r, np.ones(4) / 4, 'same')
put(r * np.exp(-t * 2.2) * .1, tv)                                   # prato suave na virada
for m in (74, 78, 81, 86): put(piano(m, 3) * .22, tv + (m - 74) * .012)   # acorde aberto de Ré maior
x = np.stack([L, R], 1)
# suaviza agudos (nada estridente) e fades
k = 5; x = np.stack([np.convolve(x[:, c], np.ones(k) / k, 'same') for c in (0, 1)], 1)
f = np.ones(n); a = int(.5 * SR); f[:a] = np.linspace(0, 1, a); z = int(2.2 * SR); f[-z:] = np.linspace(1, 0, z) ** 1.5
x = x * f[:, None]; x = x / np.abs(x).max() * .8
w = wave.open(out, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype('<i2').tobytes()); w.close()
print('ok', out, round(dur, 2), 's')
