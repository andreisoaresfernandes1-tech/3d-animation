// Como construir um túnel subterrâneo — animação 3D didática (Three.js)
// Toda a cena é função determinística do tempo t (segundos), o que permite
// tanto a reprodução no navegador quanto a renderização quadro a quadro em MP4.
import * as THREE from 'three';

export const DURATION = 136.5;  // 0–7 abertura · 7–79.5 cinco tentativas que desabam · 79.5–136.5 a tentativa que dá certo
const QS = new URLSearchParams(location.search);
const VERT = QS.has('vertical');            // formato 9:16 (Reels / Shorts / TikTok)
const W = VERT ? 720 : 1280, H = VERT ? 1280 : 720;
if (VERT) document.body.classList.add('vertical');

// ---------------------------------------------------------------- helpers
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const seg = (t, t0, t1) => clamp((t - t0) / (t1 - t0), 0, 1);
const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const ease = (x) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const fadeIO = (t, t0, t1, d = 0.6) => Math.min(seg(t, t0, t0 + d), 1 - seg(t, t1 - d, t1));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function keys(t, ks) { // [[t, v, easeFn?], ...]
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 0; i < ks.length - 1; i++) {
    const [t0, v0] = ks[i], [t1, v1, e] = ks[i + 1];
    if (t <= t1) return lerp(v0, v1, (e || ((x) => x))((t - t0) / (t1 - t0)));
  }
  return ks[ks.length - 1][1];
}

// ---------------------------------------------------------------- geometry constants
const XL = -52, XR = 52, ZB = -16;            // bloco de solo (corte em z = 0)
const SX0 = -38, SX1 = -27;                    // poço de lançamento
const AX0 = 38, AX1 = 46;                      // poço de chegada
const SZ = -9;                                 // fundo dos poços (em z)
const SD = 19.6;                               // profundidade dos poços
const YC = -15.5;                              // eixo do túnel
const RB = 3.1;                                // raio escavado
const RS = 3.05;                               // raio do escudo
const RO = 2.95, RI = 2.65;                    // anel: raio externo / interno
const NR = 43, RW = (AX0 - SX1) / NR;          // número e largura dos anéis
const TBM_LEN = 8;
const LAYERS = [
  { name: 'Solo superficial', top: 0, bot: -2.5, color: 0x6e4a2c, sp: 0.2 },
  { name: 'Argila', top: -2.5, bot: -10, color: 0x9c5b36, sp: 0.1 },
  { name: 'Arenito', top: -10, bot: -24, color: 0xc29a62, sp: 0.35, tunnel: true },
  { name: 'Rocha', top: -24, bot: -60, color: 0x67635e, sp: 0.6 },
];

// ---------------------------------------------------------------- renderer / scene
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(QS.has('render') ? window.devicePixelRatio : 1);
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.localClippingEnabled = true;
const cutPlane = new THREE.Plane(V(0, 0, -1), 0.05);  // mantém z <= 0.05 (vista em corte)
renderer.clippingPlanes = [cutPlane];

const scene = new THREE.Scene();
{
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#5b9bd8'); gr.addColorStop(0.45, '#bcd9f0'); gr.addColorStop(0.55, '#2a2520'); gr.addColorStop(1, '#0d0b0a');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; scene.background = tex;
}
const camera = new THREE.PerspectiveCamera(VERT ? 55 : 40, W / H, 0.1, 800);
scene.add(camera);
scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x5a4632, 1.6));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4); sun.position.set(30, 60, 45); scene.add(sun);
const fill = new THREE.DirectionalLight(0xbcd2ff, 0.6); fill.position.set(-40, 10, 30); scene.add(fill);
const camLight = new THREE.PointLight(0xffe2b0, 0, 40, 1.4); camera.add(camLight);

