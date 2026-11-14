"""Alinha as frases do roteiro aos segmentos falados (silencedetect) por sílabas, com programação dinâmica.
Uso: python3 timing.py voz.mp3 roteiro.txt  -> palavras.json ([{w,s,e}]) e frases.json
Não precisa de reconhecimento de voz: usa o texto do roteiro."""
import sys, re, json, subprocess, math
VOG = 'aeiouáéíóúâêôãõàü'
def syl(w):
    w = w.lower(); n = len(re.findall(f'[{VOG}]+', w)); return max(1, n)
def segments(mp3, d=0.25, noise=-35):
    out = subprocess.run(['ffmpeg', '-i', mp3, '-af', f'silencedetect=noise={noise}dB:d={d}', '-f', 'null', '-'], capture_output=True, text=True).stderr
    dur = float(re.search(r'Duration: (\d+):(\d+):([\d.]+)', out).groups()[2]) + 60 * float(re.search(r'Duration: (\d+):(\d+)', out).group(2))
    ss = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', out)]; se = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', out)]
    segs = []; cur = 0.0
    for a, b in zip(ss, se + [dur] * (len(ss) - len(se))):
        if a - cur > 0.08: segs.append([cur, a])
        cur = b
    if dur - cur > 0.08: segs.append([cur, dur])
    return segs
def phrases(txt):
    parts = re.findall(r'[^.,;:!?…]+[.,;:!?…]*', txt.replace('\n', ' '))
    return [p.strip() for p in parts if p.strip()]
def align(ph, segs):
    S = [sum(syl(w) for w in p.split()) for p in ph]; P, G = len(ph), len(segs)
    rate = sum(b - a for a, b in segs) / sum(S)
    INF = 1e18; dp = [[INF] * (G + 1) for _ in range(P + 1)]; bk = [[None] * (G + 1) for _ in range(P + 1)]; dp[0][0] = 0
    for i in range(P + 1):
        for j in range(G + 1):
            if dp[i][j] >= INF: continue
            for k in range(1, 4):            # k frases -> 1 segmento
                if i + k > P or j + 1 > G: break
                d = segs[j][1] - segs[j][0]; e = sum(S[i:i + k]) * rate
                pen = sum(3 if p[-1] in '.!?' else 1.2 for p in ph[i:i + k - 1])  # juntar frases num segmento custa
                c = dp[i][j] + 4 * math.log(max(d, .05) / max(e, .05)) ** 2 + pen
                if c < dp[i + k][j + 1]: dp[i + k][j + 1] = c; bk[i + k][j + 1] = (i, j, k, 1)
            for m in range(2, 5):            # 1 frase -> m segmentos
                if i + 1 > P or j + m > G: break
                d = sum(b - a for a, b in segs[j:j + m])
                e = S[i] * rate; gaps = sum(segs[q + 1][0] - segs[q][1] for q in range(j, j + m - 1))
                c = dp[i][j] + 4 * math.log(max(d, .05) / max(e, .05)) ** 2 + .6 * (m - 1) + .5 * max(0, gaps - .6)
                if c < dp[i + 1][j + m]: dp[i + 1][j + m] = c; bk[i + 1][j + m] = (i, j, 1, m)
    i, j = P, G; out = []
    while i > 0:
        pi, pj, k, m = bk[i][j]; out.append((pi, k, pj, m)); i, j = pi, pj
    out.reverse(); res = []
    for pi, k, sj, m in out:
        a, b = segs[sj][0], segs[sj + m - 1][1]
        if k == 1:
            res.append((ph[pi], [segs[q] for q in range(sj, sj + m)]))
        else:  # várias frases num segmento: reparte por sílabas
            tot = sum(S[pi:pi + k]); t = a
            for q in range(pi, pi + k):
                d = (b - a) * S[q] / tot; res.append((ph[q], [[t, t + d]])); t += d
    return res
def words(res):
    W = []
    for p, spans in res:
        ws = p.split(); sy = [syl(w) + .3 for w in ws]; tot = sum(sy)
        dur = sum(b - a for a, b in spans); acc = 0.0
        def at(x):  # tempo dentro dos segmentos, saltando pausas
            for a, b in spans:
                if x <= b - a: return a + x
                x -= b - a
            return spans[-1][1]
        for w, s_ in zip(ws, sy):
            d = dur * s_ / tot; W.append({'w': re.sub(r'[.,;:!?…"“”]', '', w), 's': round(at(acc), 3), 'e': round(at(acc + d), 3)}); acc += d
    return W
if __name__ == '__main__':
    segs = segments(sys.argv[1]); ph = phrases(open(sys.argv[2], encoding='utf-8').read())
    res = align(ph, segs); W = words(res)
    json.dump(W, open('palavras.json', 'w'), ensure_ascii=False)
    json.dump([{'frase': p, 's': sp[0][0], 'e': sp[-1][1]} for p, sp in res], open('frases.json', 'w'), ensure_ascii=False, indent=1)
    for p, sp in res: print(f'{sp[0][0]:6.2f}-{sp[-1][1]:6.2f}  {p}')
