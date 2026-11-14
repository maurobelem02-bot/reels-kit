// motor.js — motor FIXO dos Reels @maurobelem1. Não se edita por vídeo: cada vídeo só escreve o story.js.
// Cadeia: cena (Standard ou toon 2 tons) -> [tinta] -> desfoque de lente (pre+main) -> tone mapping + grade -> ecrã.
// Tudo é função do tempo t (determinístico): o render pode retomar a meio e correr em vários processos.
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {EffectComposer, RenderPass, EffectPass, ToneMappingEffect, ToneMappingMode, SMAAEffect} from 'postprocessing';
import {LensBlur} from './vendor/lensblur.js';
import {InkPass, NOINK} from './vendor/ink.js';
import {twoTone, TONE} from './vendor/shade.js';
import {GradeEffect, GRADES} from './vendor/grade.js';
import * as paint from './vendor/paint.js';
import {Pen, bodyFront} from './vendor/toon.js';
export {T, paint, NOINK};

export const W = 1080, H = 1920, FPS = 30;
// ---------- tempo e easing ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smoother = k => (k = clamp(k), k * k * k * (k * (6 * k - 15) + 10));
export const easeOut = k => 1 - Math.pow(1 - clamp(k), 3);
export const easeIn = k => Math.pow(clamp(k), 3);
export const back = (k, s = 1.70158) => (k = clamp(k) - 1, k * k * ((s + 1) * k + s) + 1);           // passa e volta
export const spring = k => k <= 0 ? 0 : k >= 1 ? 1 : 1 - Math.exp(-6 * k) * Math.cos(10 * k);         // assenta com mola
export const prog = (t, a, b, f = smoother) => f(clamp((t - a) / Math.max(1e-6, b - a)));
export function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => (s = (s ^ (s << 13)) >>> 0, s = (s ^ (s >>> 17)) >>> 0, s = (s ^ (s << 5)) >>> 0, s / 4294967296); }

// ---------- luzes (Azul-Menta) ----------
// az/el em graus no mundo; céu = 3 paragens (topo, meio, horizonte). Os nomes usam-se em config.luz.
export const LUZES = {
  dia:     {az: 35, el: 52, sol: '#fff4e2', solI: 2.6, hemiC: '#e8f5ff', hemiS: '#9fd3ae', hemiI: 1.5, topo: '#2b7fe6', meio: '#8fd0ff', hor: '#e4f6ff', nevoa: '#d9f1ff', exp: 1.0, grade: 'day'},
  dourado: {az: 70, el: 14, sol: '#ffb469', solI: 3.4, hemiC: '#ffe0c0', hemiS: '#a08a9a', hemiI: 1.1, topo: '#4f6fb8', meio: '#f2a97f', hor: '#ffd59a', nevoa: '#f4c9a0', exp: 1.0, grade: 'golden'},
  noite:   {az: -40, el: 38, sol: '#9fb8ff', solI: 1.4, hemiC: '#5a7bc4', hemiS: '#1d2b4f', hemiI: 1.2, topo: '#0a1f4a', meio: '#1f4a8c', hor: '#3f74b8', nevoa: '#22406e', exp: 1.0, grade: 'day'},
};
const C = new T.Color(), C2 = new T.Color();
const mixHex = (a, b, k) => C.set(a).lerp(C2.set(b), k).getStyle();

