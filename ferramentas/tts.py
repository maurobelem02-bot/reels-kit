"""ElevenLabs TTS com tempos por palavra.
Uso: ELEVENLABS_API_KEY=... python3 -I tts.py roteiro.txt [--voz Will] [--id VOICE_ID] [--modelo eleven_v4|eleven_v3|eleven_multilingual_v2]
Com v4/v3, passa o roteiro_voz.txt (com etiquetas); no v2 as etiquetas são tiradas automaticamente.
Saída: voz.mp3, palavras.json ([{w,s,e}]), voz_info.json. Nunca imprime a chave."""
import json,os,sys,re,base64,urllib.request,urllib.parse,argparse
API='https://api.elevenlabs.io'
def req(method,path,key,body=None):
    r=urllib.request.Request(API+path,method=method,data=json.dumps(body).encode() if body else None,
        headers={'xi-api-key':key,'Content-Type':'application/json','Accept':'application/json'})
    try:
        with urllib.request.urlopen(r,timeout=180) as f:return json.load(f)
    except urllib.error.HTTPError as e:sys.exit(f'ERRO ElevenLabs {e.code}: {e.read().decode()[:300]}')
def find_voice(key,name):
    res=req('GET','/v2/voices?'+urllib.parse.urlencode({'search':name,'page_size':50}),key).get('voices',[])
    exact=[v for v in res if v['name'].split(' -')[0].strip().lower()==name.lower()]
    pick=(exact or res)
    if not pick:sys.exit(f'ERRO: voz "{name}" não encontrada na conta. Adiciona-a em elevenlabs.io > Voices ou passa --id.')
    for v in pick[:5]:print('voz candidata:',v['voice_id'],'|',v['name'],'|',v.get('category'))
    return pick[0]['voice_id'],pick[0]['name']
def words_from(al):
    ch,st,en=al['characters'],al['character_start_times_seconds'],al['character_end_times_seconds'];out=[];cur=None
    for c,s,e in zip(ch,st,en):
        if c.isspace():
            if cur:out.append(cur);cur=None
            continue
        if cur is None:cur={'w':c,'s':s,'e':e}
        else:cur['w']+=c;cur['e']=e
    if cur:out.append(cur)
    keep=[];dentro=False  # tira as etiquetas de voz [..] do v4/v3, mesmo com várias palavras
    for o in out:
        if o['w'].startswith('['):dentro=True
        if not dentro:keep.append(o)
        if o['w'].rstrip('.,!?;:…').endswith(']'):dentro=False
    out=keep
    for o in out:o['w']=o['w'].strip('.,!?;:"“”()…')
    return [o for o in out if o['w']]
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('roteiro');ap.add_argument('--voz',default='Will');ap.add_argument('--id');ap.add_argument('--modelo',default='eleven_v4')
    a=ap.parse_args();key=os.environ.get('ELEVENLABS_API_KEY') or sys.exit('ERRO: falta ELEVENLABS_API_KEY')
    text=open(a.roteiro,encoding='utf-8').read().strip()
    vid,vname=(a.id,a.voz) if a.id else find_voice(key,a.voz)
    tags=a.modelo in ('eleven_v3','eleven_v4')
    if not tags:text=re.sub(r'\s*\[[^\]]*\]\s*',' ',text).strip()  # o v2 lê os colchetes em voz alta
    vs={'stability':0.5,'similarity_boost':0.8} if tags else {'stability':0.45,'similarity_boost':0.8,'style':0.3,'use_speaker_boost':True,'speed':1.05}
    body={'text':text,'model_id':a.modelo,'voice_settings':vs}
    r=req('POST',f'/v1/text-to-speech/{vid}/with-timestamps?output_format=mp3_44100_128',key,body)
    open('voz.mp3','wb').write(base64.b64decode(r['audio_base64']))
    w=words_from(r.get('alignment') or r['normalized_alignment']);json.dump(w,open('palavras.json','w'),ensure_ascii=False)
    json.dump({'voice_id':vid,'voz':vname,'modelo':a.modelo,'duracao':w[-1]['e'] if w else 0},open('voz_info.json','w'),ensure_ascii=False)
    print(f'ok: voz.mp3 ({w[-1]["e"]:.1f}s, {len(w)} palavras) voz={vname} id={vid}')
