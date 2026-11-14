// Motion 2D: utilitários para cenas SVG/HTML planas
import {clamp,ease,prog} from './core.js';
// número a contar: count(el, 0, 75500, t, início, duração, sufixo)
export function count(el,a,b,t,s,d,suf=''){const v=Math.round(a+(b-a)*prog(t,s,s+d));el.textContent=v.toLocaleString('pt-PT').replace(/[  .]/g,' ')+suf;}
// pôr um elemento a "saltar" para dentro: pop(el,t,início)
export function pop(el,t,s,d=.35){const k=clamp((t-s)/d);const o=k<=0?0:1;const sc=k<=0?.6:k<1?.6+.55*Math.sin(k*Math.PI*.75)/Math.sin(Math.PI*.75)*(1-.0)*1:1;el.style.opacity=o;el.style.transform=`scale(${k>=1?1:Math.min(1.12,sc)})`;}
// desliza de baixo: rise(el,t,início)
export function rise(el,t,s,d=.4,dy=80){const k=prog(t,s,s+d);el.style.opacity=k;el.style.transform=`translateY(${(1-k)*dy}px)`;}
// objeto ao longo de um caminho SVG: along(pathEl, objEl, k) — k 0..1; orienta pela tangente
export function along(path,obj,k){const L=path.getTotalLength(),p=path.getPointAtLength(L*clamp(k)),q=path.getPointAtLength(Math.min(L,L*clamp(k)+1));const a=Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI;obj.setAttribute('transform',`translate(${p.x},${p.y}) rotate(${a})`);}
// desenhar um traço progressivamente: draw(pathEl,k)
export function draw(path,k){const L=path.getTotalLength();path.style.strokeDasharray=L;path.style.strokeDashoffset=L*(1-clamp(k));}