// ---------- câmara: Hermite com tangentes monótonas por tempo (nunca recua antes de uma viagem) ----------
// chaves: [t, [x,y,z] posição, [x,y,z] alvo, {fov, dof, foco:[x,y,z], aereo}]
export function curva(chaves, recuo = 1) {
  const K = chaves.map(([t, p, a, o = {}]) => {
    const r = o.aereo ? 1 : (o.recuo ?? recuo);
    const pos = a.map((v, i) => v + (p[i] - v) * r);                   // afasta a câmara do alvo (regra 1,4)
    return {t, v: [...pos, ...a, o.fov ?? 38], dof: o.dof ?? 0, foco: o.foco};
  });
  const n = K.length, Tt = K.map(k => k.t), V = K.map(k => k.v);
  const M = V.map((v, i) => v.map((_, c) => {
    if (i === 0 || i === n - 1) return 0;
    const d0 = (V[i][c] - V[i - 1][c]) / (Tt[i] - Tt[i - 1]), d1 = (V[i + 1][c] - V[i][c]) / (Tt[i + 1] - Tt[i]);
    return d0 * d1 <= 0 ? 0 : Math.sign(d0) * Math.min(Math.abs(d0), Math.abs(d1));
  }));
  const at = t => {
    if (t <= Tt[0]) return {v: V[0], i: 0, s: 0};
    if (t >= Tt[n - 1]) return {v: V[n - 1], i: n - 2, s: 1};
    let i = 0; while (t > Tt[i + 1]) i++;
    const h = Tt[i + 1] - Tt[i], s = (t - Tt[i]) / h, s2 = s * s, s3 = s2 * s;
    const a = 2 * s3 - 3 * s2 + 1, b = s3 - 2 * s2 + s, c = -2 * s3 + 3 * s2, d = s3 - s2;
    return {v: V[i].map((x, k) => a * x + b * h * M[i][k] + c * V[i + 1][k] + d * h * M[i + 1][k]), i, s};
  };
  return t => {
    const {v, i, s} = at(t), A = K[Math.min(i, n - 1)], B = K[Math.min(i + 1, n - 1)];
    const k = smoother(s);
    const foco = A.foco && B.foco ? A.foco.map((x, j) => lerp(x, B.foco[j], k)) : (s < .5 ? A.foco : B.foco);
    return {pos: v.slice(0, 3), alvo: v.slice(3, 6), fov: v[6], dof: lerp(A.dof, B.dof, k), foco};
  };
}

