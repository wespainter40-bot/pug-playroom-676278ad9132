import * as THREE from 'three';
import { createStorage } from './storage.js';
import { createPlayClock, boneTotal, isUnlocked } from './rules.js';
import { CHARACTERS, buildCharacter, animateCharacter } from './characters.js';
import { GAMES } from './games/registry.js';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';

const params = new URLSearchParams(location.search);
const manual = params.get('manual') === '1';

function pickBackend() {
  try {
    const ls = window.localStorage;
    ls.setItem('pug.__probe', '1');
    ls.removeItem('pug.__probe');
    return ls;
  } catch {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
  }
}
const store = createStorage(pickBackend());
const audio = createAudio({ store });
for (const evt of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(evt, () => audio.unlock(), { passive: true });
document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button')) audio.sfx('click'); });

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
const scene = new THREE.Scene();
const MENU_BG = new THREE.Color(0x5aa9f0);
scene.background = MENU_BG;
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);

// ---- state ----
let mode = 'menu';
let character = store.load('character', 'pug');
if (!CHARACTERS.some((c) => c.id === character)) character = 'pug';
let dev = store.load('devMode', false) === true;
let buddyOn = store.load('buddy', true) !== false;
let scary = store.load('scary', false) === true;
let clock = createPlayClock({ store });
let game = null, gameId = null, input = null;
let tickAcc = 0;
let griddyUntil = 0;
let menuT = 0;

// ---- menu stage ----
const stage = new THREE.Group();
scene.add(stage);
stage.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.2));
const key = new THREE.DirectionalLight(0xffffff, 0.9);
key.position.set(3, 6, 5);
stage.add(key);
const pedestal = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 2.4), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
pedestal.position.y = -0.15;
const pedTop = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 2.5), new THREE.MeshLambertMaterial({ color: 0xffffff }));
pedTop.position.y = 0.04;
const showcase = new THREE.Group();
showcase.add(pedestal, pedTop);
stage.add(showcase);

const SNOW = 260;
const snowPos = new Float32Array(SNOW * 3);
for (let i = 0; i < SNOW; i++) {
  snowPos[i * 3] = (Math.random() - 0.5) * 14;
  snowPos[i * 3 + 1] = Math.random() * 8 - 1;
  snowPos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1;
}
const snowGeo = new THREE.BufferGeometry();
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09 }));
stage.add(snow);

let preview = null;
function showPreview() {
  if (preview) showcase.remove(preview);
  preview = buildCharacter(character);
  preview.scale.setScalar(camera.aspect < 1 ? 1.2 : 1.6);
  preview.position.y = 0.08;
  showcase.add(preview);
}

function layoutStage() {
  const portrait = camera.aspect < 1;
  showcase.position.set(portrait ? 0 : 1.9 * Math.min(1, camera.aspect / 1.7), portrait ? 4.3 : 0, 0);
  if (preview) preview.scale.setScalar(portrait ? 1.2 : 1.6);
  camera.position.set(0, portrait ? 2.8 : 2.0, portrait ? 11 : 5.8);
  camera.lookAt(portrait ? 0 : 0.3, portrait ? 1.5 : 1.2, 0);
}

// ---- ui ----
function menuInfo() {
  return {
    character,
    locked: clock.isLocked(),
    bonesTotal: boneTotal(store),
    bestTimes: store.load('bestTimes', {}),
    unlocks: { blitz: isUnlocked(store, 'blitz', dev) },
  };
}

const ui = createUI({
  characters: CHARACTERS,
  games: GAMES,
  on: {
    play: (id) => startGame(id),
    pick: (id) => { character = id; store.save('character', id); showPreview(); ui.showMenu(menuInfo()); },
    griddy: () => { griddyUntil = menuT + 4; },
    menu: () => exitToMenu(),
    restart: () => game && game.restart(),
    again: () => startGame(gameId),
    dev: (v) => { dev = v; store.save('devMode', v); },
    limit: (v) => { clock.setEnabled(v); ui.showMenu(menuInfo()); if (mode === 'menu' && !clock.isLocked()) ui.hideLocked(); },
    buddy: (v) => { buddyOn = v; store.save('buddy', v); },
    sound: (v) => { audio.setMuted(!v); ui.setSwitches({ dev, limit: clock.isEnabled(), buddy: buddyOn, sound: v, scary }); },
    scary: (v) => { scary = v; store.save('scary', v); },
  },
});
ui.setSwitches({ dev, limit: clock.isEnabled(), buddy: buddyOn, sound: !audio.isMuted(), scary });

