// Render em frames, com retoma: node render.mjs [de] [ate] [--proc 2] [--pagina video.html --dur 30]   (de/ate em frames; por defeito o vídeo todo)
//   Escreve frames/f00000.jpg…; os frames que já existem são saltados, por isso basta voltar a correr depois de uma falha.
//   No fim: node render.mjs juntar  -> mudo.mp4 (H.264, 30 fps) a partir dos frames.
import fs from 'fs'; import {execFileSync} from 'child_process';
import {abrir, quadro, opcao, posicionais} from './browser.mjs';
const FPS = 30, args = process.argv.slice(2);
if (args[0] === 'juntar') {
  const n = fs.readdirSync('frames').filter(f => /^f\d{5}\.jpg$/.test(f)).length;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '' + FPS, '-i', 'frames/f%05d.jpg', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', 'mudo.mp4'], {stdio: 'inherit'});
  console.log(`ok mudo.mp4 (${n} frames, ${(n / FPS).toFixed(2)} s)`); process.exit(0);
}
const proc = +opcao('proc', 2), pos = posicionais();
fs.mkdirSync('frames', {recursive: true});
const {pages, fechar} = await abrir(opcao('pagina', 'index.html'), proc);
const dur = +opcao('dur', 0) || await pages[0].evaluate(() => window.DURACAO);
if (!dur) { console.error('ERRO: a página não tem window.DURACAO: passa --dur SEGUNDOS'); process.exit(1); }
const total = Math.round(dur * FPS), de = +(pos[0] ?? 0), ate = Math.min(total, +(pos[1] ?? total));
const nome = i => `frames/f${String(i).padStart(5, '0')}.jpg`;
const falta = []; for (let i = de; i < ate; i++) if (!fs.existsSync(nome(i)) || fs.statSync(nome(i)).size < 1000) falta.push(i);
console.log(`render: ${falta.length} frames por fazer de ${ate - de} (${proc} processos)`);
let feitos = 0; const t0 = Date.now();
await Promise.all(pages.map(async (p, k) => {
  for (let j = k; j < falta.length; j += pages.length) {
    const i = falta[j], tmp = nome(i) + '.tmp.jpg';
    await quadro(p, i / FPS, tmp); fs.renameSync(tmp, nome(i)); feitos++;
    if (feitos % 30 === 0) { const s = (Date.now() - t0) / 1000 / feitos; console.log(`${feitos}/${falta.length}  ${s.toFixed(2)} s/frame  faltam ~${Math.round(s * (falta.length - feitos) / 60)} min`); }
  }
}));
console.log(`ok ${feitos} frames em ${((Date.now() - t0) / 60000).toFixed(1)} min`); await fechar();
