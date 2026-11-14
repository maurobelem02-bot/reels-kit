// Abre o projeto num Chrome sem janela (WebGL por CPU) com um servidor local. Partilhado por render/stills/sync.
import {createRequire} from 'module';
import fs from 'fs'; import path from 'path'; import http from 'http';
const require = createRequire(import.meta.url);
let pw; for (const p of [process.env.PLAYWRIGHT, 'playwright', '/opt/npm-tools/node_modules/playwright']) { if (!p) continue; try { pw = require(p); break; } catch (e) {} }
if (!pw) { console.error('ERRO: falta o Playwright (npm i -g playwright)'); process.exit(1); }
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg'};
export function servidor(dir = process.cwd()) {
  const srv = http.createServer((q, r) => { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'Content-Type': MIME[path.extname(f)] || 'application/octet-stream'}); r.end(d); }); });
  return new Promise(ok => srv.listen(0, () => ok(srv)));
}
export async function abrir(pagina = 'index.html', n = 1) {
  const srv = await servidor();
  const exe = ['/usr/bin/google-chrome', process.env.CHROME].find(p => p && fs.existsSync(p));
  const br = await pw.chromium.launch({executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox']});
  const pages = [];
  for (let i = 0; i < n; i++) {
    const p = await br.newPage({viewport: {width: 1080, height: 1920}});
    p.on('pageerror', e => console.error('PÁGINA:', e.message)); p.on('console', m => { if (m.type() === 'error') console.error('CONSOLA:', m.text()); });
    await p.goto(`http://localhost:${srv.address().port}/${pagina}`);
    await p.waitForFunction('window.renderAt || window.ERRO', null, {timeout: 300000});
    const erro = await p.evaluate(() => window.ERRO); if (erro) { console.error('ERRO no story/motor:\n' + erro); process.exit(1); }
    pages.push(p);
  }
  return {br, pages, srv, fechar: async () => { await br.close(); srv.close(); }};
}
export const quadro = async (p, t, ficheiro, q = 92) => { await p.evaluate(t => window.renderAt(t), t); await p.screenshot({path: ficheiro, type: 'jpeg', quality: q}); };
