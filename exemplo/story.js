// story.js — o ÚNICO ficheiro que se escreve por vídeo. O motor (motor.js) não se toca.
// Exemplo: "Imagina que vais de chapa com um saco enorme. Ocupa um banco inteiro. E o cobrador cobra esse lugar."
// Os tempos vêm de tempos.json (cues.py): m.tempos.sacoCai, etc. Nada de tempos escritos à mão para as ações.
import {T, paint, clamp, prog, back, smoother, easeOut, easeIn, lerp} from './motor.js';

export const config = {
  duracao: 10.6,
  look: 'suave',            // 'suave' (aprovado) ou 'toon' (2 tons, usar com tinta: true)
  tinta: false,             // contornos a tinta: ~3x mais lento
  recuo: 1.0,               // as chaves abaixo já estão à distância certa
  modelos: ['road_straight', 'building_A', 'building_B', 'building_C', 'building_D', 'building_E', 'building_G', 'streetlight', 'bush', 'car_sedan', 'car_taxi'],
  luz: [[0, 'dia']],
  legendas: {positivo: ['enorme'], negativo: ['cobra']},
  cta: {t: 8.9, texto: 'Comenta <b>FRETE</b><br>que eu te explico o resto'},
  // câmara: [t, posição, alvo, {fov, dof (px de desfoque no infinito; 0 = nítido), foco, aereo}]
  camera: [
    [0.0, [3.4, 1.9, 9.4], [1.7, 1.45, 4.6], {dof: 11}],              // gancho: grande plano do passageiro
    [1.2, [3.1, 1.85, 9.0], [1.5, 1.45, 4.5], {dof: 11}],
    [2.2, [4.6, 3.0, 12.5], [0.2, 1.3, 2.6], {dof: 5}],                // abre: o chapa chega à paragem
    [3.0, [5.6, 2.7, 11.4], [2.2, 1.3, 4.5], {dof: 7}],                // o saco ao lado do passageiro
    [3.9, [5.4, 2.7, 11.2], [2.1, 1.3, 4.5], {dof: 7}],                // espera antes da viagem
    [4.5, [0.8, 3.7, 10.6], [-0.8, 1.85, 1.3], {dof: 7}],               // dentro (corte lateral): o banco
    [5.9, [0.4, 3.6, 10.3], [-1.0, 1.85, 1.3], {dof: 7}],
    [6.45, [-6.6, 2.2, 7.4], [-4.3, 1.4, 2.0], {dof: 10}],             // traseira do chapa: o cobrador
    [7.5, [-3.2, 4.0, 9.0], [-1.5, 2.2, 1.4], {dof: 7}],             // as moedas a cair no saco
    [8.4, [3.5, 9.5, 17], [-0.8, 1.0, 1.0], {dof: 0, aereo: true}],    // fecho aéreo
    [10.6, [4.5, 10.5, 18.5], [-0.6, 1.0, 1.0], {dof: 0, aereo: true}],
  ],
};

const ESTRADA = 0.3, PASSEIO = 0.5;   // topo da estrada KayKit x3 e do passeio
// textura do saco de ráfia (riscas azuis/brancas/vermelhas, como nos mercados)
function rafia() {
  return paint.ctex('rafia', 256, 256, (g, r) => {
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 256, 256);
    [['#1f6fd6', 18], ['#e5383b', 6], ['#1f6fd6', 18]].reduce((y, [c, h]) => (g.fillStyle = c, g.fillRect(0, y, 256, h), y + h + 14), 40);
    [['#1f6fd6', 18], ['#e5383b', 6], ['#1f6fd6', 18]].reduce((y, [c, h]) => (g.fillStyle = c, g.fillRect(0, y, 256, h), y + h + 14), 160);
    g.globalAlpha = .08; for (let i = 0; i < 256; i += 3) { g.fillStyle = i % 6 ? '#000' : '#fff'; g.fillRect(i, 0, 1, 256); }
  });
}

