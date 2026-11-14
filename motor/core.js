export const lerp=(a,b,k)=>a+(b-a)*k, clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
export const ease=k=>k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
export const prog=(t,a,b)=>ease(clamp((t-a)/(b-a)));
// captions: words=[{w,s,e,hl}] -> overlay
export function captions(words,t){const el=document.getElementById('cap');let cur=null;for(let i=0;i<words.length&&words[i].s<=t;i++){const n=words[i+1];if(t<Math.min(n?n.s:1e9,words[i].e+.6))cur=words[i];}el.textContent=cur?cur.w:'';el.className=cur&&cur.hl?'hl':'';
  if(cur){const k=clamp((t-cur.s)/.12);el.style.transform=`translateX(-50%) scale(${.85+.15*k})`;}}
export function timeWords(text,start,end,hl=[]){const ws=text.split(/\s+/).filter(Boolean);const tot=ws.reduce((a,w)=>a+w.length+2,0);let s=start;return ws.map(w=>{const d=(end-start)*(w.length+2)/tot;const o={w:w.replace(/[.,!?;:]/g,''),s,e:s+d,hl:hl.includes(w.toLowerCase().replace(/[.,!?;:]/g,''))};s+=d;return o});}

// marca palavras-chave (amarelo) numa lista vinda do palavras.json
export const markHL=(words,list)=>words.map(x=>({...x,hl:list.includes(x.w.toLowerCase())}));
