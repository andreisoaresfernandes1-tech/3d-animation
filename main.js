// Como construir um túnel subterrâneo — animação 3D didática (Three.js)
// Toda a cena é função determinística do tempo t (segundos), o que permite
// tanto a reprodução no navegador quanto a renderização quadro a quadro em MP4.
import * as THREE from 'three';

export const DURATION = 129;   // 0–6 abertura · 6–40 jeito errado · 40–45 rebobinar · 45–129 jeito certo
const W = 1280, H = 720;

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
  { name: 'Rocha', top: -24, bot: -34, color: 0x67635e, sp: 0.6 },
];

// ---------------------------------------------------------------- renderer / scene
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
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
const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 800);
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
    setBox(s.right[1], holeX[0], holeX[1], -d, Math.min(-d + 100, YC - RB), SZ, 0);
    if (-d > YC - RB) s.right[1].visible = false;
    setBox(s.right[2], holeX[0], holeX[1], Math.max(-d, YC - RB), YC + RB, SZ, -RB);
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

// ---------------------------------------------------------------- objetos do "jeito errado"
const waterMat = new THREE.MeshStandardMaterial({ color: 0x2e86de, transparent: true, opacity: 0.6, roughness: 0.15, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
const aquiferMat = new THREE.MeshBasicMaterial({ color: 0x2f9bff, transparent: true, opacity: 0, depthWrite: false });
const AQ_TOP = -10.1, AQ_BOT = -12.3; // lençol freático (acima da coroa do túnel)
const aquifer = [[XL, SX0], [SX1, AX0], [AX1, XR]].map(([a, b]) => { const m = staticBox(aquiferMat, a, b, AQ_BOT, AQ_TOP, 0.0, 0.03); m.renderOrder = 4; return m; });
const tunnelWater = box(waterMat), shaftWater = box(waterMat);
tunnelWater.renderOrder = shaftWater.renderOrder = 6;
const rubbleMat = noisyMat(0x4b3420, { speck: 0.3, scale: 2.2, amp: 0.5 });
const slumps = [
  { s: V(-37.6, -4.5, -4.5), e: V(-36.6, -SD + 1.3, -5.5), sz: V(1.6, 4.2, 6.5), rz: 1.1, t0: 10.6 },
  { s: V(-27.5, -6.5, -4.0), e: V(-29.0, -SD + 1.1, -3.5), sz: V(1.5, 4.0, 6.0), rz: -0.8, t0: 10.9 },
  { s: V(-37.4, -1.5, -2.5), e: V(-35.2, -SD + 2.6, -2.0), sz: V(1.4, 2.6, 3.5), rz: 2.0, t0: 11.25 },
  { s: V(-27.6, -2.0, -6.5), e: V(-31.0, -SD + 0.8, -6.0), sz: V(1.4, 2.4, 3.5), rz: -1.6, t0: 11.5 },
].map((d) => { const m = new THREE.Mesh(UNIT, rubbleMat); m.scale.copy(d.sz); scene.add(m); return { ...d, m }; });
const chimney = (() => { // zona de solo que cedeu (vista no plano de corte)
  const sh = new THREE.Shape(), r = rng(11), pts = [];
  for (let k = 0; k <= 10; k++) pts.push([-1.4 - 0.2 * r() - k * 0.17, k / 10]);
  for (let k = 10; k >= 0; k--) pts.push([1.4 + 0.2 * r() + k * 0.17, k / 10]);
  sh.moveTo(...pts[0]); pts.slice(1).forEach((p) => sh.lineTo(...p));
  const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), rubbleMat); m.position.set(-10, YC + RB - 0.6, 0.035); m.renderOrder = 5; scene.add(m); return m;
})();
const crater = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.7, 0.1, 40), rubbleMat); crater.position.set(-10, 0.27, -6.2); scene.add(crater);
const N_DEB = 110, N_DROP = 90;
const debris = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.32, 0), rubbleMat, N_DEB); scene.add(debris);
const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: 0x7cc4ff }), N_DROP); scene.add(drops);