export async function montar(m) {
  const {rbox, modelo, pessoa, grupo, mat} = m;
  // chão e cidade
  m.chao(paint.grass(), 300, 300, {rep: 60, cor: '#bfe8c4', y: 0});
  for (let x = -66; x <= 66; x += 6) modelo('road_straight', {s: 3, x, z: 0, ry: Math.PI / 2});
  rbox(140, .2, 3, '#e3e7ee', {x: 0, y: ESTRADA, z: 4.6, r: .05});                     // passeio
  const casas = ['building_A', 'building_B', 'building_C', 'building_D', 'building_E', 'building_G'];
  for (let i = 0; i < 14; i++) modelo(casas[i % 6], {s: 2.5, x: -36 + i * 5.6, z: -11});           // prédios do outro lado da estrada
  for (let i = 0; i < 6; i++) modelo('streetlight', {s: 2.2, x: -24 + i * 9, z: -5.2});
  // paragem (abrigo)
  const par = grupo(null, 5.4, PASSEIO, 4.9);   // ao lado do passageiro, nunca entre ele e a câmara
  rbox(.12, 2.4, .12, '#0a2a5c', {pai: par, x: -1.3}); rbox(.12, 2.4, .12, '#0a2a5c', {pai: par, x: 1.3});
  rbox(2.9, .12, 1.3, '#1f6fd6', {pai: par, y: 2.4}); rbox(2.6, .5, .45, '#9be8b4', {pai: par, y: .45, z: .1});

  // o chapa: carroçaria branca com faixa azul; o painel do lado da câmara abre (corte) para se ver o banco
  const chapa = grupo(null, -30, ESTRADA, 1.6);
  const corpo = grupo(chapa);
  const casco = grupo(corpo, 0, .4, 0);   // a carroçaria fica ACIMA das rodas (as rodas não podem entrar na cabine)
  // carroçaria OCA (chão, tejadilho, lado de lá, frente e trás) para o corte lateral mostrar o interior
  rbox(5.6, .16, 2.2, '#dfe5ee', {pai: casco, y: .45, r: .06});
  rbox(5.6, .2, 2.2, '#f7f9fc', {pai: casco, y: 2.2, r: .1});
  rbox(5.6, 1.9, .1, '#f7f9fc', {pai: casco, y: .45, z: -1.05, r: .04});
  rbox(.12, 1.9, 2.2, '#f7f9fc', {pai: casco, x: -2.74, y: .45, r: .05});
  rbox(.12, 1.9, 2.2, '#f7f9fc', {pai: casco, x: 2.74, y: .45, r: .05});
  rbox(5.62, .22, .12, '#1f6fd6', {pai: casco, y: 1.05, z: -1.06, r: .04});
  for (const x of [-1.6, -.3, 1.0]) rbox(1.0, .55, .04, '#2b84ea', {pai: casco, x, y: 1.65, z: -.99, rugosidade: .2});
  rbox(1.0, 1.1, 2.0, '#bfe6ff', {pai: casco, x: 2.35, y: 1.05, r: .2, rugosidade: .2});  // para-brisas
  for (const [x, z] of [[-1.8, -1], [1.8, -1], [-1.8, 1], [1.8, 1]]) {
    const roda = new T.Mesh(new T.CylinderGeometry(.42, .42, .3, 24), mat('#1b1b1b')); roda.rotation.x = Math.PI / 2; roda.position.set(x, .42, z * 1.08); roda.castShadow = true; corpo.add(roda);
  }
  // interior: bancos
  for (const x of [-1.6, -.3, 1.0]) rbox(.9, .5, 1.6, '#0a2a5c', {pai: casco, x, y: .65, z: -.1});
  const banco = casco.children[casco.children.length - 2];   // o banco do meio (x = -0,3)
  // painel do lado da câmara (pivô em baixo): fecha -> abre como uma tampa
  const painel = grupo(casco, 0, .45, 1.1);
  rbox(5.6, 1.9, .08, '#f7f9fc', {pai: painel, z: 0, r: .03});
  rbox(5.62, .22, .1, '#1f6fd6', {pai: painel, y: .6});
  for (const x of [-1.6, -.3, 1.0]) rbox(1.0, .55, .1, '#2b84ea', {pai: painel, x, y: 1.2, z: .01, rugosidade: .2});

  // pessoas (tons de pele moçambicanos, roupa na paleta)
  const pass = pessoa({jacket: '#34c27a', pants: '#0a2a5c', boots: '#3b2a1f', hat: 'cap', cap: '#1f6fd6', skin: m.PELES[1]}, {x: 1.6, y: PASSEIO, z: 4.5, seed: 4});
  const cob = pessoa({jacket: '#1f6fd6', pants: '#2b2b2b', boots: '#222', hat: 'hair', hair: '#1b1b1b', skin: m.PELES[3]}, {x: -4.35, y: ESTRADA, z: 2.1, seed: 9, altura: 1.7});

  // o saco
  const saco = grupo(null, 0.5, PASSEIO, 4.4);
  const sacoM = rbox(.8, .7, .6, '#ffffff', {pai: saco, map: rafia(), r: .18});
  rbox(.2, .14, .2, '#e8e2d4', {pai: saco, y: .7, r: .05});  // nó

  // moedas
  const moedas = Array.from({length: 5}, (_, i) => { const c = new T.Mesh(new T.CylinderGeometry(.26, .26, .07, 28), mat('#ffd21f', {metal: .6, rugosidade: .35})); c.castShadow = true; m.scene.add(c); return c; });

  // trânsito ao fundo (faixa de lá)
  const carros = [['car_sedan', 0], ['car_taxi', 7], ['car_sedan', 15]].map(([n, o]) => ({c: modelo(n, {s: 3.6, x: 0, y: ESTRADA, z: -1.6, ry: -Math.PI / 2}), o}));
  return {chapa, corpo, painel, banco, pass, cob, saco, sacoM, moedas, carros};
}

