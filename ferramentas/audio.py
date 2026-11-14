"""Sintetiza música ALEGRE + SFX (sem rede, sem créditos).
Uso: python3 audio.py cues.json DURACAO  -> music.wav, sfx.wav (44.1 kHz, estéreo)
cues.json: {"bpm":108,"music_stop":null,"sfx":[["whoosh",3.4],["pop",10.3],...]}
Música: tom maior (Dó), progressão I-V-vi-IV, marimba em arpejo, baixo suave, palmas leves, shaker.
Nada de onda quadrada, notas cromáticas ou drones graves (soavam negativos).
SFX: whoosh, pop, thud, ting, ding, sputter, engine, crash, virada (=sting), click, cash, flash, boing, sparkle."""
import json, sys, numpy as np, wave
SR = 44100
rng = np.random.default_rng(7)

def env(n, a=0.005, r=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / max(r, 1e-4))

def tone(f, d, a=0.005, r=0.2, harm=(1,)):
    n = int(d * SR); t = np.arange(n) / SR
    ph = 2 * np.pi * (np.cumsum(f) / SR if hasattr(f, '__len__') else f * t)
    w = sum(np.sin(ph * (k + 1)) * h for k, h in enumerate(harm))
    return w * env(n, a, r)

def noise(d):
    return rng.standard_normal(int(d * SR))

def hp(x):  # brilho: realça agudos
    return np.diff(x, prepend=0)

def lp(x, k=8):  # suaviza (média móvel)
    return np.convolve(x, np.ones(k) / k, 'same')

def sweep(f0, f1, d):
    return np.geomspace(f0, f1, int(d * SR))

def marimba(f, d=.45):
    return tone(f, d, .002, .16, (1, 0, 0, .35)) * .9

def sfx(kind):
    if kind == 'whoosh':
        d = .5; x = lp(noise(d), 6); t = np.linspace(0, 1, len(x))
        return x * np.sin(np.pi * t) ** 2 * .7
    if kind == 'pop':
        return tone(sweep(500, 1200, .09), .09, .001, .04) * .8
    if kind == 'boing':
        f = 300 + 120 * np.sin(np.linspace(0, 14, int(.35 * SR))); return tone(f, .35, .002, .15) * .6
    if kind == 'thud':
        return tone(sweep(140, 60, .22), .22, .002, .07) * .9 + lp(noise(.22), 30) * env(int(.22 * SR), .001, .03) * .4
    if kind == 'ting':
        return tone(2093, .8, .001, .3) * .45 + tone(3136, .8, .001, .2) * .2
    if kind == 'ding':
        return tone(1568, .6, .001, .25) * .5 + tone(1976, .6, .001, .2) * .3
    if kind == 'sparkle':
        out = np.zeros(int(.7 * SR))
        for i, f in enumerate([1568, 1976, 2349, 3136]):
            x = tone(f, .4, .001, .12) * .35; s = int(i * .07 * SR); out[s:s + len(x)] += x[:len(out) - s]
        return out
    if kind == 'cash':
        return np.concatenate([tone(2637, .1, .001, .05) * .5, tone(3520, .45, .001, .18) * .5])
    if kind == 'click':
        return hp(noise(.03)) * env(int(.03 * SR), .0005, .006) * .6
    if kind == 'sputter':
        out = []
        for g in [.1, .08, .12, .07, .16]:
            out.append(tone(sweep(110, 80, g), g, .002, .04, (1, .5, .25)) * .5 + lp(noise(g), 10) * env(int(g * SR), .001, .03) * .3)
            out.append(np.zeros(int(.05 * SR)))
        return np.concatenate(out)
    if kind == 'engine':
        d = 1.4; return tone(sweep(70, 150, d), d, .05, 3, (1, .5, .3, .2)) * .3 * np.linspace(1, .2, int(d * SR))
    if kind == 'crash':
        return lp(noise(.9), 3) * env(int(.9 * SR), .002, .25) * .7 + tone(sweep(120, 60, .9), .9, .002, .3) * .4
    if kind in ('virada', 'sting'):  # virada POSITIVA: subida curta + acorde maior brilhante
        d = .6; x = lp(noise(d), 4) * np.linspace(0, 1, int(d * SR)) ** 2 * .5
        ch = sum(tone(f, 1.2, .002, .45) for f in (523.3, 659.3, 784, 1046.5)) * .3
        return np.concatenate([x, ch])
    if kind == 'flash':
        return hp(noise(.3)) * env(int(.3 * SR), .002, .08) * .4
    raise ValueError(kind)

# Dó maior: C  G  Am  F  (I-V-vi-IV)
CH = [(261.63, 329.63, 392.0), (196.0, 246.94, 293.66), (220.0, 261.63, 329.63), (174.61, 220.0, 261.63)]
def music(dur, bpm=108, stop=None):
    n = int(dur * SR); out = np.zeros(n); beat = 60 / bpm; e8 = beat / 2
    kick = tone(sweep(90, 45, .18), .18, .001, .06) * .7
    clap = hp(noise(.12)) * env(int(.12 * SR), .001, .03) * .25
    shak = hp(hp(noise(.04))) * env(int(.04 * SR), .003, .012) * .06
    def put(x, at):
        i = int(at * SR)
        if i >= n: return
        m = min(len(x), n - i); out[i:i + m] += x[:m]
    nb = int(dur / beat) + 1
    for b in range(nb):
        t0 = b * beat
        if stop and t0 >= stop: break
        ch = CH[(b // 4) % 4]
        if b % 2 == 0: put(kick, t0)
        else: put(clap, t0)
        put(shak, t0); put(shak * .7, t0 + e8)
        if b % 4 == 0:  # baixo suave e pad quente no início de cada compasso
            put(tone(ch[0] / 2, beat * 3.6, .02, 1.2, (1, .3)) * .35, t0)
            put(sum(tone(f, beat * 4, .25, 1.6) for f in ch) * .06, t0)
        pat = [0, 1, 2, 1] if (b // 8) % 2 == 0 else [2, 1, 0, 2]
        for k in range(2):  # marimba em colcheias, uma oitava acima
            put(marimba(ch[pat[(b * 2 + k) % 4]] * 2) * .28, t0 + k * e8)
    return out

if __name__ == '__main__':
    cues = json.load(open(sys.argv[1])); dur = float(sys.argv[2])
    m = music(dur, cues.get('bpm', 108), cues.get('music_stop'))
    s = np.zeros(int(dur * SR))
    for kind, at in cues['sfx']:
        x = sfx(kind); i = int(at * SR); k = min(len(x), len(s) - i)
        if k > 0: s[i:i + k] += x[:k]
    fade = np.minimum(1, np.minimum(np.arange(len(m)) / (.4 * SR), (len(m) - np.arange(len(m))) / (1.2 * SR)))
    m *= fade
    for name, x in (('music.wav', m), ('sfx.wav', s)):
        x = x / (np.abs(x).max() + 1e-9) * .9
        pcm = (np.stack([x, x], 1) * 32767).astype('<i2')
        with wave.open(name, 'wb') as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print('ok music.wav sfx.wav', dur, 's')
