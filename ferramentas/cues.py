"""Uma só fonte de verdade para a sincronia: o guião técnico em JSON vira tempos exatos.
Uso: python3 cues.py guiao.json palavras.json  -> tempos.json (para a página) e cues.json (para audio.py)
guiao.json (por ordem do roteiro):
 {"bpm":108,"linhas":[{"id":"cadeiraCai","palavra":"colocar","acao":"cadeira cai do céu","sfx":"whoosh"},
  {"id":"cadeiraAterra","palavra":"cadeira","acao":"aterra com pó","sfx":"thud"},
  {"id":"preco","palavra":"80","acao":"etiqueta R$ 80 000","sfx":"pop"}]}
Cada palavra é procurada a partir da linha anterior (a mesma palavra pode repetir-se no roteiro).
"antecipa": quanto a imagem chega antes da palavra (por defeito 2/30 s). "dt": desvio extra opcional, por linha, em segundos. O SFX entra 2 frames antes da ação.
"apos": em vez de "palavra", encadeia um passo do mesmo processo X s depois da linha anterior
 (ex.: {"id":"caixaAbre","apos":0.3,"acao":"abas abrem"}). Usa-o para os passos de 2.2d.
Avisa quando há mais de 1,4 s sem nenhuma ação nova (a referência tem uma a cada 0,8-1,2 s)."""
import sys, json, re, unicodedata
def norm(w):
    w = unicodedata.normalize('NFD', w.lower()); return re.sub(r'[^a-z0-9]', '', ''.join(c for c in w if unicodedata.category(c) != 'Mn'))
G = json.load(open(sys.argv[1], encoding='utf-8')); W = json.load(open(sys.argv[2], encoding='utf-8'))
cfg = G if isinstance(G, dict) else {'linhas': G}; rows = cfg['linhas']
LEAD = cfg.get('antecipa', 2 / 30)  # a imagem chega 2 frames ANTES da palavra (regra 2.3)
k = 0; tempos = {}; sfx = []; out = []
for r in rows:
    if 'apos' in r:  # passo seguinte do mesmo processo: X s depois da linha anterior
        t = round(out[-1][0] + r['apos'], 3); tempos[r['id']] = t
    else:
        alvo = norm(r['palavra'].split()[0]); j = k
        while j < len(W) and norm(W[j]['w']) != alvo: j += 1
        if j == len(W): sys.exit(f'ERRO: palavra "{r["palavra"]}" não encontrada depois de "{W[k - 1]["w"] if k else "início"}"')
        t = round(max(0, W[j]['s'] - LEAD + r.get('dt', 0)), 3); tempos[r['id']] = t; k = j + 1
    if r.get('sfx'): sfx.append([r['sfx'], round(max(0, t - 2 / 30), 3)])
    out.append((t, r))
dur = W[-1]['e'] + .5
json.dump(tempos, open('tempos.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump({'bpm': cfg.get('bpm', 108), 'music_stop': cfg.get('music_stop'), 'sfx': sfx}, open('cues.json', 'w'), indent=1)
prev = 0.0
for t, r in out:
    gap = t - prev; flag = '  <-- BURACO: falta ação' if gap > 1.4 else ''
    print(f"{t:6.2f}s  +{gap:4.2f}  {r.get('palavra', '  ↳ passo'):<14} {r['id']:<16} {r.get('acao', '')}{flag}"); prev = t
if dur - prev > 1.4: print(f'{dur:6.2f}s  +{dur - prev:4.2f}  (fim)  <-- BURACO no fim')
print(f'ok tempos.json ({len(tempos)} ações, média {dur / max(1, len(tempos)):.2f} s por ação) cues.json ({len(sfx)} sfx)')
