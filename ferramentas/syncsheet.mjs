// Folha de sincronia: um quadro por linha do guião, logo a seguir ao início da palavra (tempo da ação + 3 frames),
// com a palavra e a ação escritas por baixo. Uso: node syncsheet.mjs  (lê tempos.json + guiao.json) -> sync_sheet.jpg
// Em cada quadro, a ação dessa linha TEM de estar visível. Se não estiver, a imagem está atrasada ou fora do plano.
import fs from 'fs'; import {execFileSync} from 'child_process';
import {abrir, quadro} from './browser.mjs';
const T = JSON.parse(fs.readFileSync('tempos.json')); let G = JSON.parse(fs.readFileSync('guiao.json')); G = G.linhas || G;
fs.rmSync('sync', {recursive: true, force: true}); fs.mkdirSync('sync');
const {pages, fechar} = await abrir('index.html', 1);
const limpa = s => (s || '').replace(/['":\\%]/g, ' ').slice(0, 34);
for (let i = 0; i < G.length; i++) {
  const r = G[i], t = T[r.id] + 3 / 30, n = String(i).padStart(3, '0');
  await quadro(pages[0], t, `sync/${n}.jpg`, 80);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `sync/${n}.jpg`, '-vf',
    `scale=270:-2,pad=270:540:0:0:white,drawtext=text='${limpa(t.toFixed(2) + 's  ' + (r.palavra || '> passo'))}':x=6:y=486:fontsize=22:fontcolor=black,drawtext=text='${limpa(r.acao)}':x=6:y=514:fontsize=15:fontcolor=0x1f6fd6`,
    `sync/l${n}.jpg`]);
}
const cols = Math.min(8, G.length), rows = Math.ceil(G.length / cols);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', 'sync/l%03d.jpg', '-vf', `tile=${cols}x${rows}:padding=4:color=white`, '-frames:v', '1', 'sync_sheet.jpg']);
console.log(`ok sync_sheet.jpg (${G.length} quadros)`); await fechar();