// ---------- motor ----------
export async function criarMotor(cfg) {
  cfg = {look: 'suave', tinta: false, recuo: 1.4, marca: '@maurobelem1', modelos: [], luz: [[0, 'dia']], ...cfg};
  const r = new T.WebGLRenderer({antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', stencil: false, depth: true});
  r.setPixelRatio(1); r.setSize(W, H);
  r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
  r.outputColorSpace = T.SRGBColorSpace;
  document.getElementById('stage').appendChild(r.domElement);
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(38, W / H, .1, 600);
  scene.fog = new T.Fog('#d9f1ff', 90, 260);

  // luzes
  const hemi = new T.HemisphereLight('#e8f5ff', '#9fd3ae', 1.5); scene.add(hemi);
  const sun = new T.DirectionalLight('#fff4e2', 2.6); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, {left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 140});
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; scene.add(sun, sun.target);

  // céu: esfera com gradiente (segue a câmara, sem nevoeiro, sem tinta)
  const skyU = {topo: {value: new T.Color()}, meio: {value: new T.Color()}, hor: {value: new T.Color()}};
  const sky = new T.Mesh(new T.SphereGeometry(450, 32, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 topo,meio,hor; varying vec3 vP; void main(){ float e=clamp(vP.y,0.,1.); vec3 c=mix(hor,meio,smoothstep(0.,.18,e)); c=mix(c,topo,smoothstep(.15,.6,e)); gl_FragColor=vec4(c,1.); }'
  }));
  sky.layers.set(NOINK); sky.renderOrder = -1; scene.add(sky);
  cam.layers.enable(NOINK);

  // pós-processamento
  // sem MSAA: no Chrome por CPU custava ~4x o tempo do frame; o SMAA no fim dá arestas iguais à vista (testado)
  const composer = new EffectComposer(r, {frameBufferType: T.HalfFloatType, multisampling: cfg.msaa ?? 0});
  composer.addPass(new RenderPass(scene, cam));
  let ink = null;
  if (cfg.tinta) { ink = new InkPass(scene, cam, cfg.tintaOpcoes || {}); composer.addPass(ink); }
  const lens = new LensBlur({maxCoC: 24, nearScale: 1.2});
  composer.addPass(new EffectPass(cam, lens.pre));
  composer.addPass(new EffectPass(cam, lens.main));
  const tone = new ToneMappingEffect({mode: cfg.look === 'toon' ? ToneMappingMode.NEUTRAL : ToneMappingMode.ACES_FILMIC});
  const grade = new GradeEffect(GRADES.day, cfg.grade ?? (cfg.look === 'toon' ? 1 : .5));
  composer.addPass(new EffectPass(cam, tone, grade));
  composer.addPass(new EffectPass(cam, new SMAAEffect()));

  // materiais: 'suave' = Standard (o look aprovado); 'toon' = 2 tons + tinta (look da skill de referência)
  const matCache = new Map();
  const mat = (cor, o = {}) => {
    const key = cor + JSON.stringify(Object.keys(o).length ? {...o, map: o.map?.uuid} : 0);
    if (!o.map && matCache.has(key)) return matCache.get(key);
    const m = cfg.look === 'toon'
      ? twoTone(new T.MeshLambertMaterial({color: cor, map: o.map || null, transparent: !!o.transparente, opacity: o.opacidade ?? 1}))
      : new T.MeshStandardMaterial({color: cor, map: o.map || null, roughness: o.rugosidade ?? .8, metalness: o.metal ?? 0, transparent: !!o.transparente, opacity: o.opacidade ?? 1, emissive: o.brilho || '#000', flatShading: !!o.plano});
    if (!o.map) matCache.set(key, m);
    return m;
  };
  const sombra = m => (m.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }), m);
  const pai = (o, p) => ((p || scene).add(o), o);
  const pos = (o, x = 0, y = 0, z = 0) => (o.position.set(x, y, z), o);

  // modelos glTF (KayKit em m/): carregados antes de tudo, clonados quando se usam
  const gl = new GLTFLoader(), modelos = {};
  await Promise.all(cfg.modelos.map(n => gl.loadAsync(`m/${n}.gltf`).then(g => {
    if (cfg.look === 'toon') g.scene.traverse(o => { if (o.isMesh) o.material = twoTone(new T.MeshLambertMaterial({map: o.material.map, color: o.material.color})); });
    modelos[n] = g.scene;
  })));

  // tempos (cues.py) e palavras (scribe2json.py)
  const lerJSON = async f => { try { const q = await fetch(f); return q.ok ? await q.json() : null; } catch (e) { return null; } };
  const tempos = (await lerJSON('tempos.json')) || {};
  const palavras = (await lerJSON('palavras.json')) || [];
  await document.fonts.ready;

  // ---------- peças ----------
  const m = {
    T, scene, cam, r, paint, tempos, palavras, cfg, mat, rng,
    grupo: (p, x, y, z) => pai(pos(new T.Group(), x, y, z), p),
    // caixa de cantos arredondados (nunca caixas cruas)
    rbox(w, h, d, cor, o = {}) {
      const g = new RoundedBoxGeometry(w, h, d, 3, o.r ?? Math.min(.08, w * .2, h * .2, d * .2));
      if (o.base !== false) g.translate(0, h / 2, 0);                     // origem na base
      const msh = new T.Mesh(g, o.mat || mat(cor, o)); msh.castShadow = msh.receiveShadow = true;
      return pai(pos(msh, o.x, o.y, o.z), o.pai);
    },
    // modelo KayKit clonado: m.modelo('building_A',{s:2.5,x,z,ry})
    modelo(n, o = {}) {
      if (!modelos[n]) throw new Error(`modelo ${n} não carregado: junta-o a config.modelos`);
      const c = sombra(modelos[n].clone(true)); c.scale.setScalar(o.s ?? 1); c.rotation.y = o.ry ?? 0;
      return pai(pos(c, o.x, o.y, o.z), o.pai);
    },
    // plano com textura pintada (relva, estrada, água…): m.chao(paint.grass(), 200, 200, {rep:40})
    chao(tex, w, d, o = {}) {
      if (tex && o.rep) paint.rep(tex, o.rep, o.rep * d / w);
      const p = new T.Mesh(new T.PlaneGeometry(w, d), mat(o.cor || '#ffffff', {map: tex}));
      p.rotation.x = -Math.PI / 2; p.receiveShadow = true; return pai(pos(p, o.x, o.y ?? 0, o.z), o.pai);
    },
    // placa com texto (só texto que faz parte do mundo e não repete a voz)
    placa(texto, w, h, o = {}) {
      const cw = 2048, ch = Math.round(cw * h / w), c = document.createElement('canvas'); c.width = cw; c.height = ch;
      const g = c.getContext('2d'); g.fillStyle = o.fundo || '#ffffff'; const rr = ch * .18;
      g.beginPath(); g.roundRect(0, 0, cw, ch, rr); g.fill();
      let fs = ch * .62; g.font = `900 ${fs}px Poppins`; while (g.measureText(texto).width > cw * .86 && fs > 10) g.font = `900 ${fs *= .94}px Poppins`;
      g.fillStyle = o.cor || '#0a2a5c'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(texto, cw / 2, ch / 2 + fs * .04);
      const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 8;
      const p = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({map: tx, toneMapped: false, transparent: true}));
      return pai(pos(p, o.x, o.y, o.z), o.pai);
    },
  };

  // ---------- personagens (cartões cartoon da toon.js) ----------
  // outfit: {jacket, pants, boots, hat:'hair'|'cap', hair, cap, skin, build:'adult'|'stout'|'kid'}
  const PELES = ['#8d5524', '#6b3e1f', '#a0672e', '#5a3418', '#c99067'];
  m.PELES = PELES;
  m.pessoa = (outfit, o = {}) => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 1000; const g = c.getContext('2d');
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
    const alt = o.altura ?? 1.75, geo = new T.PlaneGeometry(alt * .6, alt); geo.translate(0, alt / 2 - alt * .025, 0);
    const msh = new T.Mesh(geo, new T.MeshBasicMaterial({map: tex, transparent: true, alphaTest: .5, toneMapped: false, side: T.DoubleSide}));
    msh.castShadow = true; msh.layers.set(NOINK);
    const blob = new T.Mesh(new T.CircleGeometry(alt * .2, 24), new T.MeshBasicMaterial({color: '#000', transparent: true, opacity: .22, depthWrite: false}));
    blob.rotation.x = -Math.PI / 2; blob.position.y = .02; blob.layers.set(NOINK);
    const grp = pai(pos(new T.Group(), o.x, o.y, o.z), o.pai); grp.add(msh, blob);
    let key = '';
    grp.userData.desenhar = (op) => { const k = JSON.stringify(op); if (k === key) return; key = k; g.clearRect(0, 0, 600, 1000); bodyFront(new Pen(g), {skin: PELES[0], ...outfit}, op); tex.needsUpdate = true; };
    grp.userData.card = msh; grp.userData.seed = o.seed ?? 1;
    return grp;
  };
  // pose por frame: nunca parado (respira, pisca, ressalta), sempre virado para a câmara
  m.posar = (p, t, op = {}) => {
    const s = p.userData.seed, card = p.userData.card;
    const blink = ((Math.round(t * FPS) + s * 37) % 97) < 3 ? 1 : 0;
    const q = v => Math.round(v * 20) / 20;
    p.userData.desenhar({expr: 'neutral', mode: 'stand', seed: s, ...op, blink: op.blink ?? blink, phase: q(op.phase ?? 0)});
    const bob = op.mode === 'stroll' || op.mode === 'march' ? Math.abs(Math.sin(t * 8)) * .05 : Math.sin(t * 2.2 + s) * .012;
    card.position.y = bob + (op.salto || 0);
    card.scale.set(1 + (op.squash || 0), 1 - (op.squash || 0), 1);
    card.rotation.z = op.inclina || 0;
    cartoes.add(p);                       // a orientação para a câmara é feita em m.frame, DEPOIS de a câmara se mexer
  };
  const cartoes = new Set();
  const virarCartoes = () => { const wp = new T.Vector3(); for (const p of cartoes) { p.getWorldPosition(wp); p.userData.card.rotation.y = Math.atan2(cam.position.x - wp.x, cam.position.z - wp.z) - p.rotation.y; } };

  // ---------- animações de objeto ----------
  // cai do céu e aterra EXATAMENTE em tAterra, com esmagamento e ressalto (pó: m.fx.po)
  m.cai = (o, t, tA, {altura = 6, dur = .45, base = null} = {}) => {
    const b = base || (o.userData.base ??= o.position.clone()), s0 = o.userData.s0 ??= o.scale.clone();
    o.visible = t >= tA - dur;
    const k = clamp((t - (tA - dur)) / dur), y = b.y + altura * (1 - k * k);
    const sq = t >= tA ? Math.exp(-(t - tA) * 9) * Math.sin((t - tA) * 30) * .18 : 0;
    o.position.set(b.x, t < tA ? y : b.y, b.z);
    o.scale.set(s0.x * (1 + sq), s0.y * (1 - sq) * (t < tA ? 1 + .12 * k : 1), s0.z * (1 + sq));
  };
  // entra com pop (escala com ultrapassagem)
  m.surge = (o, t, t0, {dur = .35} = {}) => {
    const s0 = o.userData.s0 ??= o.scale.clone(); const k = clamp((t - t0) / dur);
    o.visible = t >= t0; o.scale.copy(s0).multiplyScalar(t >= t0 + dur ? 1 : Math.max(.001, back(k, 2.2)));
  };
  // sobe do chão (paredes): progresso com ressalto
  m.sobe = (o, t, t0, {dur = .5} = {}) => {
    const s0 = o.userData.s0 ??= o.scale.clone(); const k = clamp((t - t0) / dur);
    o.visible = t >= t0; o.scale.set(s0.x, s0.y * Math.max(.001, k >= 1 ? 1 : back(k, 1.6)), s0.z);
  };
  // move ao longo de pontos [[x,y,z],…] entre t0 e t1 (Catmull-Rom), virado para a frente
  m.viaja = (o, t, t0, t1, pts, {vira = true, f = smoother} = {}) => {
    const cv = o.userData.cv ??= new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p)));
    const k = f(clamp((t - t0) / (t1 - t0))); const p = cv.getPointAt(k); o.position.copy(p);
    if (vira) { const q = cv.getTangentAt(Math.min(.999, k)); o.rotation.y = Math.atan2(q.x, q.z); }
  };

  // ---------- efeitos (criados na 1.ª vez, posicionados em função de t) ----------
  const fxPool = {};
  const discoTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.6, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new T.CanvasTexture(c); return t; })();
  const sprite = (cor, map = discoTex) => { const s = new T.Sprite(new T.SpriteMaterial({map, color: cor, transparent: true, depthWrite: false, toneMapped: false})); s.layers.set(NOINK); scene.add(s); return s; };
  const textoTex = (txt, cor) => { const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d'); g.font = '900 150px Poppins'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 26; g.strokeStyle = '#0a2a5c'; g.strokeText(txt, 256, 132); g.fillStyle = cor; g.fillText(txt, 256, 128); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };
  m.fx = {
    // nuvem de pó numa aterragem: m.fx.po('id', t, t0, [x,y,z])
    po(id, t, t0, [x, y, z], {n = 12, cor = '#f3ead8', raio = 1.2} = {}) {
      const P = fxPool[id] ??= Array.from({length: n}, (_, i) => sprite(cor));
      const R = rng(id.length * 31 + n);
      P.forEach((s, i) => { const a = i / n * Math.PI * 2 + R() * .4, sp = .6 + R() * .6, k = (t - t0) / .8; s.visible = k >= 0 && k < 1;
        if (!s.visible) return; const e = easeOut(k); s.position.set(x + Math.cos(a) * raio * sp * e, y + .15 + e * .5 * R(), z + Math.sin(a) * raio * sp * e); s.scale.setScalar((.35 + .5 * e) * raio); s.material.opacity = (1 - k) * .85; });
    },
    // confetti no "Parabéns"
    confetti(id, t, t0, [x, y, z], {n = 70, cores = ['#1f6fd6', '#34c27a', '#9be8b4', '#ffd21f', '#ffffff']} = {}) {
      const P = fxPool[id] ??= Array.from({length: n}, (_, i) => { const p = new T.Mesh(new T.PlaneGeometry(.12, .2), new T.MeshBasicMaterial({color: cores[i % cores.length], side: T.DoubleSide, toneMapped: false})); p.layers.set(NOINK); scene.add(p); return p; });
      const R = rng(n + 7);
      P.forEach((p, i) => { const k = t - t0; p.visible = k >= 0 && k < 3.5; if (!p.visible) return;
        const vx = (R() - .5) * 6, vy = 4 + R() * 5, vz = (R() - .5) * 6, ph = R() * 6;
        p.position.set(x + vx * k, y + vy * k - 4.9 * k * k * .55, z + vz * k); p.rotation.set(ph + k * 7, ph * 2 + k * 5, k * 3); });
    },
    // onomatopeia cartoon junto ao objeto ("TUM!", "SPLASH!")
    onoma(id, t, t0, [x, y, z], txt, {cor = '#ffd21f', tam = 2} = {}) {
      const s = fxPool[id] ??= sprite('#ffffff', textoTex(txt, cor)); const k = t - t0;
      s.visible = k >= 0 && k < .7; if (!s.visible) return;
      s.position.set(x, y + k * .5, z); s.scale.set(tam * back(clamp(k / .18), 2.5), tam * .5 * back(clamp(k / .18), 2.5), 1); s.material.opacity = 1 - clamp((k - .5) / .2);
    },
    // balão de reação por cima de uma personagem: '?', '!', '❤', '✓', '✗'
    balao(id, t, t0, t1, [x, y, z], txt, {cor = '#ffffff'} = {}) {
      const s = fxPool[id] ??= sprite('#ffffff', textoTex(txt, cor)); s.visible = t >= t0 && t < t1; if (!s.visible) return;
      const k = clamp((t - t0) / .25); s.position.set(x, y + Math.sin(t * 6) * .04, z); s.scale.set(1.2 * back(k, 2), .6 * back(k, 2), 1);
    },
  };

  // ---------- interface: legendas, marca, CTA, flash ----------
  const ui = document.getElementById('ui');
  ui.insertAdjacentHTML('beforeend', `<div id="cap"></div><div id="marca">${cfg.marca}</div><div id="cta"><div class="t"></div><div class="a">${cfg.marca}</div></div><div id="flash"></div>`);
  const $ = id => document.getElementById(id);
  // grupos de 1-3 palavras; quebra na pontuação ou em pausas > 0,25 s
  const POS = new Set((cfg.legendas?.positivo || []).map(w => w.toLowerCase())), NEG = new Set((cfg.legendas?.negativo || []).map(w => w.toLowerCase()));
  const grupos = []; let cur = [];
  palavras.forEach((w, i) => { cur.push(w); const n = palavras[i + 1]; const fim = /[.!?,;:…]$/.test(w.w) || !n || n.s - w.e > .25 || cur.length === 3; if (fim) { grupos.push(cur); cur = []; } });
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const POSn = new Set([...POS].map(norm)), NEGn = new Set([...NEG].map(norm));
  let capKey = '';
  const legendas = (t, esconder) => {
    // o 1.º grupo aparece já no frame 0 (o gancho escrito é a capa do vídeo), com a 1.ª palavra visível
    const g = esconder ? null : grupos.find((g, i) => (i === 0 ? t >= 0 : t >= g[0].s - .05) && t < (grupos[i + 1] ? grupos[i + 1][0].s - .05 : g[g.length - 1].e + .6));
    const key = g ? g[0].s + '|' + g.filter(w => t >= w.s - .05).length : '';
    if (key !== capKey) {
      capKey = key;
      $('cap').innerHTML = g ? g.map((w, j) => { const n = norm(w.w), cls = POSn.has(n) ? 'pos' : NEGn.has(n) ? 'neg' : ''; const vis = t >= w.s - .05 || (g === grupos[0] && j === 0); return `<span class="${cls}${vis ? '' : ' fut'}">${cls ? w.w.toUpperCase() : w.w}</span>`; }).join(' ') : '';
    }
    if (g) { const k = g === grupos[0] ? 1 : clamp((t - g[0].s + .05) / .12); $('cap').style.transform = `translateX(-50%) scale(${.86 + .14 * back(k, 2)})`; }
  };

  // ---------- render de um frame ----------
  const cv = curva(cfg.camera, cfg.recuo);
  const luzAt = t => {
    const L = cfg.luz; let i = 0; while (i < L.length - 1 && t >= L[i + 1][0]) i++;
    const a = LUZES[L[i][1]], prev = i > 0 ? LUZES[L[i - 1][1]] : a, k = i > 0 ? clamp((t - L[i][0]) / .6) : 1;
    const o = {}; for (const key in a) o[key] = typeof a[key] === 'number' ? lerp(prev[key], a[key], k) : (key === 'grade' ? a[key] : mixHex(prev[key], a[key], k));
    return o;
  };
  const fwd = new T.Vector3(), fp = new T.Vector3();
  let flashes = cfg.flash || [], abanos = cfg.abanos || [];
  m.frame = (t, extra = {}) => {
    // câmara
    const c = cv(t), c0 = cv(t - 1 / FPS);
    const mao = [Math.sin(t * 1.1) * .07, Math.sin(t * 1.7 + 1) * .05, 0];
    let sh = 0; for (const [ta, f = 1] of abanos) { const k = (t - ta) * FPS; if (k >= 0 && k < 7) sh += f * (1 - k / 7) * (k % 2 ? 1 : -1) * .12; }
    cam.position.set(c.pos[0] + mao[0] + sh, Math.max(1.3, c.pos[1] + mao[1] + sh * .5), c.pos[2]);
    cam.fov = c.fov; cam.updateProjectionMatrix(); cam.lookAt(...c.alvo);
    if (extra.rolo) cam.rotateZ(extra.rolo * Math.PI / 180);
    scene.updateMatrixWorld(); virarCartoes();
    const vel = Math.hypot(...c.pos.map((v, i) => v - c0.pos[i])) * FPS;
    r.domElement.style.filter = vel > 22 ? `blur(${Math.min(6, (vel - 22) * .12).toFixed(1)}px)` : '';
    // luz: sol segue o ponto para onde a câmara olha
    const L = luzAt(t); const az = L.az * Math.PI / 180, el = L.el * Math.PI / 180;
    sun.target.position.set(...c.alvo); sun.position.set(c.alvo[0] + Math.cos(el) * Math.sin(az) * 60, c.alvo[1] + Math.sin(el) * 60, c.alvo[2] + Math.cos(el) * Math.cos(az) * 60);
    sun.color.set(L.sol); sun.intensity = L.solI; hemi.color.set(L.hemiC); hemi.groundColor.set(L.hemiS); hemi.intensity = L.hemiI;
    skyU.topo.value.set(L.topo); skyU.meio.value.set(L.meio); skyU.hor.value.set(L.hor); scene.fog.color.set(L.nevoa);
    sky.position.copy(cam.position);
    if (cfg.look === 'toon') { TONE.uLitCol.value.set(...new T.Color(L.sol).toArray().map(v => v * L.solI * .58)); }
    // profundidade de campo: foco no ponto de foco (ou no alvo), dof = raio no infinito em px (0 = tudo nítido)
    cam.getWorldDirection(fwd); fp.set(...(c.foco || c.alvo));
    lens.focus = Math.max(.3, fp.sub(cam.position).dot(fwd)); lens.cInf = c.dof;
    // interface
    const cta = cfg.cta && t >= cfg.cta.t;
    legendas(t, cta);
    $('marca').style.opacity = cta ? 0 : .55;
    if (cfg.cta) { const k = clamp((t - cfg.cta.t) / .35); $('cta').style.opacity = k; $('cta').style.transform = `translateX(-50%) scale(${.8 + .2 * back(k, 2)})`; $('cta').querySelector('.t').innerHTML = cfg.cta.texto; }
    let fl = 0; for (const tf of flashes) { const k = (t - tf) * FPS; if (k >= 0 && k < 6) fl = Math.max(fl, 1 - k / 6); } $('flash').style.opacity = fl;
    composer.render();
  };
  return m;
}
