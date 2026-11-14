"""Converte a transcrição ElevenLabs Scribe (tempos REAIS por palavra) em palavras.json, com a grafia do roteiro.
Uso: python3 scribe2json.py scribe.json roteiro.txt  -> palavras.json ([{w,s,e}]) e frases.json
scribe.json: a lista `words` de creative_get_flow_run_status (transcripts[0].words), ou o objeto inteiro.
As palavras do roteiro são emparelhadas com as transcritas (difflib); onde a transcrição falhar,
o tempo é interpolado entre as vizinhas. Imprime as palavras sem par para confirmares."""
import sys, json, re, difflib, unicodedata
def norm(w):
    w = unicodedata.normalize('NFD', w.lower()); w = ''.join(c for c in w if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', w)
raw = json.load(open(sys.argv[1], encoding='utf-8'))
if isinstance(raw, dict):
    raw = raw.get('words') or raw.get('transcripts', [{}])[0].get('words') or raw.get('transcript', {}).get('words')
T = [x for x in raw if x.get('type', 'word') == 'word' and norm(x.get('text', x.get('word', '')))]
tw = [norm(x.get('text', x.get('word', ''))) for x in T]
ts = [(float(x['start']), float(x['end'])) for x in T]
txt = re.sub(r'\[[^\]]*\]', ' ', open(sys.argv[2], encoding='utf-8').read())  # tira etiquetas de voz, se vierem
R = txt.split(); rw = [norm(w) for w in R]
sm = difflib.SequenceMatcher(None, rw, tw, autojunk=False)
tim = [None] * len(R)
for op, a1, a2, b1, b2 in sm.get_opcodes():
    if op == 'equal':
        for k in range(a2 - a1): tim[a1 + k] = ts[b1 + k]
    elif op == 'replace':  # mesma zona, grafia diferente (números, nomes): reparte o intervalo
        s, e = ts[b1][0], ts[b2 - 1][1]; L = sum(len(rw[i]) + 1 for i in range(a1, a2)); acc = s
        for i in range(a1, a2):
            d = (e - s) * (len(rw[i]) + 1) / L; tim[i] = (acc, acc + d); acc += d
miss = [R[i] for i in range(len(R)) if tim[i] is None]
for i in range(len(R)):  # interpola as que faltam
    if tim[i] is None:
        p = next((tim[j][1] for j in range(i - 1, -1, -1) if tim[j]), 0.0)
        q = next((tim[j][0] for j in range(i + 1, len(R)) if tim[j]), p + .3)
        tim[i] = (p, max(p + .05, q))
W = [{'w': re.sub(r'[.,;:!?…"“”()]', '', R[i]), 's': round(tim[i][0], 3), 'e': round(tim[i][1], 3)} for i in range(len(R))]
json.dump(W, open('palavras.json', 'w', encoding='utf-8'), ensure_ascii=False)
F = []; cur = []
for i, w in enumerate(R):
    cur.append(i)
    if re.search(r'[.!?…]$', w) or i == len(R) - 1:
        F.append({'frase': ' '.join(R[j] for j in cur), 's': W[cur[0]]['s'], 'e': W[cur[-1]]['e']}); cur = []
json.dump(F, open('frases.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for f in F: print(f"{f['s']:6.2f}-{f['e']:6.2f}  {f['frase']}")
print(f'ok palavras.json ({len(W)} palavras, {len(W) - len(miss)} com tempo real)' + (f' | sem par: {miss}' if miss else ''))
