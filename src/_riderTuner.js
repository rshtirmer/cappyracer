// Interactive rider tuner: pick a character, nudge size/position/rotation, and
// copy the values back into RIVAL_ROSTER / KART. Reuses the real Kart + rider
// attach so the preview matches the game 1:1. (Dev tool — not shipped.)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Kart } from './gameplay/Kart.js';
import { KART, COLORS, MODELS, RIVAL_ROSTER } from './core/Constants.js';
import { AssetLoader } from './level/AssetLoader.js';

// --- Scene ------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141026);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(3.0, 2.3, -5.2);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.0, 0); controls.update();
scene.add(new THREE.HemisphereLight(0xffffff, 0x404060, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(4, 8, -3); key.castShadow = true; scene.add(key);
const grid = new THREE.GridHelper(14, 14, 0x554f7a, 0x332f50); scene.add(grid);

// --- Characters + editable configs ------------------------------------------
const CHARS = [
  { id: 'capybara', name: 'Capybara', kind: 'capy', file: MODELS.CAPYBARA,
    cfg: { height: KART.RIDER_HEIGHT, seatX: 0, seatY: KART.RIDER_SEAT_Y, seatZ: KART.RIDER_SEAT_Z, yaw: KART.RIDER_YAW, animate: true } },
  ...RIVAL_ROSTER.map((r) => ({
    id: r.id, name: r.name.split(' ')[0], kind: 'animal', file: r.file, roster: r,
    cfg: { height: r.height ?? KART.RIVAL_HEIGHT, seatX: r.seatX ?? 0, seatY: r.seatY ?? KART.RIDER_SEAT_Y,
           seatZ: r.seatZ ?? KART.RIDER_SEAT_Z, yaw: r.yaw ?? Math.PI, animate: r.animate !== false },
  })),
];
const DEFAULTS = JSON.parse(JSON.stringify(CHARS.map((c) => c.cfg)));

const assets = new AssetLoader();
const gltfs = {};
let orangeGltf = null;
let kart = null;
let current = 0;

// --- Load + build -----------------------------------------------------------
(async () => {
  orangeGltf = await assets.load(MODELS.ORANGE).catch(() => null);
  await Promise.all(CHARS.map(async (c) => { gltfs[c.id] = await assets.load(c.file).catch((e) => { console.error(c.file, e); return null; }); }));
  const kartGltf = await assets.load(MODELS.KART).catch((e) => { console.error('kart', e); return null; });
  kart = new Kart(scene, COLORS.KART_BODY);
  if (kartGltf) kart.setKartModel(kartGltf, { yaw: KART.MODEL_YAW, length: KART.MODEL_LENGTH, yOffset: KART.MODEL_Y });
  buildChips();
  select(0);
  renderOut();
})();

// --- Apply a character's current config to the kart -------------------------
function applyRider() {
  const c = CHARS[current];
  const g = gltfs[c.id];
  if (!kart || !g) return;
  const cfg = c.cfg;
  if (c.kind === 'capy') {
    kart._attachRider(g, { height: cfg.height, yaw: cfg.yaw, upX: KART.RIDER_UP_X,
      seatX: cfg.seatX, seatY: cfg.seatY, seatZ: cfg.seatZ, orangeGltf, animate: cfg.animate });
  } else {
    kart._attachRider(g, { height: cfg.height, yaw: cfg.yaw, upX: 0,
      seatX: cfg.seatX, seatY: cfg.seatY, seatZ: cfg.seatZ, orangeGltf: null,
      animate: cfg.animate, measureSurface: true });
  }
}

// Position can move live (no re-attach); size/rotation/animation re-attach.
function applyPositionLive() {
  if (!kart || !kart.capy) return;
  const cfg = CHARS[current].cfg;
  kart.capy.position.set(cfg.seatX, cfg.seatY, cfg.seatZ);
  kart._capyBaseY = cfg.seatY;
}

// --- UI ---------------------------------------------------------------------
const els = {
  height: document.getElementById('height'), seatX: document.getElementById('seatX'),
  seatY: document.getElementById('seatY'), seatZ: document.getElementById('seatZ'),
  yaw: document.getElementById('yaw'), animate: document.getElementById('animate'),
  out: document.getElementById('out'),
};

function buildChips() {
  const wrap = document.getElementById('chars');
  wrap.innerHTML = '';
  CHARS.forEach((c, i) => {
    const b = document.createElement('div');
    b.className = 'chip' + (i === current ? ' active' : '');
    b.textContent = c.name;
    b.onclick = () => select(i);
    wrap.appendChild(b);
  });
}

function syncSliders() {
  const cfg = CHARS[current].cfg;
  els.height.value = cfg.height;
  els.seatX.value = cfg.seatX;
  els.seatY.value = cfg.seatY;
  els.seatZ.value = cfg.seatZ;
  els.yaw.value = Math.round((cfg.yaw * 180 / Math.PI) % 360);
  els.animate.checked = !!cfg.animate;
  for (const k of ['height', 'seatX', 'seatY', 'seatZ', 'yaw']) {
    document.getElementById('v-' + k).textContent =
      k === 'yaw' ? Math.round(els.yaw.value) + '°' : (+els[k].value).toFixed(2);
  }
}

function select(i) {
  current = i;
  buildChips();
  syncSliders();
  applyRider();
  renderOut();
}

function onSlider(re) {
  const cfg = CHARS[current].cfg;
  cfg.height = +els.height.value;
  cfg.seatX = +els.seatX.value;
  cfg.seatY = +els.seatY.value;
  cfg.seatZ = +els.seatZ.value;
  cfg.yaw = (+els.yaw.value) * Math.PI / 180;
  cfg.animate = els.animate.checked;
  syncSliders();
  if (re) applyRider(); else applyPositionLive();
  renderOut();
}

// Position sliders move live; size/rotation/animation re-attach.
els.seatX.oninput = els.seatY.oninput = els.seatZ.oninput = () => onSlider(false);
els.height.oninput = els.yaw.oninput = () => onSlider(true);
els.animate.onchange = () => onSlider(true);

document.getElementById('reset').onclick = () => {
  CHARS[current].cfg = JSON.parse(JSON.stringify(DEFAULTS[current]));
  syncSliders(); applyRider(); renderOut();
};
document.getElementById('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(els.out.value); document.getElementById('copy').textContent = 'Copied ✓'; setTimeout(() => document.getElementById('copy').textContent = 'Copy all', 1200); }
  catch { els.out.select(); }
};

function fmt(n) { return (+n).toFixed(3).replace(/\.?0+$/, '') || '0'; }
function renderOut() {
  const lines = CHARS.map((c) => {
    const g = c.cfg;
    if (c.kind === 'capy') {
      return `// capybara → KART: RIDER_HEIGHT ${fmt(g.height)}, RIDER_SEAT_Y ${fmt(g.seatY)}, RIDER_SEAT_Z ${fmt(g.seatZ)}, RIDER_YAW ${fmt(g.yaw)} (seatX ${fmt(g.seatX)})`;
    }
    const parts = [
      `id: '${c.id}'`, `height: ${fmt(g.height)}`, `yaw: ${fmt(g.yaw)}`,
      `seatX: ${fmt(g.seatX)}`, `seatY: ${fmt(g.seatY)}`, `seatZ: ${fmt(g.seatZ)}`,
      `animate: ${g.animate}`,
    ];
    return `{ ${parts.join(', ')} },`;
  });
  els.out.value = lines.join('\n');
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = clock.getDelta();
  if (kart && kart.mixer) kart.mixer.update(dt);
  controls.update();
  renderer.render(scene, camera);
}
loop();
