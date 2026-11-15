"""Tempos ESTIMADOS (antes de haver voz): python3 -I est.py roteiro.txt -> palavras.json. Substituir pelos reais quando o MP3 chegar."""
import sys, re, json
VOG = 'aeiouáéíóúâêôãõàü'
syl = lambda w: max(1, len(re.findall(f'[{VOG}]+', w.lower())))
t = 0.15; W = []
for par in open(sys.argv[1], encoding='utf-8').read().strip().split('\n'):
    for tok in par.split():
        d = 0.085 + 0.125 * syl(tok)
        W.append({'w': re.sub(r'[.,;:!?…]', '', tok), 's': round(t, 3), 'e': round(t + d, 3)}); t += d
        t += .42 if tok[-1] in '.?!' else .3 if tok[-1] == ':' else .18 if tok[-1] == ',' else 0
    t += .3
json.dump(W, open('palavras.json', 'w', encoding='utf-8'), ensure_ascii=False)
print(len(W), 'palavras, fim aos', round(W[-1]['e'], 1), 's')
