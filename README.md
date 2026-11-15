# reels-kit — motor dos Reels @maurobelem1

Kit fixo usado pela skill **roteiro-para-video** (fase 2). O motor não se edita por vídeo: cada vídeo só escreve o `story.js`.

## Começar um vídeo
```bash
git clone --depth 1 https://github.com/<conta>/reels-kit ~/reels-kit
bash ~/reels-kit/setup.sh ~/proj          # copia motor + ferramentas, instala three/postprocessing, modelos KayKit em m/
cd ~/proj                                  # (sem story.js, copia o exemplo do chapa)
```

## Fluxo
| Passo | Comando | Sai |
|---|---|---|
| tempos reais (Scribe) | `python3 -I scribe2json.py scribe.json roteiro.txt` | `palavras.json` |
| guião → tempos | `python3 -I cues.py guiao.json palavras.json` | `tempos.json`, `cues.json` |
| escrever a história | editar só `story.js` (config + montar + atualizar) | |
| storyboard | `node stills.mjs st "0.4,2,3.3" --legenda "gancho,chapa,saco"` | `st/folha.jpg` |
| sincronia | `node syncsheet.mjs` | `sync_sheet.jpg` |
| render (retoma sozinho) | `node render.mjs --proc 2` e depois `node render.mjs juntar` | `frames/`, `mudo.mp4` |
| som | `python3 audio.py cues.json DURACAO` → `python3 mix.py voz.mp3 music.wav sfx.wav` | `mix.wav` |
| final + QA | `python3 finish.py mudo.mp4 mix.wav final.mp4` | `final.mp4`, `qa_sheet.jpg` |
| copiar um estilo | `python3 -I ref.py ref.mp4` | `ref/folha.jpg`, `ref/ficha.json` |

## O story.js
```js
import {T, paint, clamp, prog, back, smoother, easeOut, easeIn, lerp} from './motor.js';
export const config = {
  duracao: 45,                     // áudio + CTA
  look: 'suave',                   // 'suave' (aprovado) | 'toon' (2 tons; com tinta: true)
  tinta: false,                    // contornos a tinta (~3x mais lento)
  recuo: 1.4,                      // multiplica a distância câmara→alvo (não nos planos com aereo: true)
  modelos: ['road_straight', 'building_A'],    // KayKit a carregar (m/<nome>.gltf)
  luz: [[0, 'dia'], [12.4, 'dourado'], [20, 'noite']],   // muda em 0,6 s
  legendas: {positivo: ['enorme'], negativo: ['cobra']},  // palavra-chave em caixa azul / vermelha
  cta: {t: 41, texto: 'Comenta <b>FRETE</b><br>que eu te mando…'},
  flash: [12.4], abanos: [[4.7, 1]],          // flash branco 6 frames; abano 7 frames
  camera: [[t, [x,y,z], [alvoX,alvoY,alvoZ], {fov: 38, dof: 8, foco: [x,y,z], aereo: false}], …],
};
export async function montar(m) { … constrói o mundo uma vez; devolve o estado … }
export function atualizar(t, m, s) { … põe tudo no sítio para o instante t (sem Math.random, sem Date) … }
```