// ---------------------------------------------------------------- legendas / rótulos (DOM)
const $ = (s) => document.querySelector(s);
const capEl = $('#caption'), capNum = capEl.querySelector('.num'), capTtl = capEl.querySelector('.ttl'), capSub = capEl.querySelector('.sub');
const CAPTIONS = [
  [6, 15, 'Etapa 1', 'Estudo do solo', 'Sondagens revelam as camadas do terreno, e o lençol freático, antes de cavar.'],
  [15, 25, 'Etapa 2', 'Poço de acesso', 'Agora o poço é contido por paredes de concreto (paredes-diafragma): nada desmorona.'],
  [25, 33, 'Etapa 3', 'Descida da tuneladora', 'A tuneladora (TBM) é montada e descida por um pórtico até o fundo do poço.'],
  [33, 48, 'Etapa 4', 'Escavação', 'A cabeça de corte gira e tritura o solo; uma esteira leva o material até a superfície.'],
  [48, 58, 'Etapa 5', 'Revestimento', 'Atrás do escudo, o braço erector monta anéis de concreto, segmento por segmento: o teto nunca fica sem apoio.'],
  [58, 66, 'Etapa 6', 'Injeção e impermeabilização', 'Argamassa sela o vazio atrás dos anéis e drenos controlam a água do lençol. A TBM chega ao poço de saída.'],
  [66, 74, 'Etapa 7', 'Acabamento', 'A tuneladora é retirada. Instalam-se piso, trilhos, iluminação e ventilação.'],
  [74, 85.5, 'Etapa 8', 'Túnel em operação', 'Pronto! O túnel recebe seus primeiros trens.'],
];
const tbmX = (t) => keys(t, [[0, -28], [34, -28], [40, -8, (x) => x * x], [48, 5], [58, 9], [66, AX1 + 0.6, (x) => 1 - (1 - x) * (1 - x)]]);
const tbmY = (t) => keys(t, [[0, 17], [26, 17], [31.5, YC, ease], [66.2, YC], [68.6, 15, ease]]);
const LABELS = [
  ...LAYERS.map((L, i) => ({ t0: 11 + i * 0.35, t1: 15.2, text: L.name, at: () => V(17.5, (L.top + L.bot) / 2, 0.05), off: [70, 0] })),
  { t0: 12.4, t1: 15.2, text: 'Lençol freático (água)', at: () => V(17.5, (AQ_TOP + AQ_BOT) / 2, 0.05), off: [110, 34] },
  { t0: 13, t1: 15.2, text: 'Traçado do túnel', at: () => V(-6, YC + RB, 0.05), off: [0, -46] },
  { t0: 17, t1: 24.6, text: 'Paredes-diafragma', at: () => V(SX0 + 0.25, -6, 0.05), off: [-120, -30] },
  { t0: 27.5, t1: 32.8, text: 'Tuneladora (TBM)', at: (t) => V(tbmX(t) - 4, tbmY(t) + RS, 0.05), off: [90, -50] },
  { t0: 41, t1: 47.6, text: 'Cabeça de corte', at: (t) => V(tbmX(t) + 0.1, YC + 1.6, 0.05), off: [110, -70] },
  { t0: 41.6, t1: 47.6, text: 'Escudo de aço', at: (t) => V(tbmX(t) - 3.2, YC - RS, 0.05), off: [-60, 70] },
  { t0: 42.2, t1: 47.6, text: 'Esteira transportadora', at: (t) => V(tbmX(t) - 10, YC - 1.05, -1.3), off: [-70, 80] },
  { t0: 49, t1: 57.6, text: 'Braço erector', at: (t) => V(tbmX(t) - 6.9, YC, 0.05), off: [90, -60] },
  { t0: 49.6, t1: 57.6, text: 'Anéis de concreto', at: (t) => V(tbmX(t) - 12.5, YC - 2.8, 0.05), off: [-90, 70] },
  { t0: 50.2, t1: 57.6, text: 'Macacos hidráulicos', at: (t) => V(tbmX(t) - 6.2, YC + 2.5, 0.05), off: [140, -40] },
  { t0: 60, t1: 65.6, text: 'Argamassa', at: () => V(-10, YC + 3.03, 0.05), off: [0, -60] },
  { t0: 60.6, t1: 65.6, text: 'Dreno', at: () => V(-16, YC - 2.45, 0.05), off: [0, 60] },
  { t0: 69, t1: 73.6, text: 'Iluminação', at: () => V(SX1 + 2 + 3 * 8, YC + 2.25, -1.2), off: [-60, -70] },
  { t0: 69.5, t1: 73.6, text: 'Trilhos', at: () => V(10, SLAB_Y + 0.15, 0.05), off: [60, 70] },
  { t0: 70.5, t1: 73.6, text: 'Ventiladores', at: () => V(6, YC + 2.0, 0.05), off: [80, -80] },
];
const W_LABELS = [
  ...LAYERS.map((L, i) => ({ t0: 1.6 + i * 0.3, t1: 5.8, text: '?', at: () => V(-2 + i * 3, (L.top + L.bot) / 2, 0.05), off: [0, 0] })),
  { t0: 7.4, t1: 10.6, text: 'Sem paredes de contenção', at: () => V(SX1, -5, 0.05), off: [140, -40] },
  { t0: 11.6, t1: 13.8, text: 'Desmoronamento', at: () => V(-33, -SD + 2, 0.05), off: [150, -50] },
  { t0: 20.5, t1: 24.4, text: 'Sem anéis de concreto!', at: (w) => V(wXf(w) - 15, YC + RB, 0.05), off: [-20, -70] },
  { t0: 26.0, t1: 29.9, text: 'Lençol freático', at: () => V(6, (AQ_TOP + AQ_BOT) / 2, 0.05), off: [110, 46] },
  { t0: 27.0, t1: 29.9, text: 'Inundação', at: () => V(-21, YC - 1.5, 0.05), off: [-60, 70] },
  { t0: 28.4, t1: 29.9, text: 'Cratera na rua', at: () => V(-10, 0.4, -1), off: [130, -50] },
];
const labelsEl = $('#labels');
[...LABELS, ...W_LABELS].forEach((L) => {
  const el = document.createElement('div'); el.className = 'lbl';
  el.innerHTML = `<div class="line"></div><div class="dot"></div><div class="txt">${L.text}</div>`; labelsEl.appendChild(el);
  L.el = el; L.line = el.querySelector('.line'); L.txt = el.querySelector('.txt');
  const [dx, dy] = L.off, len = Math.hypot(dx, dy);
  L.line.style.width = `${Math.max(0, len - 10)}px`; L.line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  L.txt.style.left = `${dx}px`; L.txt.style.top = `${dy}px`;
});