export function atualizar(t, m, s) {
  const Q = m.tempos;
  // o chapa entra pela estrada e trava na paragem na palavra "chapa" (com leve inclinação de travagem)
  const tc = Q.chapaChega, x = t < tc ? lerp(-30, -1, easeOut(clamp((t - (tc - 1.3)) / 1.3))) : -1;
  s.chapa.position.x = x;
  s.corpo.rotation.z = t > tc ? -Math.exp(-(t - tc) * 6) * Math.sin((t - tc) * 18) * .05 : 0;
  // painel lateral abre na viagem para o banco ("Ocupa")
  const kp = prog(t, Q.viajaBanco - .15, Q.viajaBanco + .45, easeIn);
  s.painel.rotation.x = kp * .9; s.painel.position.set(0, .45 + kp * 7, 1.1 + kp * 2.5); s.painel.visible = kp < 1;
  // saco: cai ao lado do passageiro -> incha em "enorme" -> salta para o banco e aterra em "banco"
  const tb = Q.sacoBanco, ts = Q.sacoCai;
  const cresce = 1 + .9 * prog(t, Q.sacoCresce - .05, Q.sacoCresce + .35, k => back(k, 2));
  if (t < Q.viajaBanco + .2) {
    s.saco.position.set(0.5, 0.5, 4.4); s.saco.userData.base = new T.Vector3(0.5, .5, 4.4);
    m.cai(s.saco, t, ts, {altura: 5, base: new T.Vector3(0.5, .5, 4.4)});
    s.saco.scale.multiplyScalar(cresce);
  } else {
    // arco do passeio até ao banco do meio (dentro do chapa), aterra em tb
    const k = clamp((t - (Q.viajaBanco + .2)) / (tb - (Q.viajaBanco + .2)));
    const a = new T.Vector3(0.5, .5, 4.4), b = new T.Vector3(-1.3, ESTRADA + 1.3, 1.5);
    s.saco.position.lerpVectors(a, b, smoother(k)); s.saco.position.y += Math.sin(Math.PI * k) * 2.2;
    s.saco.visible = true;
    const sq = t > tb ? Math.exp(-(t - tb) * 8) * Math.sin((t - tb) * 28) * .2 : 0;
    s.saco.scale.set(cresce * (1 + sq), cresce * (1 - sq), cresce * (1 + sq));
    s.saco.rotation.y = (1 - smoother(k)) * .6;
  }
  m.fx.po('po_saco', t, ts, [0.5, .5, 4.4]);
  m.fx.po('po_banco', t, tb, [-1.3, 1.6, 1.5], {raio: 1});
  // o banco afunda quando o saco aterra
  s.banco.scale.y = 1 - (t > tb ? .35 * Math.exp(-(t - tb) * 5) : 0);
  // moedas caem sobre o saco em "cobra", uma a uma
  s.moedas.forEach((c, i) => {
    const t0 = Q.moedas + i * .12; c.position.set(-1.3 + (i - 2) * .34, 0, 1.6 + (i % 2) * .25);
    c.userData.base = new T.Vector3(c.position.x, ESTRADA + 2.35 + i * .06, c.position.z); m.cai(c, t, t0, {altura: 4, dur: .35});
    c.rotation.set(.3 * i, t * 3 + i, 0);
  });
  // passageiro: espera (olha o relógio) -> surpresa no "enorme" -> nervoso no "cobra"
  const pe = t < Q.sacoCresce ? 'neutral' : t < Q.moedas ? 'shock' : 'nervous';
  m.posar(s.pass, t, {expr: pe, mode: 'stand', look: t < Q.chapaChega ? -.4 : .3});
  // cobrador: aparece à porta em "cobrador" e aponta/acena
  s.cob.visible = t >= Q.cobrador - .02; m.surge(s.cob, t, Q.cobrador - .02);
  m.posar(s.cob, t, {expr: t < Q.moedas ? 'grin' : 'laugh', mode: 'stand', wave: t > Q.moedas ? Math.sin(t * 9) * .5 + .5 : undefined, seed: 9});
  m.fx.balao('b_pass', t, Q.lugar, 99, [1.6, 2.6, 4.5], '!');
  m.fx.onoma('on_banco', t, tb, [-1.3, 2.0, 2.7], 'TUM!', {tam: 1.3});
  // trânsito contínuo na outra faixa
  s.carros.forEach(({c, o}, i) => { c.position.x = ((t * 6 + o * 4) % 70) - 35; });
}
