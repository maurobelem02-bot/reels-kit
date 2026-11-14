// Stills + folha de contacto: node stills.mjs pasta "0.5,2,4.2" [--legenda "gancho,revelação,…"] [--pagina video.html]
//   -> pasta/s_00.jpg… e pasta/folha.jpg (até 6 por linha, com o tempo e a legenda por baixo). Para storyboard e testes.
import fs from 'fs'; import {execFileSync} from 'child_process';
import {abrir, quadro, opcao, posicionais} from './browser.mjs';
const [dir, lista] = posicionais(); const li = process.argv.indexOf('--legenda');
const nomes = li > 0 ? process.argv[li + 1].split(',') : [];
const ts = lista.split(',').map(Number); fs.mkdirSync(dir, {recursive: true});
const {pages, fechar} = await abrir(opcao('pagina', 'index.html'), 1); const t0 = Date.now();
for (let i = 0; i < ts.length; i++) {
  const f = `${dir}/s_${String(i).padStart(2, '0')}.jpg`; await quadro(pages[0], ts[i], f);
  const txt = (ts[i].toFixed(2) + 's ' + (nomes[i] || '')).replace(/[':]/g, ' ');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-vf', `scale=360:-2,pad=360:700:0:0:white,drawtext=text='${txt}':x=8:y=652:fontsize=24:fontcolor=black`, `${dir}/l_${String(i).padStart(2, '0')}.jpg`]);
}
console.log(`stills: ${((Date.now() - t0) / 1000 / ts.length).toFixed(1)} s por frame`);
const cols = Math.min(6, ts.length), rows = Math.ceil(ts.length / cols);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', `${dir}/l_%02d.jpg`, '-vf', `tile=${cols}x${rows}:padding=6:color=white`, '-frames:v', '1', `${dir}/folha.jpg`]);
console.log(`ok ${dir}/folha.jpg (${ts.length} quadros)`); await fechar();