// ---------------------------------------------------------------- câmera
const Pq = (p, q) => ({ p, q });
const SHOTS = [
  { s: 0, b: 0, f: (t) => Pq(V(lerp(0, 4, ease(t / 7)), lerp(24, 8, ease(t / 7)), lerp(88, 64, ease(t / 7))), V(0, -10, -6)) },
  { s: 6, b: 2.2, f: (t) => Pq(V(lerp(13, 9, seg(t, 6, 15)), 0, 56), V(10, -15, -4)) },
  { s: 15, b: 2.2, f: (t) => Pq(V(lerp(-25, -30, seg(t, 15, 25)), 1, 45), V(-32, -6, -5)) },
  { s: 25, b: 1.8, f: (t) => Pq(V(lerp(-21, -24, seg(t, 25, 33)), 2, 36), V(-31, -5, -4)) },
  { s: 33, b: 2, f: (t) => { const x = tbmX(t); return Pq(V(x + 3, -8.5, 25), V(x - 4, -15, -2)); } },
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

// ---------------------------------------------------------------- "jeito errado": estado em função de w (0–34 s)
const wXf = (w) => keys(w, [[0, -28], [18.2, -28], [19.8, -25, (x) => x * x], [24.8, 0]]);
const wTy = (w) => keys(w, [[0, 17], [14, 17], [17.6, YC, ease]]);
const W_CAPTIONS = [
  [0.2, 6, 'Erro 1', 'Pular o estudo do solo', 'Começam a obra sem sondagens. Ninguém sabe o que existe no subsolo…'],
  [6, 14, 'Erro 2', 'Poço sem contenção', 'Cavam o poço sem paredes de concreto, e as laterais desmoronam.'],
  [14, 24.7, 'Erro 3', 'Escavar sem revestimento', 'A tuneladora avança, mas ninguém instala os anéis de concreto.'],
  [24.7, 30.2, 'Resultado', 'Desastre!', 'A água do subsolo invade o túnel, o teto cede e abre uma cratera na rua.'],
];
const W_SHOTS = [
  { s: 0, b: 2.2, f: (w) => Pq(V(lerp(4, -4, seg(w, 0, 6)), 3, 60), V(-2, -13, -5)) },
  { s: 6, b: 2, f: (w) => Pq(V(lerp(-26, -29, seg(w, 6, 14)), 0, 42), V(-32, -7, -5)) },
  { s: 14, b: 1.6, f: (w) => Pq(V(-23, 1, 36), V(-31, -7, -4)) },
  { s: 18, b: 1.8, f: (w) => { const x = wXf(w); return Pq(V(x + 1, -8, 27), V(x - 6, -14.5, -2)); } },
  { s: 24.6, b: 1.2, f: (w) => Pq(V(-9, lerp(-3, 3, seg(w, 26, 29.5)), 44), V(-10, -8.5, -4)) },
  { s: 30, b: 2, f: (w) => Pq(V(-8, -1, 60), V(-8, -10, -4)) },
];
const titleShot = (T) => SHOTS[0].f(T);

function wrongOverrides(w) {
  const tt = 6 + w;                       // tempo "de animação" (carros, braços) — volta junto no rebobinar
  const dig = w > 6.5 && w < 11.2;
  const beltOn = w > 18.4 && w < 24.8;
  return {
    tt, xf: wXf(w), ty: wTy(w), dS: SD * ease(seg(w, 6.5, 11)), dA: 0, noWalls: true, noRings: true,
    rig: false, outline: 0, crane: w > 5.6 && w < 18.2, dig, lowering: w > 14 && w < 17.9,
    pile: 0.2 + 0.45 * seg(w, 6.5, 11) + 0.3 * seg(w, 18.4, 24.8), pileOn: w > 6.6, truck: w > 6,
    aquifer: 0.45 * seg(w, 25.5, 26.6), tbmOn: w > 13.8, cut: -2.4 * Math.max(0, Math.min(w, 24.8) - 18.2), gantry: w > 18, belt: beltOn, chunks: beltOn,
    chunkT: tt,
  };
}

function updateWrongExtras(w, active) {
  const on = (v) => active && v;
  // desmoronamento das laterais do poço
  slumps.forEach((d) => {
    const u = seg(w, d.t0, d.t0 + 1.1);
    d.m.visible = on(w > d.t0);
    d.m.position.lerpVectors(d.s, d.e, u * u); d.m.rotation.set(0, 0, d.rz * u);
  });
  // água no túnel e no poço
  const lvl = lerp(YC - RB, YC + RB - 0.15, ease(seg(w, 25, 29.5)));
  setBox(tunnelWater, SX1, wXf(w) - 0.3, YC - RB, lvl, -RB, 0.03); tunnelWater.visible = on(w > 25.05);
  setBox(shaftWater, SX0, SX1, -SD, lerp(-SD, YC + 0.5, ease(seg(w, 25.4, 30))), SZ, 0.03); shaftWater.visible = on(w > 25.5);
  // chaminé de colapso e cratera
  const ch = ease(seg(w, 25.6, 28.4));
  chimney.visible = on(ch > 0); chimney.scale.set(lerp(0.6, 1, ch), Math.max(0.01, ch * (-(YC + RB) + 0.9)), 1);
  const cr = ease(seg(w, 27.6, 28.9));
  crater.visible = on(cr > 0); crater.scale.set(Math.max(0.01, cr * 6.4), 1, Math.max(0.01, cr * 6.4));
  // carro que cai na cratera
  const car = cars[1];
  if (active) {
    const x = Math.min(-10.4, -40 + 6.2 * (w - 23.5)), sink = ease(seg(w, 28.5, 29.6));
    car.g.visible = x > -53;
    car.g.position.set(x, 0.24 - 1.6 * sink, -11.4); car.g.rotation.set(0.5 * sink, 0, -0.45 * sink);
  } else car.g.visible = true;
  // detritos caindo do teto
  for (let i = 0; i < N_DEB; i++) {
    const ts = 25.4 + (i / N_DEB) * 3.6, dt = w - ts;
    if (!active || dt < 0) tmpObj.scale.setScalar(0);
    else {
      const x0 = -10 + (((i * 53) % 100) / 100 - 0.5) * 6, z0 = -0.3 - ((i * 31) % 100) / 100 * 2.4;
      const floor = YC - RB + 0.35 + ((i * 17) % 10) / 10 * 1.2 * Math.min(1, (w - 25.4) / 3);
      const y = Math.max(floor, YC + RB - 0.3 - 0.5 * 22 * dt * dt);
      tmpObj.position.set(x0, y, z0); tmpObj.rotation.set(i + dt * 3, i * 2, i * 0.7); tmpObj.scale.setScalar(0.7 + ((i * 7) % 5) * 0.15);
    }
    tmpObj.updateMatrix(); debris.setMatrixAt(i, tmpObj.matrix);
  }
  debris.instanceMatrix.needsUpdate = true; debris.visible = active && w > 25.3;
  // jatos de água pelas trincas
  for (let i = 0; i < N_DROP; i++) {
    const ph = (((w * 1.4 + i * 0.137) % 1) + 1) % 1;
    const x0 = -24 + ((i * 41) % 100) / 100 * 22, y = YC + RB - 0.1 - ph * 2 * RB;
    if (!active || w < 24.7 || w > 30.5 || y < lvl) tmpObj.scale.setScalar(0);
    else { tmpObj.position.set(x0, y, -0.4 - ((i * 29) % 10) / 10 * 1.5); tmpObj.rotation.set(0, 0, 0); tmpObj.scale.set(1, 2.2, 1); }
    tmpObj.updateMatrix(); drops.setMatrixAt(i, tmpObj.matrix);
  }
  drops.instanceMatrix.needsUpdate = true; drops.visible = active && w > 24.6;
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
  const P = ov.noRings ? -1e9 : (tail - SX1) / RW + 1;
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
  cars.forEach((c) => { const x = ((((c.off + tt * c.speed) % 104) + 104) % 104) - 52; c.g.position.set(c.lane ? x : -x, 0.24, c.lane ? -11.6 : -13.4); c.g.rotation.set(0, c.lane ? 0 : Math.PI, 0); });

  // vista interna (sem corte)
  const inside = t >= 80.5;
  renderer.clippingPlanes = inside ? [] : [cutPlane];
  camLight.intensity = inside ? 60 : 0;
}

// ---------------------------------------------------------------- DOM
const setOp = (sel, v) => { $(sel).style.opacity = v; };
function showCaption(list, time, bad) {
  const cap = list.find((k) => time >= k[0] && time < k[1]);
  capEl.classList.toggle('bad', !!bad);
  if (!cap) { capEl.style.opacity = 0; return; }
  capNum.textContent = cap[2]; capTtl.textContent = cap[3]; capSub.textContent = cap[4];
  const a = fadeIO(time, cap[0] + 0.2, cap[1], 0.6); capEl.style.opacity = a; capEl.style.transform = `translateX(${(1 - a) * -24}px)`;
}
function showLabels(list, time, active) {
  list.forEach((L) => {
    const a = active ? fadeIO(time, L.t0, L.t1, 0.5) : 0;
    if (a <= 0) { L.el.style.opacity = 0; return; }
    const p = L.at(time).project(camera);
    L.el.style.opacity = p.z < 1 ? a : 0;
    L.el.style.transform = `translate(${(p.x * 0.5 + 0.5) * W}px, ${(-p.y * 0.5 + 0.5) * H}px)`;
  });
}
const summaryItems = [...document.querySelectorAll('#summary li')];

// ---------------------------------------------------------------- quadro (T = tempo global do vídeo)
const W0 = 6, W1 = 40, RW1 = 45, T_OFF = RW1 - 6; // jeito certo: t = T - 39
function frame(T) {
  let mode, t = 0, w = 0, cam;
  if (T < W0) { mode = 'title'; t = T; }
  else if (T < W1) { mode = 'wrong'; w = T - W0; }
  else if (T < RW1) { mode = 'rewind'; w = 34 * (1 - ease((T - W1) / (RW1 - W1))); }
  else { mode = 'right'; t = T - T_OFF; }
  const wrong = mode === 'wrong' || mode === 'rewind';

  if (wrong) {
    updateScene(0, wrongOverrides(w));
    updateWrongExtras(w, true);
    cam = camAt(w, W_SHOTS, titleShot(W0 + w));
    const shake = 0.35 * fadeIO(w, 10.7, 12.6, 0.3) + 0.5 * fadeIO(w, 25, 29.8, 0.4);
    cam.p.add(V(Math.sin(w * 47) * shake, Math.sin(w * 31 + 1) * shake, 0));
  } else {
    updateScene(t);
    updateWrongExtras(0, false);
    cam = camAt(t);
  }
  camera.position.copy(cam.p); camera.lookAt(cam.q); camera.updateMatrixWorld();

  // DOM
  const playing = mode === 'wrong';
  setOp('#title', mode === 'title' ? fadeIO(T, 0.3, 6.3, 0.8) : 0);
  if (wrong) showCaption(W_CAPTIONS, playing ? w : -1, true); else showCaption(CAPTIONS, t, false);
  showLabels(LABELS, t, mode === 'right');
  showLabels(W_LABELS, w, playing);
  setOp('#alarm', playing ? (0.55 + 0.3 * Math.sin(w * 9)) * Math.max(fadeIO(w, 25, 30.4, 0.5), 0.6 * fadeIO(w, 10.8, 12.4, 0.3)) : 0);
  const al = playing ? fadeIO(w, 25.6, 29.6, 0.3) : 0;
  setOp('#alert', al); $('#alert').style.transform = `scale(${1 + 0.06 * Math.sin(w * 10)})`;
  setOp('#summary', playing ? fadeIO(w, 30.3, 34.2, 0.5) : 0);
  summaryItems.forEach((li, i) => (li.style.opacity = seg(w, 31 + i * 0.7, 31.4 + i * 0.7)));
  const rw = mode === 'rewind' ? Math.min(seg(T, W1, W1 + 0.25), 1 - seg(T, RW1 - 0.3, RW1)) : 0;
  setOp('#rewind', rw);
  $('#rewind .tag').style.opacity = 0.55 + 0.45 * Math.round(0.5 + 0.5 * Math.sin(T * 12));
  canvas.style.filter = rw > 0 ? `saturate(${1 - 0.7 * rw}) contrast(${1 + 0.2 * rw}) brightness(${1 + 0.08 * rw})` : 'none';
  canvas.style.transform = rw > 0 ? `translateX(${Math.sin(T * 53) * 4 * rw}px)` : 'none';
  setOp('#good', mode === 'right' ? fadeIO(T, RW1 + 0.1, RW1 + 3.3, 0.4) : 0);
  setOp('#endtitle', mode === 'right' ? seg(t, 85.5, 86.5) : 0);
  setOp('#fade', mode === 'right' ? Math.max(fadeIO(t, 79.9, 81.1, 0.6), seg(T, DURATION - 1, DURATION)) : 0);
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
