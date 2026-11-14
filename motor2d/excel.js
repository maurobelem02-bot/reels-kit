// Excel ao vivo: grelha estilo Excel desenhada em HTML. Uso: const xl=excel(el,{cols:6,rows:14,colW:[...]}); xl.set('B2','Valor'); xl.cell('B2') -> elemento
export function excel(root,{cols=6,rows=14,colW=null,sheet='Folha1'}={}){
  const L=i=>String.fromCharCode(65+i);
  root.innerHTML=`<div class="xl"><div class="xl-rib"><b>Ficheiro</b><b class="on">Base</b><b>Inserir</b><b>Fórmulas</b><b>Dados</b></div>
  <div class="xl-fx"><span class="xl-nm">A1</span><span class="xl-f">fx</span><span class="xl-in"></span></div>
  <div class="xl-g" style="grid-template-columns:60px ${(colW||Array(cols).fill(150)).map(w=>w+'px').join(' ')}"></div>
  <div class="xl-tab"><span>${sheet}</span></div></div>`;
  const g=root.querySelector('.xl-g');let h='<div class="h"></div>';for(let c=0;c<cols;c++)h+=`<div class="h">${L(c)}</div>`;
  for(let r=1;r<=rows;r++){h+=`<div class="h">${r}</div>`;for(let c=0;c<cols;c++)h+=`<div class="c" id="x${L(c)}${r}"></div>`;}g.innerHTML=h+'<div class="xl-sel"></div><svg class="xl-cur" width="44" height="60" viewBox="0 0 22 30"><path d="M1 1v24l6-6 4 9 4-2-4-9h8z" fill="#111" stroke="#fff" stroke-width="1.6"/></svg>';
  const api={
    cell:a=>root.querySelector('#x'+a),
    set(a,v,cls=''){const e=api.cell(a);e.textContent=v;e.className='c '+cls;},
    fx(name,text){root.querySelector('.xl-nm').textContent=name;root.querySelector('.xl-in').textContent=text;},
    // seleciona um intervalo 'B2:B9' com retângulo verde
    select(range){const sel=root.querySelector('.xl-sel');if(!range){sel.style.display='none';return}const [a,b=a]=range.split(':');const A=api.cell(a),B=api.cell(b);
      Object.assign(sel.style,{display:'block',left:A.offsetLeft+'px',top:A.offsetTop+'px',width:B.offsetLeft+B.offsetWidth-A.offsetLeft+'px',height:B.offsetTop+B.offsetHeight-A.offsetTop+'px'});},
    // cursor do rato: move entre células com k 0..1
    cursor(a,b,k){const cur=root.querySelector('.xl-cur'),p=x=>{const e=api.cell(x);return[e.offsetLeft+e.offsetWidth*.6,e.offsetTop+e.offsetHeight*.6]};const A=p(a),B=p(b||a);cur.style.left=A[0]+(B[0]-A[0])*k+'px';cur.style.top=A[1]+(B[1]-A[1])*k+'px';}
  };return api;}
// texto a ser escrito letra a letra: typed('=SOMA(B2:B9)',t,início,duração)
export const typed=(s,t,a,d)=>s.slice(0,Math.max(0,Math.min(s.length,Math.floor((t-a)/d*s.length))));