### O que o motor dá (`m`)
- **Peças:** `m.rbox(w,h,d,cor,{x,y,z,pai,r,map})` (cantos arredondados, origem na base), `m.modelo('building_A',{s,x,y,z,ry,pai})`, `m.chao(paint.grass(),w,d,{rep})`, `m.placa(texto,w,h,{fundo,cor})`, `m.grupo(pai,x,y,z)`, `m.mat(cor,{map,metal,rugosidade})`.
- **Texturas pintadas:** `paint.grass() / cobble() / stone() / planks() / brick() / roof(cor) / water()`, e `paint.ctex(chave,w,h,(g,rng)=>…)` para as tuas.
- **Personagens:** `m.pessoa({jacket,pants,boots,hat:'cap'|'hair',cap,hair,skin:m.PELES[i],build},{x,y,z,seed,altura})` e por frame `m.posar(p,t,{expr,mode,look,wave,salto,squash,inclina})`. Expressões: neutral, stern, grin, laugh, whistle, nervous, shock, relief. Modos: stand, stroll, march, sit, fall, push. Piscam, respiram e viram-se para a câmara sozinhos.
- **Ações:** `m.cai(obj,t,tAterra,{altura,dur})` aterra exatamente na palavra, com esmagamento; `m.surge(obj,t,t0)` pop; `m.sobe(obj,t,t0)` paredes a subir; `m.viaja(obj,t,t0,t1,pontos)` caminho Catmull-Rom.
- **Efeitos:** `m.fx.po(id,t,t0,[x,y,z])`, `m.fx.confetti(id,t,t0,pos)`, `m.fx.onoma(id,t,t0,pos,'TUM!')`, `m.fx.balao(id,t,t0,t1,pos,'?')`.
- **Tempos:** `m.tempos.<id>` (de `tempos.json`); as legendas vêm de `palavras.json`.
- **Câmara:** Hermite com tangentes monótonas (não recua antes das viagens), mão ao ombro, desfoque de movimento acima de 22 u/s, profundidade de campo por chave (`dof` em px no infinito; foco no alvo ou em `foco`).
- **Interface:** legendas de 1 a 3 palavras (top 1340), @ pequeno por baixo (top 1490), cartão do CTA no terço de cima, flash.

## Estilos 2D (A, B, D-G)
As páginas 2D (Excel ao vivo, rota & custos, tipografia, WhatsApp, antes/depois, fatura) não usam o motor 3D: cada uma é um `video.html` com `window.renderAt(t)`, feito a partir de `excel_test.html` (A) ou `import_test.html` (B), com `core.js`, `motion.js` (`pop`, `rise`, `count`, `draw`, `along`), `excel.js`/`excel.css` e `base2d.css`.
As ferramentas servem para as duas: `node stills.mjs st "1,2" --pagina video.html`, `node render.mjs --pagina video.html --dur 32`, `node syncsheet.mjs --pagina video.html`.

### Estilo I: ecrã dividido (duas personagens em espelho)
`motor2d/dividido.html` é o vídeo "Hélio e Zito" (aprovado a 100%). Para um vídeo novo: `SO2D=1 bash setup.sh proj`, copia `dividido.html` para `video.html` e muda as peças e a linha do tempo; `exemplo2d/` tem o roteiro e o `guiao.json` desse vídeo.
- Dois painéis (`#L`, `#R`) cortados por `split(t)`: 0,5 = dividido, 1 = só a esquerda, 0 = só a direita. Cada painel tem um contentor de 1080x1920 centrado na personagem.
- `pessoa()` + `posar()` (expressões smile, neutral, sad, shock, laugh, nervous; pisca e respira), `V()` entra com mola e sai, `fall()` cai e aterra na palavra.
- Todos os tempos vêm de `tempos.json` (`T.id`); as legendas de 2 a 3 palavras vêm de `palavras.json` + `roteiro.txt`.
- Sem voz ainda: `python3 -I est.py roteiro.txt` cria um `palavras.json` estimado para montar e ver o storyboard; quando o MP3 chegar, `timing.py` (ou Scribe) + `cues.py` e render.

## Desempenho (Chrome por CPU, 2 núcleos)
- ~1,7 s por frame com 2 processos (desfoque de lente ligado): 10 s ≈ 9 min, 45 s ≈ 38 min.
- O MSAA custava ~4x o frame; está desligado e o SMAA no fim dá arestas iguais à vista.
- `tinta: true` cerca de triplica o tempo.

## Licenças
- Motor e ferramentas: deste projeto.
- `motor/vendor/` (toon, lensblur, shade, paint, grade, ink, cardshade): de [mromidev/claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts), MIT (ver `LICENSE-mromidev`), convertidos de TypeScript.
- Modelos KayKit: CC0, descarregados pelo `setup.sh`.