function setHud(partial) {
  ui.setHud({ ...partial, saved: boneTotal(store), remaining: clock.remaining(), dev });
}

function startGame(id) {
  if (clock.isLocked()) { ui.showLocked(); ui.showMenu(menuInfo()); return; }
  const def = GAMES.find((g) => g.id === id);
  if (!def) return;
  if (def.requires && !isUnlocked(store, def.requires, dev)) { ui.showMenu(menuInfo()); return; }
  if (game) { game.dispose(); input.destroy(); }
  gameId = id;
  stage.visible = false;
  ui.hideMenu();
  ui.hideWin();
  ui.showHud();
  input = createInput(canvas, def.input);
  game = def.start({
    scene, camera, input, store, ui, character, audio,
    getDev: () => dev,
    getBuddy: () => buddyOn,
    getScary: () => scary,
    setScary: (v) => { scary = v; store.save('scary', v); ui.setSwitches({ dev, limit: clock.isEnabled(), buddy: buddyOn, sound: !audio.isMuted(), scary }); },
    setHud,
    onWin: (res) => { mode = 'won'; audio.music('menu'); ui.clearToast(); ui.showWin(res); },
  });
  mode = 'playing';
  audio.music(def.music || 'game');
}

function exitToMenu() {
  if (game) { game.dispose(); input.destroy(); game = null; input = null; }
  mode = 'menu';
  audio.music('menu');
  stage.visible = true;
  scene.background = MENU_BG;
  ui.hideWin();
  ui.clearToast();
  ui.showMenu(menuInfo());
  layoutStage();
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (mode === 'menu') layoutStage();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

// ---- loop ----
function update(dt) {
  if (mode === 'menu') {
    menuT += dt;
    if (preview) {
      const dancing = menuT < griddyUntil;
      preview.rotation.y = dancing ? 0 : menuT * 0.6;
      animateCharacter(preview, menuT, { griddy: dancing, menu: !dancing });
    }
    const a = snowGeo.attributes.position.array;
    for (let i = 0; i < SNOW; i++) {
      a[i * 3 + 1] -= dt * (0.6 + (i % 5) * 0.12);
      a[i * 3] += Math.sin(menuT + i) * dt * 0.1;
      if (a[i * 3 + 1] < -1) a[i * 3 + 1] = 7;
    }
    snowGeo.attributes.position.needsUpdate = true;
    return;
  }
  game.update(dt);
  if (mode === 'playing' && !dev && document.visibilityState === 'visible') {
    tickAcc += dt;
    if (tickAcc >= 1) { clock.tick(tickAcc, true); tickAcc = 0; }
  }
  if (mode === 'playing' && clock.isLocked()) { exitToMenu(); ui.showLocked(); }
}

function frame() {
  if (game) game.frame();
  renderer.render(scene, camera);
}

let last = performance.now();
function loop(t) {
  const dt = Math.min((t - last) / 1000, 0.1);
  last = t;
  if (!manual) update(dt);
  frame();
  requestAnimationFrame(loop);
}

showPreview();
resize();
exitToMenu();
requestAnimationFrame(loop);

// ---- test hooks ----
window.render_game_to_text = () => JSON.stringify({
  mode,
  character,
  dev,
  limitEnabled: clock.isEnabled(),
  limitRemaining: Number.isFinite(clock.remaining()) ? Math.round(clock.remaining()) : null,
  bonesSaved: boneTotal(store),
  bestTimes: store.load('bestTimes', {}),
  game: game ? game.state() : null,
  note: 'forward is -z; W moves toward -z',
});
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i++) update(1 / 60);
  frame();
};
window.__game = {
  startGame,
  exitToMenu,
  select: (id) => { character = id; store.save('character', id); showPreview(); ui.showMenu(menuInfo()); },
  teleport: (x, y, z) => game && game.teleport(x, y, z),
  call: (fn, ...args) => game && game[fn] && game[fn](...args),
};
window.__renderInfo = () => ({
  triangles: renderer.info.render.triangles,
  calls: renderer.info.render.calls,
  geometries: renderer.info.memory.geometries,
  textures: renderer.info.memory.textures,
});
window.__audio = () => audio.stats();
window.__input = () => input && input.read();
window.__setLimit = (seconds) => {
  const used = clock.secondsToday();
  const enabled = clock.isEnabled();
  clock = createPlayClock({ store, limitSeconds: used + seconds, enabled });
};