// ---------------------------------------------------------------- materials
const NOISE = `
varying vec3 vWP;
float h3(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vn(p); p*=2.03; a*=.5; } return s; }`;
function noisyMat(color, { speck = 0.3, scale = 0.9, amp = 0.4, rough = 1, side = THREE.DoubleSide, clip } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, side });
  if (clip) m.clippingPlanes = clip;
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float n = fbm(vWP*${scale.toFixed(2)});
        float sp = step(0.93, h3(floor(vWP*11.0))) * ${(speck*0.7).toFixed(2)};
        diffuseColor.rgb *= (1.0 - ${(amp / 2).toFixed(2)} + ${amp.toFixed(2)}*n) * (1.0 - sp);`);
  };
  m.customProgramCacheKey = () => `noisy-${speck}-${scale}-${amp}`;
  return m;
}
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide, ...o });
const M = {
  concrete: noisyMat(0xc4c0b8, { speck: 0.05, scale: 2.5, amp: 0.18 }),
  segment: noisyMat(0xbab6ad, { speck: 0.04, scale: 3.0, amp: 0.16 }),
  segKey: noisyMat(0xd2cdc2, { speck: 0.04, scale: 3.0, amp: 0.16 }),
  grass: noisyMat(0x5c8a3a, { speck: 0.0, scale: 1.5, amp: 0.3 }),
  asphalt: std(0x3a3d42, { roughness: 0.9 }),
  yellow: std(0xf2b705, { metalness: 0.45, roughness: 0.4 }),
  yellowDark: std(0xc98f00, { metalness: 0.45, roughness: 0.45 }),
  steel: std(0x8d949c, { metalness: 0.8, roughness: 0.35 }),
  darkSteel: std(0x40454c, { metalness: 0.7, roughness: 0.45 }),
  red: std(0xb8322a, { metalness: 0.3, roughness: 0.45 }),
  chrome: std(0xe0e4e8, { metalness: 1, roughness: 0.15 }),
  orange: std(0xe86f1c, { roughness: 0.5 }),
  belt: std(0x1d1f22, { roughness: 0.9 }),
  dirt: noisyMat(0x7a5634, { speck: 0.15, scale: 3, amp: 0.4 }),
  pipe: std(0x2f7fd0, { roughness: 0.4 }),
  white: std(0xf2f2f0, { roughness: 0.35 }),
  trunk: std(0x5a3f28, { roughness: 1 }),
  leaf: noisyMat(0x3f7a33, { speck: 0, scale: 2, amp: 0.35 }),
};
const layerMats = LAYERS.map((l) => noisyMat(l.color, { speck: l.sp, scale: 0.8, amp: 0.45 }));

// ---------------------------------------------------------------- box utility
const UNIT = new THREE.BoxGeometry(1, 1, 1);
function box(mat, parent = scene) { const m = new THREE.Mesh(UNIT, mat); parent.add(m); return m; }
function setBox(m, x0, x1, y0, y1, z0, z1) {
  const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
  m.visible = sx > 1e-3 && sy > 1e-3 && sz > 1e-3;
  if (!m.visible) return m;
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.scale.set(sx, sy, sz); return m;
}
function staticBox(mat, x0, x1, y0, y1, z0, z1, parent = scene) { return setBox(box(mat, parent), x0, x1, y0, y1, z0, z1); }
function beam(mat, a, b, w, h, parent = scene) { // caixa alinhada entre dois pontos
  const m = new THREE.Mesh(UNIT, mat); const d = b.clone().sub(a);
  m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.set(d.length(), h, w);
  m.quaternion.setFromUnitVectors(V(1, 0, 0), d.normalize()); parent.add(m); return m;
}
function cylX(r, len, mat, { open = false, seg = 48, parent } = {}) { // cilindro ao longo de x, começando em x=0
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, open); g.rotateZ(-Math.PI / 2); g.translate(len / 2, 0, 0);
  const m = new THREE.Mesh(g, mat); (parent || scene).add(m); return m;
}

// ---------------------------------------------------------------- terreno (corte)
const soil = LAYERS.map((L, i) => {
  const mat = layerMats[i];
  const o = {
    left: staticBox(mat, XL, SX0, L.bot, L.top, ZB, 0),
    right: staticBox(mat, AX1, XR, L.bot, L.top, ZB, 0),
    sBack: staticBox(mat, SX0, SX1, L.bot, L.top, ZB, SZ),
    aBack: staticBox(mat, AX0, AX1, L.bot, L.top, ZB, SZ),
    sFront: box(mat), aFront: box(mat), mid: box(mat), L,
  };
  if (L.tunnel) {
    // trecho já escavado: seção com sulco semicircular extrudada ao longo de x
    const sh = new THREE.Shape(); const W2 = -ZB;
    sh.moveTo(0, L.top); sh.lineTo(W2, L.top); sh.lineTo(W2, L.bot); sh.lineTo(0, L.bot); sh.lineTo(0, YC - RB);
    for (let k = 1; k < 48; k++) { const a = -Math.PI / 2 + (Math.PI * k) / 48; sh.lineTo(RB * Math.cos(a), YC + RB * Math.sin(a)); }
    sh.lineTo(0, YC + RB); sh.lineTo(0, L.top);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); g.rotateY(Math.PI / 2);
    o.bored = new THREE.Mesh(g, mat); o.bored.position.set(SX1, 0, 0); scene.add(o.bored);
  }
  return o;
});
// superfície
const grass = {
  left: staticBox(M.grass, XL, SX0, 0, 0.18, ZB, 0), right: staticBox(M.grass, AX1, XR, 0, 0.18, ZB, 0),
  mid: staticBox(M.grass, SX1, AX0, 0, 0.18, ZB, 0),
  sBack: staticBox(M.grass, SX0, SX1, 0, 0.18, ZB, SZ), aBack: staticBox(M.grass, AX0, AX1, 0, 0.18, ZB, SZ),
  sFront: staticBox(M.grass, SX0, SX1, 0, 0.18, SZ, 0), aFront: staticBox(M.grass, AX0, AX1, 0, 0.18, SZ, 0),
};
staticBox(M.asphalt, XL, XR, 0.18, 0.24, -14.6, -10.4);
for (let x = XL + 1; x < XR; x += 4) staticBox(M.white, x, x + 2, 0.24, 0.26, -12.56, -12.44);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 400), noisyMat(0x587f3b, { speck: 0, scale: 0.15, amp: 0.35 }));
ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, ZB - 200); scene.add(ground);

// cidade ao fundo
{
  const r = rng(7); const cols = [0xd9d4c7, 0xb8c4cf, 0xe0c9a6, 0x9fb0bf, 0xcfb9a5, 0xa7a29a];
  for (let i = 0; i < 70; i++) {
    const x = -110 + r() * 220, z = -22 - r() * 60, w = 4 + r() * 6, d = 4 + r() * 6, h = 4 + r() * r() * 26;
    const m = std(cols[i % cols.length], { roughness: 0.8, side: THREE.FrontSide });
    staticBox(m, x - w / 2, x + w / 2, 0, h, z - d / 2, z + d / 2);
    staticBox(std(0x2c3e50, { roughness: 0.3, metalness: 0.4 }), x - w / 2 - 0.02, x + w / 2 + 0.02, h * 0.15, h * 0.9, z + d / 2 - 0.05, z + d / 2 + 0.02);
  }
}
// árvores
function tree(x, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0.18, z); g.scale.setScalar(s); scene.add(g);
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.6, 8), M.trunk); t.position.y = 0.8; g.add(t);
  const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), M.leaf); c.position.y = 2.2; g.add(c);
}
{ const r = rng(3); for (let x = XL + 2; x < XR; x += 3.3 + r() * 2) tree(x, -15.4, 0.8 + r() * 0.5);
  [-22, -18, -12, 16, 21, 27, 31].forEach((x, i) => tree(x, -3 - (i % 3) * 1.6, 0.8 + 0.1 * (i % 3))); }
// carros na rua
const cars = [];
{ const cc = [0xd63031, 0x0984e3, 0xfdcb6e, 0xffffff, 0x2d3436, 0x00b894];
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group(); scene.add(g); const mat = std(cc[i % cc.length], { metalness: 0.5, roughness: 0.3 });
    staticBox(mat, -1, 1, 0.3, 0.95, -0.5, 0.5, g); staticBox(std(0x1e272e), -0.5, 0.6, 0.95, 1.35, -0.45, 0.45, g);
    cars.push({ g, lane: i % 2, off: i * 13.7, speed: 7 + (i % 3) * 1.5 });
  } }

// ---------------------------------------------------------------- poços
function makeShaft(x0, x1, holeSide) {
  const s = { back: box(M.concrete), left: box(M.concrete), floor: box(M.concrete), right: [box(M.concrete), box(M.concrete), box(M.concrete)] };
  s.update = (d, noWalls = false) => {
    const top = 0.7;
    setBox(s.back, x0, x1, -d, top, SZ, SZ + 0.45);
    const solidX = holeSide === 'right' ? [x0, x0 + 0.45] : [x1 - 0.45, x1];
    const holeX = holeSide === 'right' ? [x1 - 0.45, x1] : [x0, x0 + 0.45];
    setBox(s.left, solidX[0], solidX[1], -d, top, SZ, 0);
    setBox(s.right[0], holeX[0], holeX[1], Math.max(-d, YC + RB), top, SZ, 0);
    setBox(s.right[1], holeX[0], holeX[1], -d, -SD + 0.5, SZ, 0);
    setBox(s.right[2], holeX[0], holeX[1], Math.max(-d, -SD + 0.5), YC + RB, SZ, -RB);
    if (-d > YC + RB) s.right[2].visible = false;
    setBox(s.floor, x0, x1, -SD, -SD + 0.5, SZ, 0); s.floor.visible = d >= SD - 0.01;
    [s.back, s.left, ...s.right].forEach((m) => { if (d < 0.05 || noWalls) m.visible = false; });
    if (noWalls) s.floor.visible = false;
  };
  return s;
}
const shaftL = makeShaft(SX0, SX1, 'right');
const shaftA = makeShaft(AX0, AX1, 'left');

// pórtico rolante sobre o poço de lançamento
const crane = new THREE.Group(); scene.add(crane);
{
  const H2 = 15;
  [[SX0 - 1.6, SZ - 0.5], [SX1 + 1.6, SZ - 0.5], [SX0 - 1.6, -0.4], [SX1 + 1.6, -0.4]].forEach(([x, z]) =>
    staticBox(M.orange, x - 0.35, x + 0.35, 0, H2, z - 0.35, z + 0.35, crane));
  staticBox(M.orange, SX0 - 2.2, SX1 + 2.2, H2, H2 + 1.1, SZ - 0.9, SZ - 0.1, crane);
  staticBox(M.orange, SX0 - 2.2, SX1 + 2.2, H2, H2 + 1.1, -0.8, 0.0, crane);
  staticBox(M.orange, SX0 - 2.2, SX0 - 1.0, H2, H2 + 1.1, SZ - 0.9, 0, crane);
  staticBox(M.orange, SX1 + 1.0, SX1 + 2.2, H2, H2 + 1.1, SZ - 0.9, 0, crane);
}
const trolley = staticBox(M.darkSteel, -1.2, 1.2, 15.0, 16.4, SZ - 0.9, 0);
const cables = [box(M.darkSteel), box(M.darkSteel)];
const bucket = new THREE.Group(); scene.add(bucket);
staticBox(M.darkSteel, -1, 1, -1.2, 0, -1, 1, bucket); staticBox(M.dirt, -0.9, 0.9, -0.2, 0.25, -0.9, 0.9, bucket);
// escavadeira no poço
const digger = new THREE.Group(); scene.add(digger);
{ staticBox(M.darkSteel, -1.6, 1.6, 0, 0.6, -1.2, 1.2, digger); staticBox(M.yellow, -1.3, 1.3, 0.6, 1.6, -1.1, 1.1, digger);
  staticBox(std(0x1e272e), -1.1, 0.0, 1.6, 2.6, -1.0, 0.2, digger);
  const arm = new THREE.Group(); arm.position.set(1.1, 1.3, 0); digger.add(arm); digger.userData.arm = arm;
  beam(M.yellow, V(0, 0, 0), V(2.2, 1.4, 0), 0.4, 0.4, arm); beam(M.yellow, V(2.2, 1.4, 0), V(3.0, -0.6, 0), 0.35, 0.35, arm);
  staticBox(M.darkSteel, 2.6, 3.5, -1.2, -0.4, -0.5, 0.5, arm); }
const pile = new THREE.Mesh(new THREE.ConeGeometry(4.5, 3.8, 32, 1), M.dirt); pile.position.set(-46, 0.18, -4.5); scene.add(pile);
const truck = new THREE.Group(); scene.add(truck); truck.position.set(-44.5, 0.18, -11.2);
staticBox(M.red, 1.2, 2.6, 0.5, 2.0, -1, 1, truck); staticBox(M.yellowDark, -2.4, 1.1, 0.5, 1.6, -1.1, 1.1, truck); staticBox(M.darkSteel, -2.4, 2.6, 0, 0.5, -0.9, 0.9, truck);

// sondagem
const rig = new THREE.Group(); scene.add(rig);
staticBox(M.orange, 5.5, 10.5, 0.18, 1.5, -3.2, -0.6, rig); staticBox(std(0x2d3436), 9.2, 10.6, 1.5, 2.6, -3.0, -0.8, rig);
staticBox(M.yellow, 7.7, 8.3, 1.5, 11, -0.9, -0.3, rig); staticBox(M.yellow, 7.4, 8.6, 10.6, 11.2, -1.0, 0.04, rig);
const rod = box(M.steel); const hole = box(std(0x1a120c, { roughness: 1 }));
const outline = new THREE.Group(); scene.add(outline);
{
  const mat = new THREE.LineDashedMaterial({ color: 0xffe27a, dashSize: 0.7, gapSize: 0.45, transparent: true, opacity: 1, depthTest: false });
  const rect = (x0, x1, y0, y1) => { const g = new THREE.BufferGeometry().setFromPoints([V(x0, y0, 0.04), V(x1, y0, 0.04), V(x1, y1, 0.04), V(x0, y1, 0.04), V(x0, y0, 0.04)]);
    const l = new THREE.Line(g, mat); l.computeLineDistances(); l.renderOrder = 5; outline.add(l); };
  rect(SX1, AX0, YC - RB, YC + RB); rect(SX0, SX1, -SD, 0.2); rect(AX0, AX1, -SD, 0.2);
  outline.userData.mat = mat;
}

// ---------------------------------------------------------------- tuneladora (TBM)
const tbm = new THREE.Group(); scene.add(tbm);
const cutter = new THREE.Group(); tbm.add(cutter);
const erector = new THREE.Group(); erector.position.x = -6.9; tbm.add(erector);
{
  cylX(RS, 4.6, M.yellow, { open: true, parent: tbm }).position.x = -4.8;
  cylX(RS - 0.03, 3.3, M.yellowDark, { open: true, parent: tbm }).position.x = -TBM_LEN;
  cylX(RS + 0.02, 0.25, M.darkSteel, { open: true, parent: tbm }).position.x = -4.9;
  cylX(2.98, 0.35, M.steel, { parent: cutter }).position.x = -0.35;
  for (let k = 0; k < 6; k++) {
    const sp = new THREE.Group(); sp.rotation.x = (k * Math.PI) / 3; cutter.add(sp);
    staticBox(M.red, -0.05, 0.25, -0.3, 2.95, -0.28, 0.28, sp);
    for (let r = 0.7; r < 2.9; r += 0.55) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 16), M.darkSteel);
      d.rotation.x = Math.PI / 2; d.position.set(0.32, r, (r * 7) % 2 > 1 ? 0.12 : -0.12); sp.add(d);
    }
  }
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 24), M.darkSteel); cone.rotation.z = -Math.PI / 2; cone.position.x = 0.5; cutter.add(cone);
  cylX(2.96, 0.18, M.darkSteel, { parent: tbm }).position.x = -1.5;
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; cylX(0.28, 1.4, M.steel, { seg: 16, parent: tbm }).position.set(-3.0, 1.8 * Math.cos(a), 1.8 * Math.sin(a)); }
  // rosca transportadora
  beam(std(0x5a6e82, { metalness: 0.5 }), V(-1.6, -2.1, -0.9), V(-7.4, -0.4, -1.3), 0.8, 0.8, tbm);
  // macacos hidráulicos
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2;
    cylX(0.16, 1.8, M.red, { seg: 12, parent: tbm }).position.set(-6.3, 2.5 * Math.cos(a), 2.5 * Math.sin(a));
    cylX(0.09, 1.3, M.chrome, { seg: 10, parent: tbm }).position.set(-7.6, 2.5 * Math.cos(a), 2.5 * Math.sin(a)); }
  // erector
  cylX(0.5, 0.6, M.darkSteel, { parent: erector }).position.x = -0.3;
  erector.userData.arm = staticBox(M.orange, -0.2, 0.2, 0, 1, -0.25, 0.25, erector);
  erector.userData.grip = staticBox(M.darkSteel, -0.5, 0.5, 0, 0.25, -0.6, 0.6, erector);
}
// comboio de apoio (gantries) — recortado em x >= SX1 para não aparecer no poço
const clipGantry = [new THREE.Plane(V(1, 0, 0), -SX1)];
const gantries = new THREE.Group(); scene.add(gantries);
{
  const gm = { frame: std(0x2f7d4f, { metalness: 0.4 }), equip: std(0x3a5d8f, { metalness: 0.3 }), tank: std(0xc0392b), grey: std(0x7f8c8d) };
  Object.values(gm).forEach((m) => (m.clippingPlanes = clipGantry));
  for (let i = 0; i < 5; i++) {
    const x1 = -8.6 - 6.3 * i, x0 = x1 - 6;
    [-1.55, 1.55].forEach((z) => { staticBox(gm.frame, x0, x1, 1.3, 1.55, z - 0.12, z + 0.12, gantries);
      staticBox(gm.frame, x0, x1, -1.85, -1.65, z - 0.12, z + 0.12, gantries);
      [x0 + 0.2, (x0 + x1) / 2, x1 - 0.2].forEach((x) => staticBox(gm.frame, x - 0.12, x + 0.12, -1.85, 1.55, z - 0.12, z + 0.12, gantries)); });
    staticBox(gm.grey, x0, x1, -0.65, -0.5, -1.5, 1.5, gantries);
    staticBox(i % 2 ? gm.equip : gm.grey, x0 + 0.6, x0 + 2.6, -0.5, 0.8, -0.6, 1.2, gantries);
    const tk = cylX(0.45, 2.2, gm.tank, { seg: 16, parent: gantries }); tk.material = gm.tank; tk.position.set(x0 + 3.2, 0, 0.6);
  }
}
// esteira e material escavado
const belt = { h: box(M.belt), v: box(M.belt), top: beam(M.belt, V(-36.8, 1.6, -1.3), V(-45, 3.6, -1.3), 0.8, 0.15) };
const N_CHUNK = 220, CH_SP = 0.55;
const chunks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.2, 0), M.dirt, N_CHUNK); scene.add(chunks);

// ---------------------------------------------------------------- anéis de revestimento
const SEG_ANG = [-90, -150, -30, 150, 30, 90].map((d) => (d * Math.PI) / 180);
const segGeos = SEG_ANG.map((ac) => {
  const half = (Math.PI / 6) * 0.985, sh = new THREE.Shape(), n = 14;
  for (let k = 0; k <= n; k++) { const a = ac - half + (2 * half * k) / n; const p = [RO * Math.cos(a), RO * Math.sin(a)]; k ? sh.lineTo(...p) : sh.moveTo(...p); }
  for (let k = n; k >= 0; k--) { const a = ac - half + (2 * half * k) / n; sh.lineTo(RI * Math.cos(a), RI * Math.sin(a)); }
  const g = new THREE.ExtrudeGeometry(sh, { depth: RW * 0.975, bevelEnabled: false, curveSegments: 2 }); g.rotateY(Math.PI / 2); return g;
});
const rings = [];
for (let k = 0; k < NR; k++) {
  const g = new THREE.Group(); g.position.set(SX1 + k * RW, YC, 0); scene.add(g);
  const segs = SEG_ANG.map((ac, j) => { const m = new THREE.Mesh(segGeos[j], j === 5 ? M.segKey : M.segment); g.add(m);
    m.userData.dir = V(0, Math.sin(ac), -Math.cos(ac)); return m; });
  rings.push({ g, segs });
}
const grout = cylX(3.03, 1, std(0x7f97a8, { roughness: 0.9, emissive: 0x1e88e5, emissiveIntensity: 0 }), { open: true, seg: 64 });
const drain = cylX(0.16, 1, M.pipe, { seg: 16 });

// ---------------------------------------------------------------- acabamento
const SLAB_Y = YC - 1.7;
const slab = box(M.concrete);
const rails = [box(M.steel), box(M.steel)];
const walkway = box(std(0x95a5a6, { roughness: 0.8 }));
const N_LAMP = Math.floor((AX0 - SX1 - 2) / 3);
const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.12, 0.25), new THREE.MeshBasicMaterial({ color: 0xffffff }), N_LAMP);
const lampObj = new THREE.Object3D();
for (let i = 0; i < N_LAMP; i++) { lampObj.position.set(SX1 + 2 + i * 3, YC + 2.25, -1.25); lampObj.rotation.x = -0.5; lampObj.updateMatrix(); lamps.setMatrixAt(i, lampObj.matrix); lamps.setColorAt(i, new THREE.Color(0.15, 0.15, 0.15)); }
scene.add(lamps);
const fans = [];
[-12, 6, 24].forEach((x) => { const g = new THREE.Group(); g.position.set(x, YC + 2.0, 0.0); scene.add(g);
  [-0.9, 0.9].forEach((z) => { cylX(0.42, 2.6, M.steel, { parent: g, seg: 20 }).position.set(-1.3, 0, z); cylX(0.3, 0.05, M.darkSteel, { parent: g }).position.set(1.31, 0, z); });
  fans.push(g); });

// ---------------------------------------------------------------- trem
const clipTrain = [new THREE.Plane(V(1, 0, 0), -SX1), new THREE.Plane(V(-1, 0, 0), AX0)];
const train = new THREE.Group(); scene.add(train);
{
  const tm = { body: std(0xf4f4f2, { metalness: 0.3, roughness: 0.3 }), stripe: std(0xd63031), glass: std(0x16324f, { metalness: 0.6, roughness: 0.15, emissive: 0x2a6fb0, emissiveIntensity: 0.35 }), under: std(0x2d3436) };
  Object.values(tm).forEach((m) => (m.clippingPlanes = clipTrain));
  const b0 = SLAB_Y + 0.25;
  for (let i = 0; i < 3; i++) {
    const x1 = -i * 7.4, x0 = x1 - 7;
    staticBox(tm.under, x0 + 0.3, x1 - 0.3, SLAB_Y + 0.05, b0 + 0.25, -1.05, 1.05, train);
    staticBox(tm.body, x0, x1, b0 + 0.25, b0 + 2.35, -1.2, 1.2, train);
    staticBox(tm.stripe, x0 - 0.01, x1 + 0.01, b0 + 0.55, b0 + 0.8, -1.22, 1.22, train);
    staticBox(tm.glass, x0 + 0.4, x1 - 0.4, b0 + 1.2, b0 + 1.9, -1.23, 1.23, train);
  }
  const front = staticBox(tm.glass, 0, 0.9, b0 + 1.1, b0 + 2.1, -1.0, 1.0, train); front.rotation.z = -0.35;
  staticBox(new THREE.MeshBasicMaterial({ color: 0xfff6c8, clippingPlanes: clipTrain }), 0.6, 0.75, b0 + 0.45, b0 + 0.75, -0.9, 0.9, train);
}

// ---------------------------------------------------------------- objetos das tentativas que dão errado
const waterMat = new THREE.MeshStandardMaterial({ color: 0x2e86de, transparent: true, opacity: 0.6, roughness: 0.15, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
const aquiferMat = new THREE.MeshBasicMaterial({ color: 0x2f9bff, transparent: true, opacity: 0, depthWrite: false });
const AQ_TOP = -10.1, AQ_BOT = -12.3; // lençol freático
const aquifer = [[XL, SX0], [SX1, AX0], [AX1, XR]].map(([a, b]) => { const m = staticBox(aquiferMat, a, b, AQ_BOT, AQ_TOP, 0.0, 0.03); m.renderOrder = 4; return m; });
const tunnelWater = box(waterMat); tunnelWater.renderOrder = 6;
const rubbleMat = noisyMat(0x4b3420, { speck: 0.3, scale: 2.2, amp: 0.5 });
const rubbleFill = box(rubbleMat);                      // terra que caiu e encheu o túnel
const chimney = (() => {                          // solo que cedeu acima do túnel (no plano de corte)
  const sh = new THREE.Shape(), r = rng(11), pts = [];
  for (let k = 0; k <= 10; k++) pts.push([-1 - 0.12 * r() - k * 0.09, k / 10]);
  for (let k = 10; k >= 0; k--) pts.push([1 + 0.12 * r() + k * 0.09, k / 10]);
  sh.moveTo(...pts[0]); pts.slice(1).forEach((p) => sh.lineTo(...p));
  const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), rubbleMat); m.position.z = 0.035; m.renderOrder = 5; scene.add(m); return m;
})();
const crater = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.7, 0.1, 40), rubbleMat); crater.position.set(-10, 0.27, -6.2); scene.add(crater);
const N_DEB = 120, N_DROP = 80;
const debris = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.3, 0), rubbleMat, N_DEB); scene.add(debris);
const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0x7cc4ff }), N_DROP); scene.add(drops);

// túneis cavados à mão (seção redonda ou retangular), piso no fundo do poço
const FLOOR = -SD + 0.5, HT = 3.2, HW = 1.3, RC = 1.6, YCM = FLOOR + RC;
function boredMesh(profile) {
  const L = LAYERS[2], sh = new THREE.Shape(), W2 = -ZB;
  sh.moveTo(0, L.top); sh.lineTo(W2, L.top); sh.lineTo(W2, L.bot); sh.lineTo(0, L.bot);
  profile.forEach((p) => sh.lineTo(...p)); sh.lineTo(0, L.top);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); g.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(g, layerMats[2]); m.position.x = SX1; m.visible = false; scene.add(m); return m;
}
const roundBore = boredMesh(Array.from({ length: 33 }, (_, k) => { const a = -Math.PI / 2 + (Math.PI * k) / 32, r = RC + (k % 3 ? 0.06 : -0.05) * (k > 0 && k < 32 ? 1 : 0); return [r * Math.cos(a), YCM + r * Math.sin(a)]; }));
const rectBore = boredMesh([[0, FLOOR], [HW, FLOOR], [HW, FLOOR + HT], [0, FLOOR + HT]]);

// o personagem
function makeWorker() {
  const g = new THREE.Group(); scene.add(g);
  const mt = { vest: std(0xff7a1a, { roughness: 0.6 }), pants: std(0x2c4a7a, { roughness: 0.8 }), skin: std(0xe0ac80, { roughness: 0.7 }),
    hat: std(0xffd200, { roughness: 0.35, metalness: 0.2 }), boot: std(0x2b2118), wood: std(0x8a5a2b, { roughness: 0.8 }), metal: std(0x9aa1a8, { metalness: 0.8, roughness: 0.3 }) };
  const limb = (mat, w, h, d, px, py, pz) => { const p = new THREE.Group(); p.position.set(px, py, pz); g.add(p);
    const m = new THREE.Mesh(UNIT, mat); m.scale.set(w, h, d); m.position.y = -h / 2; p.add(m); return p; };
  const legL = limb(mt.pants, 0.2, 0.88, 0.2, 0, 0.9, -0.12), legR = limb(mt.pants, 0.2, 0.88, 0.2, 0, 0.9, 0.12);
  [legL, legR].forEach((l) => { const b = new THREE.Mesh(UNIT, mt.boot); b.scale.set(0.3, 0.12, 0.22); b.position.set(0.05, -0.88, 0); l.add(b); });
  const torso = new THREE.Mesh(UNIT, mt.vest); torso.scale.set(0.3, 0.62, 0.46); torso.position.y = 1.2; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), mt.skin); head.position.y = 1.69; g.add(head);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mt.hat); hat.position.y = 1.74; g.add(hat);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 20), mt.hat); brim.position.y = 1.74; g.add(brim);
  const armL = limb(mt.vest, 0.14, 0.6, 0.14, 0, 1.48, -0.3), armR = limb(mt.vest, 0.14, 0.6, 0.14, 0, 1.48, 0.3);
  const shovel = new THREE.Group(); shovel.position.set(0, -0.58, 0); armR.add(shovel);
  const hnd = new THREE.Mesh(UNIT, mt.wood); hnd.scale.set(0.05, 1.1, 0.05); hnd.position.y = -0.3; hnd.rotation.z = 0.6; shovel.add(hnd);
  const blade = new THREE.Mesh(UNIT, mt.metal); blade.scale.set(0.32, 0.36, 0.05); blade.position.set(0.5, -0.78, 0); blade.rotation.z = 0.6; shovel.add(blade);
  return { g, legL, legR, armL, armR, shovel, head };
}
const worker = makeWorker();
function poseWorker(mode, tt) {
  const w = worker; const s = mode === 'run' ? 14 : 7;
  const sw = mode === 'walk' || mode === 'run' ? Math.sin(tt * s) * (mode === 'run' ? 0.9 : 0.5) : 0;
  w.legL.rotation.z = sw; w.legR.rotation.z = -sw;
  w.armL.rotation.z = -sw * 0.8; w.armR.rotation.z = sw * 0.8;
  w.shovel.visible = mode === 'dig' || mode === 'walk';
  if (mode === 'dig') { const d = Math.sin(tt * 6); w.armR.rotation.z = 0.9 + 0.6 * d; w.armL.rotation.z = 0.7 + 0.5 * d; }
  if (mode === 'panic') { w.armL.rotation.x = -2.6 + 0.3 * Math.sin(tt * 20); w.armR.rotation.x = 2.6 - 0.3 * Math.sin(tt * 20); w.armL.rotation.z = w.armR.rotation.z = 0; }
  else { w.armL.rotation.x = w.armR.rotation.x = 0; }
  if (mode === 'sad') { w.head.position.y = 1.64; w.armL.rotation.z = w.armR.rotation.z = 0.1; } else w.head.position.y = 1.69;
  if (mode === 'cheer') { w.armL.rotation.x = -2.8; w.armR.rotation.x = 2.8; }
}

// escoras de madeira (tentativa 2)
const woodMat = noisyMat(0x9a6a3a, { speck: 0.05, scale: 4, amp: 0.3 });
const frames = Array.from({ length: 10 }, () => ({ post: box(woodMat), cap: box(woodMat) }));
// teto reto de concreto (tentativa 3)
const flatWall = box(M.concrete);
const flatRoof = Array.from({ length: 6 }, () => box(M.concrete));
// arco de tijolos (tentativa 4)
const brickMat = noisyMat(0xa9472a, { speck: 0.25, scale: 5, amp: 0.35 });
const brickGeo = (() => { const sh = new THREE.Shape(); sh.absarc(0, 0, RC + 0.04, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, RC - 0.16, 0, Math.PI * 2, true); sh.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.46, bevelEnabled: false, curveSegments: 24 }); g.rotateY(Math.PI / 2); return g; })();
const bricks = Array.from({ length: 34 }, () => { const m = new THREE.Mesh(brickGeo, brickMat); scene.add(m); return m; });
// setas do "peso da terra" e trincas
const arrowMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0, depthTest: false });
const arrowGeo = (() => { const s = new THREE.Shape(); s.moveTo(-0.28, 3); s.lineTo(0.28, 3); s.lineTo(0.28, 1.1); s.lineTo(0.8, 1.1); s.lineTo(0, 0); s.lineTo(-0.8, 1.1); s.lineTo(-0.28, 1.1); s.lineTo(-0.28, 3);
  return new THREE.ShapeGeometry(s); })();
const arrows = Array.from({ length: 3 }, () => { const m = new THREE.Mesh(arrowGeo, arrowMat); m.renderOrder = 10; m.position.z = 0.045; scene.add(m); return m; });
const crackMat = new THREE.MeshBasicMaterial({ color: 0x140b05, depthTest: false });
const cracks = Array.from({ length: 3 }, (_, c) => { const r = rng(30 + c), segs = []; let p = V(0, 0, 0.045);
  for (let k = 0; k < 7; k++) { const q = p.clone().add(V((r() - 0.5) * 1.1, 0.55 + r() * 0.35, 0)); const b = beam(crackMat, p, q, 0.01, 0.09); b.renderOrder = 9; segs.push(b); p = q; }
  return segs; });

// ---------------------------------------------------------------- legendas / rótulos (DOM)
const $ = (s) => document.querySelector(s);
const capEl = $('#caption'), capNum = capEl.querySelector('.num'), capTtl = capEl.querySelector('.ttl'), capSub = capEl.querySelector('.sub');
const CAPTIONS = [ // tentativa 6 (tempo t da construção correta)
  [33, 48, 'Tentativa 6', 'Agora vai: tuneladora', 'O escudo de aço segura a terra enquanto a cabeça de corte escava.'],
  [48, 58, 'Tentativa 6', 'Anéis logo atrás', 'A cada passo, o braço erector monta um anel de concreto. O teto nunca fica sem apoio!'],
  [58, 66, 'Tentativa 6', 'Selado contra a água', 'Argamassa preenche o vazio atrás dos anéis, e drenos controlam a água. A TBM chega ao outro lado.'],
  [66, 74, 'Tentativa 6', 'Acabamento', 'A tuneladora sai. Entram piso, trilhos, iluminação e ventilação.'],
  [74, 85.5, 'Deu certo!', 'Túnel em operação', 'O túnel aguenta o peso da terra e recebe seus primeiros trens.'],
];
const tbmX = (t) => keys(t, [[0, -28], [34, -28], [40, -8, (x) => x * x], [48, 5], [58, 9], [66, AX1 + 0.6, (x) => 1 - (1 - x) * (1 - x)]]);
const tbmY = (t) => keys(t, [[0, 17], [26, 17], [31.5, YC, ease], [66.2, YC], [68.6, 15, ease]]);
const LABELS = [
  { t0: 41, t1: 47.6, text: 'Cabeça de corte', at: (t) => V(tbmX(t) + 0.1, YC + 1.6, 0.05), off: [110, -70] },
  { t0: 41.6, t1: 47.6, text: 'Escudo de aço', at: (t) => V(tbmX(t) - 3.2, YC - RS, 0.05), off: [-60, 70] },
  { t0: 42.2, t1: 47.6, text: 'Esteira transportadora', at: (t) => V(tbmX(t) - 10, YC - 1.05, -1.3), off: [-70, 80] },
  { t0: 49, t1: 57.6, text: 'Braço erector', at: (t) => V(tbmX(t) - 6.9, YC, 0.05), off: [90, -60] },
  { t0: 49.6, t1: 57.6, text: 'Anéis de concreto', at: (t) => V(tbmX(t) - 12.5, YC - 2.8, 0.05), off: [-90, 70] },
  { t0: 50.2, t1: 57.6, text: 'Macacos hidráulicos', at: (t) => V(tbmX(t) - 6.2, YC + 2.5, 0.05), off: [140, -40] },
  { t0: 60, t1: 65.6, text: 'Argamassa', at: () => V(-10, YC + 3.03, 0.05), off: [0, -60] },
  { t0: 60.6, t1: 65.6, text: 'Dreno', at: () => V(-16, YC - 2.45, 0.05), off: [0, 60] },
  { t0: 60.6, t1: 65.6, text: 'Lençol freático', at: () => V(14, (AQ_TOP + AQ_BOT) / 2, 0.05), off: [80, -50] },
  { t0: 69, t1: 73.6, text: 'Iluminação', at: () => V(SX1 + 2 + 3 * 8, YC + 2.25, -1.2), off: [-60, -70] },
  { t0: 69.5, t1: 73.6, text: 'Trilhos', at: () => V(10, SLAB_Y + 0.15, 0.05), off: [60, 70] },
  { t0: 70.5, t1: 73.6, text: 'Ventiladores', at: () => V(6, YC + 2.0, 0.05), off: [80, -80] },
];
// rótulos das tentativas (tempo a, local da tentativa); "k" = tentativas em que aparece
const A_LABELS = [
  { k: [1, 2, 3, 4, 5], t0: 6.2, t1: 8.6, text: 'Peso da terra', at: (a, A) => V(A.cx, A.crown + 4.2, 0.05), off: [120, -30] },
  { k: [1], t0: 3, t1: 6, text: 'Buraco sem apoio', at: (a, A) => V(A.front - 4, A.crown, 0.05), off: [-40, -70] },
  { k: [2], t0: 3, t1: 6, text: 'Escoras de madeira', at: (a, A) => V(SX1 + 2.7, FLOOR + 1.5, -1.15), off: [-60, -90] },
  { k: [3], t0: 3, t1: 6, text: 'Teto reto', at: (a, A) => V(A.front - 5, FLOOR + HT, 0.05), off: [-40, -80] },
  { k: [4], t0: 3, t1: 6, text: 'Arco de tijolos', at: (a, A) => V(A.front - 5, YCM + RC, 0.05), off: [-40, -80] },
  { k: [4], t0: 6.4, t1: 8.6, text: 'Água infiltrando', at: (a, A) => V(A.cx - 3, AQ_BOT, 0.05), off: [-130, -40] },
  { k: [5], t0: 3.5, t1: 8.6, text: 'Trecho sem anéis', at: (a, A) => V(A.cx, A.crown, 0.05), off: [0, -80] },
];
const labelsEl = $('#labels');
[...LABELS, ...A_LABELS].forEach((L) => {
  const el = document.createElement('div'); el.className = 'lbl';
  el.innerHTML = `<div class="line"></div><div class="dot"></div><div class="txt">${L.text}</div>`; labelsEl.appendChild(el);
  L.el = el; L.line = el.querySelector('.line'); L.txt = el.querySelector('.txt');
  const [dx, dy] = L.off, len = Math.hypot(dx, dy);
  L.line.style.width = `${Math.max(0, len - 10)}px`; L.line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  L.txt.style.left = `${dx}px`; L.txt.style.top = `${dy}px`;
});

// ---------------------------------------------------------------- câmera
const Pq = (p, q) => ({ p, q });
const SHOTS = [ // tentativa 6
  { s: 33, b: 0, f: (t) => { const x = tbmX(t); return Pq(V(x + 3, -8.5, 25), V(x - 4, -15, -2)); } },
  { s: 40, b: 2, f: (t) => { const x = tbmX(t); return Pq(V(x + 6.5, -12.5, 10.5), V(x - 1.2, -15.5, -1)); } },
  { s: 48, b: 2, f: (t) => { const x = tbmX(t); return Pq(V(x - 3.6, -13, 11.5), V(x - 8.4, -15.4, -1.5)); } },
  { s: 58, b: 2.4, f: (t) => Pq(V(lerp(2, 6, seg(t, 58, 66)), -3, 66), V(4, -13, -4)) },
  { s: 66, b: 2.2, f: (t) => { const x = lerp(-8, 10, seg(t, 66, 74)); return Pq(V(x, -11.2, 19), V(x + 3, -15.5, -2)); } },
  { s: 74, b: 2, f: (t) => Pq(V(lerp(-2, 4, seg(t, 74, 80.5)), -10.8, 25), V(2, -15.3, -2)) },
  { s: 80.5, b: 0, f: (t) => { const x = lerp(-24, 30, sm(seg(t, 80.5, 90))); return Pq(V(x, YC + 0.1, 0.9), V(x + 10, YC - 0.2, -0.2)); } },
];
function camAt(t, shots = SHOTS, from = null) {
  let i = 0; while (i < shots.length - 1 && t >= shots[i + 1].s) i++;
  const cur = shots[i].f(t);
  if ((i > 0 || from) && shots[i].b > 0) {
    const w = ease((t - shots[i].s) / shots[i].b);
    if (w < 1) { const pr = i > 0 ? shots[i - 1].f(t) : from; cur.p.lerpVectors(pr.p, cur.p, w); cur.q.lerpVectors(pr.q, cur.q, w); }
  }
  return cur;
}

// ---------------------------------------------------------------- cena (t = tempo do "jeito certo"; ov = substituições)
const tmpObj = new THREE.Object3D(), tmpV = new THREE.Vector3();
const ON = new THREE.Color(4, 3.7, 3.0), OFF = new THREE.Color(0.15, 0.15, 0.15);
function updateScene(t, ov = {}) {
  const o = (k, d) => (k in ov ? ov[k] : d);
  const tt = o('tt', t);
  const xf = o('xf', tbmX(t)), ty = o('ty', tbmY(t)), tail = xf - TBM_LEN;
  const dS = o('dS', SD * ease(seg(t, 15.5, 22.5)));       // profundidade do poço de lançamento
  const dA = o('dA', SD * ease(seg(t, 16.5, 23.5)));       // poço de chegada (escavado em paralelo)
  const bore = clamp(xf, SX1, AX0);

  // terreno
  soil.forEach((s) => {
    const L = s.L;
    setBox(s.sFront, SX0, SX1, L.bot, Math.min(L.top, -dS), SZ, 0);
    setBox(s.aFront, AX0, AX1, L.bot, Math.min(L.top, -dA), SZ, 0);
    if (s.bored) {
      s.bored.visible = bore > SX1 + 1e-3; s.bored.scale.x = Math.max(1e-3, bore - SX1);
      setBox(s.mid, bore, AX0, L.bot, L.top, ZB, 0);
    } else setBox(s.mid, SX1, AX0, L.bot, L.top, ZB, 0);
  });
  grass.sFront.visible = dS < 0.01; grass.aFront.visible = dA < 0.01;
  shaftL.update(dS, o('noWalls', false)); shaftA.update(dA, o('noWalls', false));
  aquiferMat.opacity = o('aquifer', 0.4 * seg(t, 11.4, 12.6));
  aquifer.forEach((m) => (m.visible = aquiferMat.opacity > 0.001));

  // sondagem
  const drill = 31 * ease(seg(t, 7, 11.5));
  const rigOn = o('rig', t < 15.5);
  rig.visible = rigOn;
  setBox(rod, 7.9, 8.1, -drill, 10.8, 0.0, 0.04); setBox(hole, 7.6, 8.4, -drill, 0.18, 0.0, 0.02);
  rod.visible = hole.visible = rigOn && drill > 0.05;
  const oo = o('outline', fadeIO(t, 12.6, 15.4, 0.7)); outline.visible = oo > 0; outline.userData.mat.opacity = oo; outline.userData.mat.dashOffset = -tt * 1.5;

  // pórtico, caçamba, escavadeira
  crane.visible = trolley.visible = o('crane', t > 14.2 && t < 34);
  const digOn = o('dig', t > 15.5 && t < 24.2);
  const lowering = o('lowering', t > 25.2 && t < 32.4);
  digger.visible = digOn; bucket.visible = digOn;
  digger.position.set(lerp(-35.4, -31, 0.5 + 0.5 * Math.sin(tt * 0.9)), -dS, -4.5); digger.rotation.y = Math.sin(tt * 0.9) > 0 ? 0 : Math.PI;
  digger.userData.arm.rotation.z = -0.25 + 0.3 * Math.sin(tt * 3.1);
  const cyc = (((tt * 0.45) % 1) + 1) % 1, by = lerp(-dS + 1.5, 9, Math.sin(cyc * Math.PI));
  const loadX = -32.5;
  bucket.position.set(loadX, by, -4.5);
  trolley.position.set(0, 0, 0);
  cables.forEach((c) => (c.visible = false));
  if (crane.visible && digOn) cables.forEach((c, i) => { const z = -4.5 + (i - 0.5) * 0.6; setBox(c, loadX - 0.06, loadX + 0.06, by, 15, z - 0.06, z + 0.06); });
  else if (crane.visible && lowering) { setBox(cables[0], -35.56, -35.44, ty + RS, 15, -0.86, -0.74); setBox(cables[1], -29.56, -29.44, ty + RS, 15, -0.86, -0.74); }
  pile.scale.setScalar(clamp(o('pile', 0.2 + 0.45 * seg(t, 15.5, 23) + 0.45 * seg(t, 34, 66)), 0, 1.1)); pile.visible = o('pileOn', t > 15.6);
  pile.position.y = 0.18 + 1.9 * pile.scale.y; truck.visible = o('truck', t > 15);

  // TBM
  tbm.visible = o('tbmOn', t > 25 && t < 68.8);
  tbm.position.set(xf, ty, 0);
  cutter.rotation.x = o('cut', -2.4 * Math.max(0, Math.min(t, 66) - 33.6));
  gantries.visible = o('gantry', t > 33 && t < 66.2);
  gantries.position.copy(tbm.position);

  // anéis
  const P = ov.noRings ? -1e9 : (tail - o('ringLag', 0) - SX1) / RW + 1;
  let eAng = Math.PI / 2, eR = 1.6;
  rings.forEach((r, k) => {
    const f = clamp(P - k, 0, 1);
    r.segs.forEach((m, j) => {
      const u = f * 6 - j; const s = sm((u - 0.35) / 0.55);
      m.visible = u > 0.35;
      m.position.copy(m.userData.dir).multiplyScalar(-(1 - s) * 0.95);
      if (f > 0 && f < 1 && u >= 0 && u < 1) {
        const prev = j ? SEG_ANG[j - 1] : Math.PI / 2;
        eAng = u < 0.35 ? lerp(prev, SEG_ANG[j], sm(u / 0.35)) : SEG_ANG[j];
        eR = u < 0.35 ? 1.6 : RI - 0.35 - (1 - s) * 0.95;
      }
    });
  });
  erector.rotation.x = eAng - Math.PI / 2;
  erector.userData.arm.scale.y = eR; erector.userData.grip.position.y = eR;

  // injeção / dreno
  const ringEnd = clamp(SX1 + Math.floor(clamp(P - 1, 0, NR)) * RW, SX1, AX0);
  grout.visible = ringEnd > SX1 + 0.01; grout.position.set(SX1, YC, 0); grout.scale.x = Math.max(0.001, ringEnd - SX1);
  grout.material.emissiveIntensity = t > 58.5 && t < 66 ? 0.7 * (0.55 + 0.45 * Math.sin(t * 4)) * fadeIO(t, 58.5, 66, 1) : 0;
  const drainEnd = lerp(SX1, ringEnd, seg(t, 58.5, 64));
  drain.visible = drainEnd > SX1 + 0.1; drain.position.set(SX1, YC - RI + 0.22, -0.7); drain.scale.x = Math.max(0.001, drainEnd - SX1);

  // esteira e material
  const beltOn = o('belt', t > 33.5 && t < 66.2);
  const bx0 = -36.8, bx1 = xf - 7.5;
  setBox(belt.h, bx0, Math.max(bx0, bx1), YC - 1.25, YC - 1.12, -1.7, -0.9); belt.h.visible = beltOn && bx1 > bx0;
  setBox(belt.v, bx0 - 0.4, bx0 + 0.4, YC - 1.25, 1.6, -1.7, -0.9); belt.v.visible = beltOn; belt.top.visible = beltOn;
  const pathPts = [V(-45, 3.75, -1.3), V(-36.8, 1.75, -1.3), V(-36.8, YC - 1.0, -1.3), V(bx1, YC - 1.0, -1.3)];
  const lens = [pathPts[0].distanceTo(pathPts[1]), pathPts[1].distanceTo(pathPts[2]), Math.max(0, bx1 - bx0)];
  const Ltot = lens[0] + lens[1] + lens[2], loop = N_CHUNK * CH_SP;
  const chunkOn = o('chunks', t > 34.2 && t < 66), ct = o('chunkT', t);
  for (let i = 0; i < N_CHUNK; i++) {
    let d = (((i * CH_SP - ct * 6) % loop) + loop) % loop; // distância a partir do topo da pilha
    if (!chunkOn || d > Ltot) { tmpObj.scale.setScalar(0); }
    else {
      let sidx = 0; while (sidx < 2 && d > lens[sidx]) { d -= lens[sidx]; sidx++; }
      tmpV.lerpVectors(pathPts[sidx], pathPts[sidx + 1], lens[sidx] ? d / lens[sidx] : 0);
      tmpObj.position.copy(tmpV).add(V(0, sidx === 1 ? 0 : 0.05, ((i * 37) % 7 - 3) * 0.08)); tmpObj.rotation.set(i, i * 1.7, i * 0.3);
      tmpObj.scale.setScalar(0.8 + ((i * 13) % 5) * 0.12);
    }
    tmpObj.updateMatrix(); chunks.setMatrixAt(i, tmpObj.matrix);
  }
  chunks.instanceMatrix.needsUpdate = true;

  // acabamento
  const sEnd = lerp(SX1, AX0, ease(seg(t, 67, 71)));
  setBox(slab, SX1, sEnd, YC - 2.62, SLAB_Y, -2.0, 2.0); slab.visible = sEnd > SX1 + 0.05;
  const rEnd = lerp(SX1, AX0, ease(seg(t, 68, 72)));
  rails.forEach((r, i) => { const z = i ? 0.72 : -0.72; setBox(r, SX1, rEnd, SLAB_Y, SLAB_Y + 0.16, z - 0.07, z + 0.07); r.visible = rEnd > SX1 + 0.05; });
  setBox(walkway, SX1, sEnd, SLAB_Y, SLAB_Y + 0.45, -2.0, -1.35); walkway.visible = sEnd > SX1 + 0.05;
  const lampFront = lerp(SX1 - 2, AX0 + 2, seg(t, 69, 73));
  for (let i = 0; i < N_LAMP; i++) lamps.setColorAt(i, SX1 + 2 + i * 3 < lampFront ? ON : OFF);
  lamps.instanceColor.needsUpdate = true; lamps.visible = t > 67.5;
  fans.forEach((g, i) => { const s = sm(seg(t, 70 + i * 0.4, 71 + i * 0.4)); g.visible = s > 0; g.scale.setScalar(Math.max(0.001, s)); });

  // trem
  train.visible = t > 74.6 && t < 80.5; train.position.x = keys(t, [[0, -60], [74.6, SX1 - 1], [80.5, AX0 + 24]]);

  // carros na superfície
  cars.forEach((c) => { c.g.visible = true; const x = ((((c.off + tt * c.speed) % 104) + 104) % 104) - 52; c.g.position.set(c.lane ? x : -x, 0.24, c.lane ? -11.6 : -13.4); c.g.rotation.set(0, c.lane ? 0 : Math.PI, 0); });

  // vista interna (sem corte)
  const inside = t >= 80.5;
  renderer.clippingPlanes = inside ? [] : [cutPlane];
  camLight.intensity = inside ? 60 : 0;
}


// ---------------------------------------------------------------- as 5 tentativas que desabam (tempo local a: 0–12.5 s)
const A_DUR = 12.5, RWD = 2, INTRO = 7, T_S = INTRO + 5 * (A_DUR + RWD);
const DIG = [0.8, 6.2], STRESS = 6.2, RUN = [7.6, 8.6], FALL = 8.6, VERDICT = 10.4;
const ATT = [
  { k: 1, kind: 'round', title: 'Só cavar', dig: 'O cara cava um buraco debaixo da terra com uma pá.', stress: 'Mas a terra em cima pesa toneladas…',
    verdict: 'Sem nenhum apoio, o teto não aguenta o peso e desaba.', hi: 'É só cavar!', bubble: 'Ops…' },
  { k: 2, kind: 'rect', sup: 'wood', title: 'Escoras de madeira', dig: 'Agora ele escora o túnel com vigas de madeira.', stress: 'O peso da terra esmaga as escoras…',
    verdict: 'Madeira fina não aguenta tanta terra: as escoras quebram.', hi: 'Agora com escoras!', bubble: 'De novo?!' },
  { k: 3, kind: 'rect', sup: 'flat', title: 'Teto reto de concreto', dig: 'Paredes e teto de concreto, tudo bem reto.', stress: 'Num teto reto, o peso se concentra no meio…',
    verdict: 'O teto reto racha. Formas redondas distribuem muito melhor o peso!', hi: 'Concreto resolve!', bubble: 'Hmm…' },
  { k: 4, kind: 'round', sup: 'brick', title: 'Arco de tijolos', dig: 'Um túnel redondo de tijolos: o arco distribui o peso.', stress: 'Mas a água do subsolo infiltra e amolece a terra…',
    verdict: 'Sem vedação, a água lava a areia e o arco cede.', hi: 'Redondo é mais forte!', bubble: 'Não acredito!' },
  { k: 5, kind: 'tbm', title: 'Tuneladora', dig: 'Uma tuneladora escava, mas os anéis de concreto ficam muito para trás.', stress: 'O trecho sem anéis fica sem nenhum apoio…',
    verdict: 'Entre a máquina e os anéis, o túnel desaba.', hi: 'Com máquina vai!', bubble: 'Quase!' },
];
function attState(A, a) {
  if (A.kind === 'tbm') {
    const xf = keys(a, [[0, -28], [DIG[0], -28], [DIG[1] + 0.2, 2, ease]]), tail = xf - TBM_LEN;
    return { xf, front: xf, crown: YC + RB, floorY: YC - RB, zw: RB + 0.05, cx: tail - 4.5, hl: 4.5, cxv: -14 };
  }
  const front = SX1 + 16 * ease(seg(a, DIG[0], DIG[1]));
  const crown = A.kind === 'round' ? YCM + RC : FLOOR + HT;
  return { front, crown, floorY: FLOOR, zw: HW + 0.35, cx: SX1 + 9, hl: 4, cxv: SX1 + 7 };
}
function attShots(A) {
  const s0 = A.kind === 'tbm'
    ? (a) => { const x = attState(A, a).xf; return Pq(V(x + 3, -8.5, 25), V(x - 4, -15, -2)); }
    : (a) => { const xw = workerX(A, a); return Pq(V(xw + 1.5, FLOOR + 2.4, 10.5), V(xw - 0.5, FLOOR + 1.0, -0.8)); };
  const c = attState(A, 0).cxv;
  return [
    { s: 0, b: 1.5, f: s0 },
    { s: STRESS, b: 1.6, f: () => Pq(V(c, -9, 28), V(c, -14.5, -3)) },
    { s: 8.4, b: 1.2, f: () => Pq(V(c - 1, -3, 44), V(c - 1, -9, -4)) },
    { s: VERDICT, b: 1.5, f: () => Pq(V(c - 5, -12, 22), V(c - 6, -16.5, -2)) },
  ];
}
ATT.forEach((A) => (A.shots = attShots(A)));
function workerX(A, a) {
  if (A.kind === 'tbm') return -36.6;
  const st = attState(A, a);
  if (a < DIG[0]) return lerp(-33.5, SX1 + 0.3, ease(a / DIG[0]));
  if (a < RUN[0]) return Math.max(SX1 + 0.3, st.front - 0.9);
  return lerp(st.front - 0.9, -34, ease(seg(a, RUN[0], RUN[1])));
}
function workerPose(A, a, tt) {
  const tbm = A.kind === 'tbm';
  let mode = 'idle', face = 0;
  if (!tbm && a < DIG[0]) mode = 'walk';
  else if (!tbm && a < RUN[0]) mode = 'dig';
  else if (!tbm && a < RUN[1]) { mode = 'run'; face = Math.PI; }
  if (a >= RUN[1] - (tbm ? 0.6 : 0) && a < VERDICT) mode = 'panic';
  if (a >= VERDICT) mode = 'sad';
  worker.g.visible = true;
  worker.g.position.set(workerX(A, a), FLOOR, tbm ? -6.5 : A.kind === 'round' ? -0.35 : -0.7);
  worker.g.rotation.y = face; poseWorker(mode, tt);
}

function hideAttemptExtras() {
  [rubbleFill, chimney, crater, tunnelWater, debris, drops, roundBore, rectBore, flatWall, ...flatRoof, ...bricks, ...arrows].forEach((m) => (m.visible = false));
  frames.forEach((f) => (f.post.visible = f.cap.visible = false));
  cracks.flat().forEach((m) => (m.visible = false));
}

function updateAttempt(A, a, tt) {
  const st = attState(A, a), { cx, hl, crown, floorY } = st;
  const stress = seg(a, STRESS, 8.4), c1 = ease(seg(a, FALL, 9.5));
  hideAttemptExtras();
  // túnel cavado à mão
  if (A.kind !== 'tbm') {
    const bm = A.kind === 'round' ? roundBore : rectBore, len = st.front - SX1;
    bm.visible = len > 0.01; bm.scale.x = Math.max(0.001, len);
    setBox(soil[2].mid, st.front, AX0, LAYERS[2].bot, LAYERS[2].top, ZB, 0);
  }
  const inZone = (x) => Math.abs(x - cx) < hl + 0.3;
  // apoios de cada tentativa
  if (A.sup === 'wood') frames.forEach((f, i) => {
    const x = SX1 + 1.0 + i * 1.7; if (x > st.front - 1.2) return;
    const fall = inZone(x) ? c1 : 0, sgn = i % 2 ? 1 : -1;
    setBox(f.post, x - 0.09, x + 0.09, FLOOR, FLOOR + HT - 0.25, -1.29, -1.11); f.post.rotation.z = sgn * (0.13 * stress + 1.2 * fall); f.post.position.y -= 1.1 * fall;
    setBox(f.cap, x - 0.11, x + 0.11, FLOOR + HT - 0.25, FLOOR + HT, -HW, 0.04); f.cap.position.y -= 0.22 * stress + 1.8 * fall; f.cap.rotation.z = sgn * 0.5 * fall;
  });
  if (A.sup === 'flat' && st.front > SX1 + 1.5) {
    const x1 = st.front - 0.8; setBox(flatWall, SX1, x1, FLOOR, FLOOR + HT - 0.35, -HW - 0.2, -HW);
    flatRoof.forEach((m, j) => {
      const a0 = lerp(SX1, x1, j / 6), a1 = lerp(SX1, x1, (j + 1) / 6), mid = (a0 + a1) / 2, sag = Math.sin(Math.PI * (j + 0.5) / 6);
      setBox(m, a0 + 0.02, a1 - 0.02, FLOOR + HT - 0.35, FLOOR + HT, -HW - 0.2, 0.04);
      m.position.y -= 0.45 * stress * sag + (inZone(mid) ? 2.2 * c1 : 0); m.rotation.z = (j < 3 ? -1 : 1) * (0.06 * stress * sag + (inZone(mid) ? 0.5 * c1 : 0));
    });
  }
  if (A.sup === 'brick') bricks.forEach((m, i) => {
    const x = SX1 + i * 0.48; if (x + 0.48 > st.front - 1.0) return;
    m.visible = true; const fall = inZone(x) ? c1 : 0;
    m.position.set(x, YCM - 1.3 * fall, 0); m.rotation.set(0, 0, (i % 2 ? 1 : -1) * (0.02 * stress * Math.sin(tt * 30) + 0.6 * fall));
  });
  // água (tentativa 4)
  if (A.sup === 'brick') {
    setBox(tunnelWater, SX1, st.front, FLOOR, FLOOR + 0.6 * seg(a, 6.6, 9), -HW, 0.03); tunnelWater.visible = a > 6.6;
    for (let i = 0; i < N_DROP; i++) {
      const ph = (((a * 0.9 + i * 0.173) % 1) + 1) % 1, x0 = cx - 6 + ((i * 41) % 100) / 100 * 12;
      const y = AQ_BOT - ph * (AQ_BOT - FLOOR);
      if (a < 6.2 || a > 9.6) tmpObj.scale.setScalar(0);
      else { tmpObj.position.set(x0, y, 0.04); tmpObj.rotation.set(0, 0, 0); tmpObj.scale.set(1, 2.4, 1); }
      tmpObj.updateMatrix(); drops.setMatrixAt(i, tmpObj.matrix);
    }
    drops.instanceMatrix.needsUpdate = true; drops.visible = a > 6.2 && a < 9.6;
  }
  // setas do peso da terra e trincas
  const ar = fadeIO(a, STRESS, 9.4, 0.4); arrowMat.opacity = 0.9 * ar;
  arrows.forEach((m, i) => { m.visible = ar > 0; const s = 0.8 + 0.5 * stress;
    m.scale.setScalar(s); m.position.set(cx + (i - 1) * 3.2, crown + 0.6 + 0.35 * Math.abs(Math.sin(tt * 5 + i)), 0.045); });
  const cr = seg(a, 6.6, 8.5);
  cracks.forEach((segs, c) => segs.forEach((b, k) => {
    b.visible = a < 9.2 && k / segs.length < cr;
    if (k === 0) segs.forEach((bb) => bb.userData.base || (bb.userData.base = bb.position.clone()));
    b.position.copy(b.userData.base).add(V(cx + (c - 1) * 2.4, crown + 0.1, 0));
  }));
  // desabamento
  if (a > FALL) {
    setBox(rubbleFill, cx - hl, cx + hl, floorY, lerp(floorY, crown + 0.05, c1), -st.zw, 0.04); rubbleFill.visible = c1 > 0.01;
    const ch = ease(seg(a, 8.8, 10));
    chimney.visible = ch > 0; chimney.position.set(cx, crown - 0.2, 0.035);
    chimney.scale.set(hl * 0.85, Math.max(0.01, ch * (0.4 - crown)), 1);
    const crt = ease(seg(a, 9.7, 10.4)); crater.visible = crt > 0;
    crater.position.set(cx, 0.27, -6.2); crater.scale.set(Math.max(0.01, crt * 6), 1, Math.max(0.01, crt * 6));
    for (let i = 0; i < N_DEB; i++) {
      const ts = FALL + (i / N_DEB) * 1.4, dt = a - ts;
      if (dt < 0) tmpObj.scale.setScalar(0);
      else {
        const x0 = cx + (((i * 53) % 100) / 100 - 0.5) * 2 * hl, z0 = -0.2 - ((i * 31) % 100) / 100 * (st.zw - 0.4);
        const y = Math.max(lerp(floorY, crown, c1) + 0.2, crown - 0.2 - 11 * dt * dt);
        tmpObj.position.set(x0, y, z0); tmpObj.rotation.set(i + dt * 3, i * 2, i * 0.7); tmpObj.scale.setScalar(0.7 + ((i * 7) % 5) * 0.15);
      }
      tmpObj.updateMatrix(); debris.setMatrixAt(i, tmpObj.matrix);
    }
    debris.instanceMatrix.needsUpdate = true; debris.visible = true;
  }
  // carro que cai na cratera (só na primeira vez)
  const car = cars[1];
  if (A.k === 1) {
    const x = Math.min(cx, cx - 34 + 6.2 * (a - 4.5)), sink = ease(seg(a, 10.0, 10.9));
    car.g.visible = x > XL; car.g.position.set(x, 0.24 - 1.6 * sink, -11.4); car.g.rotation.set(0.5 * sink, 0, -0.45 * sink);
  }
}

function attemptOverrides(A, a, tt) {
  const tbm = A.kind === 'tbm', st = attState(A, a), dig = a > DIG[0] && a < FALL;
  return {
    tt, crane: false, dig: false, rig: false, outline: 0, lowering: false, pileOn: true, pile: 0.75, truck: true,
    aquifer: A.k >= 5 ? 0.4 : A.k === 4 ? 0.45 * seg(a, 6.0, 6.8) : 0,
    xf: tbm ? st.xf : -28, tbmOn: tbm, gantry: tbm, cut: tbm ? -2.4 * Math.max(0, Math.min(a, DIG[1]) - DIG[0]) : 0,
    belt: tbm && dig, chunks: tbm && a > DIG[0] + 0.5 && a < DIG[1] + 0.3, chunkT: tt, noRings: !tbm, ringLag: 9,
  };
}

// ---------------------------------------------------------------- DOM
const setOp = (sel, v) => { $(sel).style.opacity = v; };
function showCaption(cap, a = 1) {
  if (!cap || a <= 0) { capEl.style.opacity = 0; return; }
  capEl.classList.toggle('bad', !!cap.bad);
  capNum.textContent = cap.num; capTtl.textContent = cap.ttl; capSub.textContent = cap.sub;
  capEl.style.opacity = a; capEl.style.transform = `translateX(${(1 - a) * -24}px)`;
}
function showLabels(list, time, active, A, st) {
  list.forEach((L) => {
    const a = active && (!L.k || L.k.includes(A.k)) ? fadeIO(time, L.t0, L.t1, 0.5) : 0;
    if (a <= 0) { L.el.style.opacity = 0; return; }
    const p = L.at(time, st).project(camera);
    L.el.style.opacity = p.z < 1 ? a : 0;
    L.el.style.transform = `translate(${(p.x * 0.5 + 0.5) * W}px, ${(-p.y * 0.5 + 0.5) * H}px)`;
  });
}
const toScreen = (v) => { const p = v.clone().project(camera); return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H]; };
const bubbleEl = $('#bubble'), tryEls = [...document.querySelectorAll('#tries i')];
function showTries(k, failedCur, success) {
  tryEls.forEach((el, i) => {
    const n = i + 1;
    el.className = success && n === 6 ? 'ok' : n < k || (n === k && failedCur) ? 'bad' : n === k ? 'cur' : '';
    el.textContent = success && n === 6 ? '✓' : el.className === 'bad' ? '✗' : String(n);
  });
}

// ---------------------------------------------------------------- quadro (T = tempo global do vídeo)
function frame(T) {
  let cam, A = null, a = 0, mode, t = 33;
  if (T < INTRO) { mode = 'intro'; A = ATT[0]; a = 0; }
  else if (T < T_S) {
    const u = T - INTRO, i = Math.floor(u / (A_DUR + RWD)), r = u - i * (A_DUR + RWD);
    A = ATT[i];
    if (r < A_DUR) { mode = 'try'; a = r; } else { mode = 'rewind'; a = A_DUR * (1 - ease((r - A_DUR) / RWD)); }
  } else { mode = 'win'; t = 33 + (T - T_S); }

  if (A) {
    const tt = 33 + a + (mode === 'intro' ? T - INTRO : 0);
    updateScene(33, attemptOverrides(A, a, tt));
    updateAttempt(A, a, tt);
    workerPose(A, a, tt);
    const prev = A.k > 1 ? ATT[A.k - 2].shots[0].f(0) : null;
    cam = camAt(a, A.shots, prev);
    if (mode === 'intro') {
      const u = ease(seg(T, 1.5, INTRO));
      cam.p.lerpVectors(V(0, 24, 88), cam.p, u); cam.q.lerpVectors(V(0, -10, -6), cam.q, u);
    }
    const shake = 0.45 * fadeIO(a, FALL, 10.3, 0.3);
    cam.p.add(V(Math.sin(a * 47) * shake, Math.sin(a * 31 + 1) * shake, 0));
  } else {
    updateScene(t, { crane: false, tt: t });
    hideAttemptExtras();
    worker.g.visible = t < 40; worker.g.position.set(-36.6, FLOOR, -6.5); worker.g.rotation.y = 0; poseWorker(t > 34 ? 'cheer' : 'idle', t);
    cam = camAt(t, SHOTS, T_S > 0 ? ATT[4].shots[0].f(0) : null);
  }
  if (VERT && !(mode === 'win' && t >= 80.5)) cam.p.sub(cam.q).multiplyScalar(1.3).add(cam.q); // afasta a câmera no formato vertical
  camera.position.copy(cam.p); camera.lookAt(cam.q); camera.updateMatrixWorld();

  // DOM
  const trying = mode === 'try';
  setOp('#title', mode === 'intro' ? fadeIO(T, 0.3, INTRO - 0.2, 0.8) : 0);
  if (trying) {
    const sub = a < STRESS ? A.dig : a < VERDICT ? A.stress : A.verdict;
    showCaption({ num: `Tentativa ${A.k}`, ttl: A.title, sub, bad: a >= FALL }, fadeIO(a, 0.2, A_DUR, 0.5));
  } else if (mode === 'win') {
    const c = CAPTIONS.find((k) => t >= k[0] && t < k[1]);
    showCaption(c && { num: c[2], ttl: c[3], sub: c[4] }, c ? fadeIO(t, c[0] + 0.2, c[1], 0.6) : 0);
  } else showCaption(null);
  showLabels(LABELS, t, mode === 'win');
  showLabels(A_LABELS, a, trying, A || ATT[0], A && attState(A, a));
  // carimbo, balão, contador
  const stp = trying ? fadeIO(a, 9.3, A_DUR, 0.25) : 0;
  setOp('#stamp', stp); $('#stamp').style.transform = `translate(-50%, -50%) rotate(-8deg) scale(${1 + 0.6 * (1 - seg(a, 9.3, 9.6))})`;
  let bub = 0, btxt = '';
  if (trying && a > 1.2 && a < 4) { bub = fadeIO(a, 1.2, 4, 0.3); btxt = A.hi; }
  if (trying && a > VERDICT) { bub = fadeIO(a, VERDICT, A_DUR, 0.3); btxt = A.bubble; }
  if (mode === 'win' && t > 33.3 && t < 38) { bub = fadeIO(t, 33.3, 38, 0.3); btxt = 'Agora eu sei o que fazer!'; }
  bubbleEl.style.opacity = bub;
  if (bub > 0) { bubbleEl.textContent = btxt; const [x, y] = toScreen(worker.g.position.clone().add(V(0, 2.2, 0))); bubbleEl.style.transform = `translate(${x}px, ${y}px)`; }
  setOp('#tries', mode === 'intro' ? seg(T, 5.5, 6.5) : mode === 'win' ? 1 - seg(t, 84, 85) : mode === 'rewind' ? 0 : 1);
  if (A) showTries(A.k, (trying && a >= FALL) || mode === 'rewind', false); else showTries(6, false, t > 74);
  setOp('#alarm', trying ? 0.7 * fadeIO(a, FALL, 10.4, 0.3) * (0.6 + 0.4 * Math.sin(a * 9)) : 0);
  // rebobinar
  const rw = mode === 'rewind' ? 1 : 0;
  setOp('#rewind', rw); $('#rewind .msg').textContent = A && A.k === 5 ? 'Agora vai!' : 'Tentar de novo!';
  $('#rewind .tag').style.opacity = 0.55 + 0.45 * Math.round(0.5 + 0.5 * Math.sin(T * 12));
  canvas.style.filter = rw > 0 ? 'saturate(0.3) contrast(1.2) brightness(1.08)' : 'none';
  canvas.style.transform = rw > 0 ? `translateX(${Math.sin(T * 53) * 4}px)` : 'none';
  setOp('#good', mode === 'win' ? fadeIO(T, T_S + 0.1, T_S + 3.2, 0.4) : 0);
  setOp('#endtitle', mode === 'win' ? seg(t, 85.5, 86.5) : 0);
  setOp('#fade', mode === 'win' ? Math.max(fadeIO(t, 79.9, 81.1, 0.6), seg(T, DURATION - 1, DURATION)) : 0);
  $('#progress').style.width = `${(T / DURATION) * 100}%`;

  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- execução
const params = new URLSearchParams(location.search);
window.DURATION = DURATION;
window.renderAt = (t) => frame(t);
if (params.has('render')) {
  document.body.classList.add('render');
  frame(0);
  document.fonts.ready.then(() => { window.ready = true; });
} else {
  const stage = $('#stage');
  const fit = () => { const s = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = `scale(${s})`; };
  addEventListener('resize', fit); fit();
  let playing = true, t = parseFloat(params.get('t') || '0'), last = performance.now();
  const scrub = $('#scrub'), btn = $('#play'), tl = $('#time');
  scrub.max = DURATION;
  btn.onclick = () => { playing = !playing; btn.textContent = playing ? '⏸' : '▶'; };
  scrub.oninput = () => { t = parseFloat(scrub.value); };
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (playing) { t += dt; if (t > DURATION) t = 0; scrub.value = t; }
    tl.textContent = `${t.toFixed(1)}s`;
    frame(t); requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.ready = true;
}
