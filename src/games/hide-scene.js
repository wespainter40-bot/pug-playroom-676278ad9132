import * as THREE from 'three';
import { box } from '../characters.js';
import { ROOMS, SOLIDS, SPOTS, EXIT } from './hide-layout.js';
import { segmentBlocked } from './seeker.js';

// One look per room, pastels straight off Wesley's approved floor-plan mockup. `tile` and `dark` are
// the light and dark squares of that room's checker floor (dark is a deeper shade of the room's own
// pastel, so the rooms read apart on a phone), `stripe`/`light` its wall stripes, `dado` the trim band
// along the bottom of every wall face that room can see. Dining keeps the old red-and-cream.
const LOOKS = {
  dining: { tile: '#f4f1ea', dark: '#1d1d24', stripe: '#d2473a', light: '#f6e3a1', dado: '#1f4e9c', lamp: 0xffe9a8, balloons: [0xff6fb5, 0x3498db] },
  kitchen: { tile: '#fde9c9', dark: '#d9b98a', stripe: '#b8c2c9', light: '#fde9c9', dado: '#7d8f9b', lamp: 0xfff3d0, balloons: [0xe74c3c, 0xf1c40f] },
  arcade: { tile: '#d9e4fb', dark: '#8aa3da', stripe: '#2a56b8', light: '#d9e4fb', dado: '#1b3a86', lamp: 0x9fe8ff, balloons: [0x37e8ff, 0xff5fd8] },
  party: { tile: '#fbd9e8', dark: '#e592b7', stripe: '#e0498f', light: '#fbd9e8', dado: '#b82f6d', lamp: 0xffd9ec, balloons: [0xff6fb5, 0xf1c40f] },
  storage: { tile: '#dff0dc', dark: '#93c48d', stripe: '#2a8a2a', light: '#dff0dc', dado: '#2a6a2a', lamp: 0xe6ffe0, balloons: [0x2e9b4a, 0xc89b5e] },
  restrooms: { tile: '#e6e0f3', dark: '#ab9fd3', stripe: '#6a4fa0', light: '#e6e0f3', dado: '#4a3378', lamp: 0xeee6ff, balloons: [0x9b59b6, 0xffffff] },
};

const phong = (color, emissive = 0x000000) => new THREE.MeshPhongMaterial({ color, emissive, shininess: 30, specular: 0x222222 });
const glow = (color) => new THREE.MeshBasicMaterial({ color });
const bx = (w, h, d, color, x = 0, y = 0, z = 0, r) => box(w, h, d, color, x, y, z, undefined, r);
const gx = (w, h, d, color, x = 0, y = 0, z = 0, r = 0.04) => box(w, h, d, color, x, y, z, glow(color), r);

function group(name, x = 0, y = 0, z = 0, ...children) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  children.forEach((c) => g.add(c));
  return g;
}

function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

const checker = (rx, rz, light = '#f4f1ea', dark = '#1d1d24') => canvasTexture(2, 2, (g) => {
  g.fillStyle = light; g.fillRect(0, 0, 2, 2);
  g.fillStyle = dark; g.fillRect(0, 0, 1, 1); g.fillRect(1, 1, 1, 1);
}, [rx, rz]);

// A whole wall face in one texture: vertical pizzeria stripes above a solid dado band (the bottom
// quarter, so about 1.5 of the 6 units). Baking the trim in keeps one mesh per wall face, which is
// what a phone wants, instead of a stripe mesh plus a trim box on every slab.
const wallSkin = (look, rep) => canvasTexture(2, 8, (g) => {
  g.fillStyle = look.stripe; g.fillRect(0, 0, 1, 6);
  g.fillStyle = look.light; g.fillRect(1, 0, 1, 6);
  g.fillStyle = look.dado; g.fillRect(0, 6, 2, 2);
}, [rep, 1]);

// Shared across every wall face with the same room and length, and across repeat builds.
const skinCache = new Map();
function skinMat(roomId, rep) {
  const key = `${roomId}:${rep}`;
  let m = skinCache.get(key);
  if (!m) {
    m = new THREE.MeshPhongMaterial({ map: wallSkin(LOOKS[roomId], rep), shininess: 10 });
    skinCache.set(key, m);
  }
  return m;
}

function slab(s, name, materials) {
  const w = s.max.x - s.min.x, h = s.max.y - s.min.y, d = s.max.z - s.min.z;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials);
  m.name = name;
  m.position.set((s.min.x + s.max.x) / 2, (s.min.y + s.max.y) / 2, (s.min.z + s.max.z) / 2);
  return m;
}

function bunting(x0, z0, x1, z1, y, n) {
  const g = new THREE.Group();
  const colors = [0xe74c3c, 0xf1c40f, 0x2e9b4a, 0x3498db, 0xe67e22, 0xff6fb5];
  const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
  const rope = bx(0.05, 0.05, len, 0x333333, (x0 + x1) / 2, y, (z0 + z1) / 2, 0.02);
  rope.rotation.y = yaw;
  g.add(rope);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const flag = bx(0.5, 0.5, 0.06, colors[i % colors.length], x0 + (x1 - x0) * t, y - 0.35 - Math.sin(Math.PI * t) * 0.25, z0 + (z1 - z0) * t, 0.03);
    flag.rotation.set(0, yaw, Math.PI / 4);
    g.add(flag);
  }
  return g;
}

function balloon(x, z, color, h = 2.6) {
  const stick = bx(0.07, h, 0.07, 0xdddddd, 0, h / 2, 0, 0.03);
  const ball = bx(0.8, 0.8, 0.8, color, 0, h + 0.4, 0, 0.3);
  const knot = bx(0.14, 0.14, 0.14, color, 0, h - 0.05, 0, 0.05);
  return group('balloon', x, 0, z, stick, ball, knot);
}

function partyHat(x, y, z, colors, tilt = 0) {
  const g = group('hat', x, y, z);
  const widths = [0.5, 0.4, 0.3, 0.2, 0.1];
  widths.forEach((w, i) => g.add(bx(w, 0.14, w, colors[i % colors.length], 0, 0.07 + i * 0.14, 0, 0.03)));
  g.add(bx(0.09, 0.09, 0.09, 0xffffff, 0, 0.78, 0, 0.04));
  g.rotation.z = tilt;
  return g;
}

function buildTable(spot, cloth, trim, hatColors, name = `spot:${spot.id}`) {
  const w = spot.x1 - spot.x0, d = spot.z1 - spot.z0;
  const g = group(name, (spot.x0 + spot.x1) / 2, 0, (spot.z0 + spot.z1) / 2);
  const topY = 1.15;
  g.add(bx(w + 0.4, 0.15, d + 0.4, cloth, 0, topY, 0, 0.06));
  const drop = topY - 0.05;
  g.add(bx(w + 0.4, drop, 0.1, cloth, 0, drop / 2 + 0.05, (d + 0.4) / 2, 0.04));
  g.add(bx(w + 0.4, drop, 0.1, cloth, 0, drop / 2 + 0.05, -(d + 0.4) / 2, 0.04));
  g.add(bx(0.1, drop, d + 0.4, cloth, (w + 0.4) / 2, drop / 2 + 0.05, 0, 0.04));
  g.add(bx(0.1, drop, d + 0.4, cloth, -(w + 0.4) / 2, drop / 2 + 0.05, 0, 0.04));
  g.add(bx(w + 0.5, 0.12, 0.12, trim, 0, 0.18, (d + 0.4) / 2 + 0.03, 0.04));
  g.add(bx(w + 0.5, 0.12, 0.12, trim, 0, 0.18, -(d + 0.4) / 2 - 0.03, 0.04));
  if (hatColors) {
    g.add(partyHat(-w * 0.3, topY + 0.08, -d * 0.15, hatColors, 0.08));
    g.add(partyHat(w * 0.05, topY + 0.08, d * 0.2, [hatColors[1], hatColors[0], hatColors[2]], -0.1));
    g.add(partyHat(w * 0.32, topY + 0.08, -d * 0.1, [hatColors[2], hatColors[0], hatColors[1]], 0.05));
  }
  g.add(bx(0.35, 0.3, 0.35, 0xffffff, 0, topY + 0.23, d * 0.05, 0.1));
  g.add(bx(0.38, 0.1, 0.38, 0xff6fb5, 0, topY + 0.43, d * 0.05, 0.05));
  g.add(gx(0.05, 0.16, 0.05, 0xffd54a, 0, topY + 0.55, d * 0.05, 0.02));
  return g;
}

function buildCardboardBox(spot, look = {}) {
  const w = spot.x1 - spot.x0, d = spot.z1 - spot.z0;
  const g = group(`spot:${spot.id}`, (spot.x0 + spot.x1) / 2, 0, (spot.z0 + spot.z1) / 2);
  const tan = look.tan ?? 0xc89b5e, dark = look.dark ?? 0xa87c42, h = 1.6;
  g.add(bx(w, h, 0.14, tan, 0, h / 2, -d / 2, 0.04));
  g.add(bx(0.14, h, d, tan, -w / 2, h / 2, 0, 0.04));
  g.add(bx(0.14, h, d, tan, w / 2, h / 2, 0, 0.04));
  g.add(bx(w, 0.55, 0.14, tan, 0, 0.28, d / 2, 0.04));
  const flapL = bx(0.14, 0.9, d, dark, -w / 2 - 0.35, h + 0.2, 0, 0.03);
  flapL.rotation.z = 0.7;
  const flapR = bx(0.14, 0.9, d, dark, w / 2 + 0.35, h + 0.2, 0, 0.03);
  flapR.rotation.z = -0.7;
  g.add(flapL, flapR);
  g.add(bx(w * 0.45, 0.04, 0.16, 0xe8d9a8, 0, h * 0.8, -d / 2 + 0.07, 0.02));
  return g;
}

// An alcove you can duck into. It opens toward +x; `look.yaw` turns the whole thing so the opening
// faces into its room (a quarter turn swaps the footprint, so the box stays inside the spot).
function buildNook(spot, look = {}) {
  const yaw = look.yaw || 0, quarter = Math.abs(Math.sin(yaw)) > 0.5;
  const sw = spot.x1 - spot.x0, sd = spot.z1 - spot.z0;
  const w = quarter ? sd : sw, d = quarter ? sw : sd;
  // `lampGlow`, not `glow`: the module-level glow() helper is what gx() uses, so shadowing it here
  // would be a trap for the next prop added to this builder.
  const canopy = look.canopy ?? 0x4b2a7a, post = look.post ?? 0x8e44ad, seat = look.seat ?? 0xe74c3c, lampGlow = look.glow ?? 0xffe9a8;
  const g = group(`spot:${spot.id}`, (spot.x0 + spot.x1) / 2, 0, (spot.z0 + spot.z1) / 2);
  g.rotation.y = yaw;
  g.add(bx(w + 0.4, 0.2, d + 0.2, canopy, 0.1, 2.7, 0, 0.06));
  g.add(gx(0.08, 0.3, d * 0.6, look.strip ?? 0xffd54a, w / 2 + 0.2, 2.45, 0, 0.03));
  const front = w / 2 + 0.1;
  g.add(bx(0.14, 2.6, d / 2 - 0.35, post, front, 1.3, -(d / 4 + 0.17), 0.05));
  g.add(bx(0.14, 2.6, d / 2 - 0.35, post, front, 1.3, d / 4 + 0.17, 0.05));
  g.add(bx(0.6, 0.55, 0.6, seat, -w / 2 + 0.7, 0.28, 0, 0.12));
  g.add(gx(0.06, 0.5, 0.5, lampGlow, -w / 2 + 0.05, 1.6, 0, 0.03));
  if (look.door) { // a stall door, standing open so a pug can still get in
    const door = group('stallDoor', front, 0, -d / 2 + 0.2);
    door.add(bx(0.12, 1.9, d - 0.5, post, 0, 1.2, (d - 0.5) / 2, 0.04));
    door.add(bx(0.16, 0.16, 0.16, 0xf1c40f, 0.02, 1.2, d - 0.6, 0.06));
    door.rotation.y = -0.9;
    g.add(door);
  }
  return g;
}

function buildCabinet(solid, screenColor, bodyColor) {
  const w = solid.max.x - solid.min.x, h = solid.max.y, d = solid.max.z - solid.min.z;
  const g = group(`solid:${solid.id}`, (solid.min.x + solid.max.x) / 2, 0, (solid.min.z + solid.max.z) / 2);
  g.add(bx(w, h, d, bodyColor, 0, h / 2, 0, 0.1));
  g.add(gx(0.08, 1.15, d * 0.72, screenColor, w / 2 + 0.01, 1.95, 0, 0.03));
  g.add(gx(0.1, 0.4, d * 0.9, 0xffd54a, w / 2 + 0.02, 2.7, 0, 0.05));
  const panel = bx(0.7, 0.16, d * 0.85, 0x2c2c34, w / 2 + 0.2, 1.15, 0, 0.05);
  panel.rotation.z = -0.25;
  g.add(panel);
  g.add(bx(0.1, 0.35, 0.1, 0x777777, w / 2 + 0.25, 1.4, -d * 0.2, 0.04));
  g.add(bx(0.22, 0.22, 0.22, 0xe74c3c, w / 2 + 0.25, 1.62, -d * 0.2, 0.1));
  g.add(bx(0.2, 0.08, 0.2, 0xf1c40f, w / 2 + 0.3, 1.27, d * 0.15, 0.03));
  g.add(bx(0.2, 0.08, 0.2, 0x2e9b4a, w / 2 + 0.3, 1.27, d * 0.3, 0.03));
  return g;
}

// Banded column. Candy-striped by default; a shorter band and no caps makes it a stack of crates.
function buildPillar(solid, look = {}) {
  const w = solid.max.x - solid.min.x, d = solid.max.z - solid.min.z;
  const g = group(`solid:${solid.id}`, (solid.min.x + solid.max.x) / 2, 0, (solid.min.z + solid.max.z) / 2);
  const a = look.a ?? 0xffffff, b = look.b ?? 0xd2473a, cap = look.cap === undefined ? 0xf1c40f : look.cap;
  const bands = look.band ? Math.max(2, Math.round(solid.max.y / look.band)) : 8;
  const bh = solid.max.y / bands;
  for (let i = 0; i < bands; i++) g.add(bx(w, bh, d, i % 2 ? a : b, 0, bh * (i + 0.5), 0, 0.05));
  if (cap !== null) {
    g.add(bx(w + 0.2, 0.25, d + 0.2, cap, 0, solid.max.y + 0.12, 0, 0.06));
    g.add(bx(w + 0.2, 0.2, d + 0.2, cap, 0, 0.1, 0, 0.06));
  }
  return g;
}

function buildCounter(solid, look = {}) {
  const w = solid.max.x - solid.min.x, d = solid.max.z - solid.min.z;
  const g = group(`solid:${solid.id}`, (solid.min.x + solid.max.x) / 2, 0, (solid.min.z + solid.max.z) / 2);
  const body = look.body ?? 0x9a5b2c, top = look.top ?? 0xf1b40f, stud = look.studs ?? 0xffd23f;
  const stack = look.stack ?? [0xd2473a, 0xffffff], crate = look.crate ?? 0x2e9b4a;
  g.add(bx(w, 1.25, d, body, 0, 0.62, 0, 0.08));
  g.add(bx(w + 0.25, 0.3, d + 0.25, top, 0, 1.45, 0, 0.1));
  const nx = Math.round(w), nz = Math.round(d);
  const studs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.27, 0.27, 0.14, 14), phong(stud), nx * nz);
  const m = new THREE.Matrix4();
  let i = 0;
  for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
    m.makeTranslation((ix + 0.5 - nx / 2) * (w / nx), 1.67, (iz + 0.5 - nz / 2) * (d / nz));
    studs.setMatrixAt(i++, m);
  }
  g.add(studs);
  for (let k = 0; k < 3; k++) {
    g.add(bx(1.1, 0.14, 1.1, k % 2 ? stack[0] : stack[1], -w / 2 + 1.1 + k * 0.1, 1.75 + k * 0.14, -d / 2 + 1.3, 0.04));
  }
  g.add(bx(0.9, 0.5, 0.9, crate, w / 2 - 0.9, 1.9, d / 2 - 1.1, 0.12));
  return g;
}

// Open steel racking: boards, corner posts, and a few trays left on the shelves.
function buildShelf(solid, look = {}) {
  const w = solid.max.x - solid.min.x, d = solid.max.z - solid.min.z, h = solid.max.y;
  const g = group(`solid:${solid.id}`, (solid.min.x + solid.max.x) / 2, 0, (solid.min.z + solid.max.z) / 2);
  const board = look.body ?? 0xc3ced5, post = look.post ?? 0x7d8f9b, items = look.items ?? [0xe8c98a, 0xd84a2a, 0xf1e3c6];
  for (let i = 0; i < 3; i++) g.add(bx(w, 0.14, d, board, 0, 0.25 + i * (h - 0.3) / 2, 0, 0.04));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(bx(0.16, h, 0.16, post, sx * (w / 2 - 0.08), h / 2, sz * (d / 2 - 0.08), 0.04));
  const along = Math.max(w, d), wide = w >= d;
  for (let i = 0; i < 4; i++) {
    const t = (i + 0.5) / 4 - 0.5;
    const tray = bx(wide ? along * 0.2 : w * 0.6, 0.3, wide ? d * 0.6 : along * 0.2, items[i % items.length],
      wide ? t * along : 0, 0.55 + (i % 2) * (h - 0.3) / 2, wide ? 0 : t * along, 0.06);
    g.add(tray);
  }
  return g;
}

// A restroom partition: a panel floating off the floor on short feet, with a cap rail.
function buildStallWall(solid) {
  const w = solid.max.x - solid.min.x, d = solid.max.z - solid.min.z, h = solid.max.y;
  const g = group(`solid:${solid.id}`, (solid.min.x + solid.max.x) / 2, 0, (solid.min.z + solid.max.z) / 2);
  g.add(bx(w, h - 0.35, d, 0xc9b6ec, 0, (h + 0.35) / 2, 0, 0.05));
  g.add(bx(w + 0.12, 0.16, d + 0.12, 0x8e6fd0, 0, h + 0.05, 0, 0.05));
  for (const s of [-1, 1]) g.add(bx(w + 0.1, 0.35, 0.3, 0x8e6fd0, 0, 0.18, s * (d / 2 - 0.3), 0.04));
  return g;
}

// The brick oven in the Kitchen: open at +z so a pug can duck inside, glowing coals, hood on top.
function buildOven(spot) {
  const w = spot.x1 - spot.x0, d = spot.z1 - spot.z0, h = 3.2;
  const g = group(`spot:${spot.id}`, (spot.x0 + spot.x1) / 2, 0, (spot.z0 + spot.z1) / 2);
  const steel = 0xb8c2c9, dark = 0x6b757c;
  g.add(bx(w + 0.5, h, 0.3, dark, 0, h / 2, -d / 2 - 0.1, 0.05));
  for (const s of [-1, 1]) g.add(bx(0.35, h, d, steel, s * (w / 2 + 0.15), h / 2, 0, 0.06));
  g.add(bx(w + 0.9, 0.45, d + 0.4, steel, 0, h + 0.2, 0, 0.08));
  g.add(bx(w + 0.9, 0.5, 0.4, 0xd84a2a, 0, h + 0.68, -d / 2, 0.06));
  g.add(gx(w - 0.2, 0.14, d - 0.6, 0xff9a3c, 0, 0.1, 0, 0.04));
  g.add(gx(0.18, 0.8, 0.18, 0xffb14a, -w / 2 + 0.12, 1.9, -d / 2 + 0.3, 0.05));
  for (const s of [-1, 1]) g.add(bx(0.22, 0.22, 0.22, 0x2c2c34, s * (w / 2 + 0.15), h - 0.4, d / 2 - 0.2, 0.09));
  return g;
}

function buildStage(solid) {
  const w = solid.max.x - solid.min.x, h = solid.max.y, d = solid.max.z - solid.min.z;
  const cx = (solid.min.x + solid.max.x) / 2, cz = (solid.min.z + solid.max.z) / 2;
  const g = group(`solid:${solid.id}`, 0, 0, 0);
  const main = bx(w, h, d, 0x6a3fa0, cx, h / 2, cz, 0.08);
  g.add(main);
  g.add(bx(w + 0.2, 0.12, 0.2, 0xf1c40f, cx, h - 0.04, solid.max.z + 0.02, 0.05));
  g.add(bx(w - 0.6, 0.05, d - 0.4, 0x8a5fc0, cx, h + 0.02, cz, 0.02));
  const backZ = solid.min.z + 0.25;
  g.add(bx(w, 5, 0.2, 0x1f2d6b, cx, h + 2.5, backZ, 0.05));
  const star = new THREE.Group();
  star.position.set(cx, h + 3.0, backZ + 0.18);
  for (let i = 0; i < 5; i++) {
    const bar = gx(2.6, 0.32, 0.1, 0xffd54a, 0, 0, 0, 0.1);
    bar.rotation.z = (i * Math.PI) / 5;
    star.add(bar);
  }
  g.add(star);
  for (const side of [-1, 1]) {
    g.add(bx(2.8, 4.8, 0.7, 0xc0392b, cx + side * (w / 2 - 1.4), h + 2.4, solid.min.z + 0.7, 0.1));
    g.add(bx(2.8, 0.25, 0.8, 0xf1c40f, cx + side * (w / 2 - 1.4), h + 0.15, solid.min.z + 0.72, 0.05));
  }
  g.add(bx(w, 0.9, 0.8, 0xa5271b, cx, h + 4.9, solid.min.z + 0.72, 0.1));
  for (let i = 0; i < 14; i++) g.add(bx(0.4, 0.3, 0.3, 0xf1c40f, cx - w / 2 + 0.5 + i * (w - 1) / 13, h + 4.3, solid.min.z + 1.1, 0.06));
  for (const side of [-1, 1]) g.add(balloon(cx + side * (w / 2 - 0.5), solid.max.z - 0.6, side < 0 ? 0xff6fb5 : 0x3498db, 1.1));
  return g;
}

function buildPizzaSign() {
  const g = group('sign:pizza', 15.78, 3.6, -14);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.2, 8), phong(0xe9a03a));
  body.rotation.z = Math.PI / 2;
  g.add(body);
  g.add(gx(0.05, 1.5, 1.5, 0xffd54a, -0.12, 0, 0, 0.08));
  for (const [y, z] of [[0.7, 0.4], [-0.5, 0.7], [0.1, -0.5], [-0.6, -0.5], [0.8, -0.3]]) g.add(bx(0.08, 0.38, 0.38, 0xc0392b, -0.15, y, z, 0.12));
  return g;
}

// Mounted on the inner face of the Kitchen back wall (z -36), at the layout's EXIT.
const EZ = (off) => EXIT.z + off;

function buildExit() {
  const hinge = EXIT.x - 1.0;
  const root = group('exit', 0, 0, 0);
  const wood = 0x8a5a2b;
  root.add(bx(0.3, 3.5, 0.5, wood, EXIT.x - 1.3, 1.75, EZ(-1.25), 0.05));
  root.add(bx(0.3, 3.5, 0.5, wood, EXIT.x + 1.3, 1.75, EZ(-1.25), 0.05));
  root.add(bx(2.9, 0.3, 0.5, wood, EXIT.x, 3.55, EZ(-1.25), 0.05));
  const outside = glow(0x15151c);
  const light = new THREE.Mesh(new THREE.BoxGeometry(2.3, 3.4, 0.05), outside);
  light.position.set(EXIT.x, 1.7, EZ(-1.47));
  root.add(light);
  const door = new THREE.Group();
  door.name = 'exitDoor';
  door.position.set(hinge, 0, EZ(-1.35));
  door.add(bx(2.0, 3.3, 0.18, 0x2e9b4a, 1.0, 1.65, 0, 0.05));
  door.add(bx(1.5, 1.0, 0.2, 0x1e7a37, 1.0, 2.5, 0, 0.04));
  door.add(bx(1.5, 1.0, 0.2, 0x1e7a37, 1.0, 1.0, 0, 0.04));
  door.add(bx(0.14, 0.14, 0.28, 0xf1c40f, 1.7, 1.6, 0.05, 0.05));
  root.add(door);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.7),
    new THREE.MeshBasicMaterial({
      map: canvasTexture(128, 40, (g, w, h) => {
        g.fillStyle = '#12803a'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#ffffff'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('EXIT', w / 2, h / 2 + 1);
      }),
    }),
  );
  sign.position.set(EXIT.x, 4.1, EZ(-1.4));
  root.add(sign);
  const lampMat = glow(0xe74c3c);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.2), lampMat);
  lamp.position.set(EXIT.x, 4.7, EZ(-1.4));
  root.add(lamp);
  return { root, door, lampMat, outside };
}

const SKIN_OFF = 0.03; // how far a wall face sits off its slab (the exit furniture clears it)

// Which rooms look at one side of a wall slab, and over which stretch of it. A long slab can face
// two rooms (the west outer wall is the Arcade's and the Storage Room's), so each gets its own
// face in its own colours instead of the whole slab taking the first room's look.
function wallFaces(s, alongX, out) {
  const lo0 = alongX ? s.min.x : s.min.z, hi0 = alongX ? s.max.x : s.max.z;
  const off = out > 0 ? (alongX ? s.max.z : s.max.x) + 0.6 : (alongX ? s.min.z : s.min.x) - 0.6;
  const faces = [];
  for (const r of ROOMS) {
    const facing = alongX ? off >= r.z0 && off <= r.z1 : off >= r.x0 && off <= r.x1;
    if (!facing) continue;
    const lo = Math.max(lo0, alongX ? r.x0 : r.z0), hi = Math.min(hi0, alongX ? r.x1 : r.z1);
    if (hi - lo > 0.5) faces.push({ room: r.id, lo, hi });
  }
  return faces;
}

// Floor, one checker tile per room in that room's pastel, and every wall slab in SOLIDS. Each slab
// goes in its own group sitting on the floor, so lowerWalls can scale it down without it sinking.
function buildWalls(g, solidMeshes, wallGroups) {
  const dark = phong(0x7d2118);
  const floorTop = new THREE.MeshPhongMaterial({ map: checker(33, 23), shininess: 60, specular: 0x333333 });
  const floorSide = phong(0x2a2a33);
  const floor = SOLIDS.find((s) => s.id === 'floor');
  const fm = slab(floor, 'solid:floor', [floorSide, floorSide, floorTop, floorSide, floorSide, floorSide]);
  g.add(fm);
  solidMeshes.set('floor', fm);

  for (const r of ROOMS) {
    const b = r.border;
    const w = b.maxX - b.minX, d = b.maxZ - b.minZ;
    const tile = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshPhongMaterial({ map: checker(Math.round(w / 2), Math.round(d / 2), LOOKS[r.id].tile, LOOKS[r.id].dark), shininess: 60, specular: 0x333333 }),
    );
    tile.name = `floor:${r.id}`;
    tile.rotation.x = -Math.PI / 2;
    tile.position.set((b.minX + b.maxX) / 2, 0.02, (b.minZ + b.maxZ) / 2);
    g.add(tile);
  }

  for (const s of SOLIDS.filter((q) => q.id.startsWith('wall'))) {
    const w = s.max.x - s.min.x, h = s.max.y - s.min.y, d = s.max.z - s.min.z;
    const alongX = w >= d;
    const cx = (s.min.x + s.max.x) / 2, cz = (s.min.z + s.max.z) / 2;
    const wg = group(`wall:${s.id}`, cx, 0, cz);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), dark);
    m.name = `solid:${s.id}`;
    m.position.y = h / 2;
    wg.add(m);
    for (const out of [-1, 1]) {
      for (const f of wallFaces(s, alongX, out)) {
        const len = f.hi - f.lo, mid = (f.lo + f.hi) / 2;
        const face = new THREE.Mesh(new THREE.PlaneGeometry(len, h), skinMat(f.room, Math.max(1, Math.round(len / 2))));
        if (alongX) {
          face.position.set(mid - cx, h / 2, (out > 0 ? s.max.z + SKIN_OFF : s.min.z - SKIN_OFF) - cz);
          face.rotation.y = out > 0 ? 0 : Math.PI;
        } else {
          face.position.set((out > 0 ? s.max.x + SKIN_OFF : s.min.x - SKIN_OFF) - cx, h / 2, mid - cz);
          face.rotation.y = out > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
        wg.add(face);
      }
    }
    g.add(wg);
    solidMeshes.set(s.id, m);
    if (s.id.startsWith('wallIn')) wallGroups.push({ g: wg, boxes: [s] });
  }
}

// Props and decoration are not solid, so nudge them out of anything that is before placing them.
const blockers = SOLIDS.filter((s) => s.id !== 'floor' && !s.id.startsWith('wall'));
function clearOf(x, z, cx, cz) {
  const hits = (px, pz) => blockers.some((s) => px > s.min.x - 0.8 && px < s.max.x + 0.8 && pz > s.min.z - 0.8 && pz < s.max.z + 0.8)
    || SPOTS.some((s) => px > s.x0 - 0.8 && px < s.x1 + 0.8 && pz > s.z0 - 0.8 && pz < s.z1 + 0.8);
  for (let i = 0; i < 8 && hits(x, z); i++) {
    x += Math.sign(cx - x) * 1.2;
    z += Math.sign(cz - z) * 1.2;
  }
  return [x, z];
}

// Per-hiding-spot dressing. Each one is turned to open into its own room.
const SPOT_LOOKS = {
  table1: { cloth: 0xff6fb5, trim: 0xffd54a, hats: [0xe74c3c, 0xf1c40f, 0x3498db] },
  table2: { cloth: 0x2ec4b6, trim: 0xffffff, hats: [0x3498db, 0xff6fb5, 0xf1c40f] },
  prepTable: { cloth: 0xe8eef1, trim: 0xb8c2c9, hats: null },
  longTable: { cloth: 0xff9ec8, trim: 0xffffff, hats: [0xff6fb5, 0xf1c40f, 0x8e44ad] },
  prizeBin: { tan: 0x2b6fd8, dark: 0x1f4e9c },
  giftPile: { tan: 0xff8ac2, dark: 0xe0498f },
  doughShelf: { canopy: 0x7d8f9b, post: 0xb8c2c9, seat: 0xe8c98a, glow: 0xfde9c9, strip: 0xfff3d0 },
  cabinetGap: { canopy: 0x1b3a86, post: 0x2a56b8, seat: 0x37e8ff, glow: 0x9fe8ff, strip: 0x37e8ff },
  mopCloset: { canopy: 0x2a6a2a, post: 0x2a8a2a, seat: 0xc89b5e, glow: 0xdff0dc, strip: 0x8fd48a, yaw: Math.PI },
  stall1: { canopy: 0x4a3378, post: 0x8e6fd0, seat: 0xe6e0f3, glow: 0xeee6ff, strip: 0xc9b6ec, yaw: Math.PI / 2, door: true },
  stall2: { canopy: 0x4a3378, post: 0x8e6fd0, seat: 0xe6e0f3, glow: 0xeee6ff, strip: 0xc9b6ec, yaw: Math.PI / 2, door: true },
};

export function buildPizzeria() {
  const group3 = new THREE.Group();
  group3.name = 'pizzeria';
  const solidMeshes = new Map();
  const wallGroups = [];
  buildWalls(group3, solidMeshes, wallGroups);

  const byId = (id) => SOLIDS.find((s) => s.id === id);
  const rect = (s) => ({ id: s.id, x0: s.min.x, x1: s.max.x, z0: s.min.z, z1: s.max.z });
  const steel = { body: 0x9fb0bb, top: 0xd8dde1, studs: 0xeef2f4, stack: [0xf1e3c6, 0xe8c98a], crate: 0xd84a2a };
  const crates = { a: 0xc89b5e, b: 0xb0864a, cap: null, band: 0.8 };
  const cake = buildPillar(byId('cakeStand'), { a: 0xfff3f8, b: 0xffb3d4, cap: 0xffd54a, band: 0.6 });
  cake.add(bx(0.3, 0.3, 0.3, 0xe74c3c, 0, byId('cakeStand').max.y + 0.4, 0, 0.12));
  cake.add(gx(0.08, 0.32, 0.08, 0xffd54a, 0, byId('cakeStand').max.y + 0.75, 0, 0.03));
  const parts = [
    ['stage', buildStage(byId('stage'))],
    ['pillarA', buildPillar(byId('pillarA'))],
    ['pillarB', buildPillar(byId('pillarB'))],
    ['counter', buildCounter(byId('counter'))],
    ['kitchenIsland', buildCounter(byId('kitchenIsland'), steel)],
    ['kitchenShelf', buildShelf(byId('kitchenShelf'))],
    ['cabinet1', buildCabinet(byId('cabinet1'), 0x37e8ff, 0x2b3a8c)],
    ['cabinet2', buildCabinet(byId('cabinet2'), 0xff5fd8, 0x7a2a8c)],
    ['cabinet3', buildCabinet(byId('cabinet3'), 0x7cff8a, 0x1f6f4a)],
    ['crateStackA', buildPillar(byId('crateStackA'), crates)],
    ['crateStackB', buildPillar(byId('crateStackB'), crates)],
    ['partyTable', buildTable(rect(byId('partyTable')), 0xff6fb5, 0xffffff, [0xf1c40f, 0x3498db, 0xff6fb5], 'solid:partyTable')],
    ['cakeStand', cake],
    ['stallWall1', buildStallWall(byId('stallWall1'))],
    ['stallWall2', buildStallWall(byId('stallWall2'))],
  ];
  for (const [id, obj] of parts) {
    group3.add(obj);
    solidMeshes.set(id, obj);
  }

  for (const s of SPOTS) {
    const look = SPOT_LOOKS[s.id] || {};
    if (s.kind === 'table') group3.add(buildTable(s, look.cloth ?? 0xff6fb5, look.trim ?? 0xffd54a, look.hats === undefined ? [0xe74c3c, 0xf1c40f, 0x3498db] : look.hats));
    else if (s.kind === 'box') group3.add(buildCardboardBox(s, look));
    else if (s.kind === 'nook') group3.add(buildNook(s, look));
    else if (s.kind === 'oven') group3.add(buildOven(s));
  }
  group3.add(buildPizzaSign());

  // Kitchen: a rack of pans over the island. Arcade: a neon strip on the back wall.
  const pans = group('decor:pans', 0, 0, -29.75);
  pans.add(bx(10, 0.12, 0.12, 0x7d8f9b, 0, 3.7, 0, 0.04));
  for (let i = 0; i < 4; i++) pans.add(bx(0.9, 0.9, 0.18, i % 2 ? 0xb8c2c9 : 0x6b757c, -3.6 + i * 2.4, 3.1, 0, 0.3));
  group3.add(pans);
  const neon = group('decor:neon', -25, 4.3, -21.85);
  neon.add(gx(7, 0.22, 0.12, 0x37e8ff, 0, 0.55, 0, 0.06));
  neon.add(gx(7, 0.22, 0.12, 0xff5fd8, 0, -0.55, 0, 0.06));
  neon.add(gx(1.1, 1.1, 0.14, 0x9fe8ff, 0, 0, 0, 0.3));
  group3.add(neon);

  // Bunting, balloons and lamps, placed off each room's own rectangle.
  const lamps = [];
  for (const r of ROOMS) {
    const look = LOOKS[r.id];
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    for (const z of d > 20 ? [r.z0 + 1.2, r.z1 - 1.2] : [cz]) {
      group3.add(bunting(r.x0 + 0.8, z, r.x1 - 0.8, z, 5.2, Math.max(4, Math.round(w / 2.6))));
    }
    const corners = [[r.x0 + 1.2, r.z0 + 1.4, 1.6], [r.x1 - 1.2, r.z1 - 1.4, 2.0]];
    corners.forEach(([bxp, bzp, h], i) => {
      const [x, z] = clearOf(bxp, bzp, cx, cz);
      group3.add(balloon(x, z, look.balloons[i], h));
    });
    for (const [x, z] of w > 20 ? [[cx - w / 4, cz], [cx + w / 4, cz]] : [[cx, cz - d / 4], [cx, cz + d / 4]]) {
      group3.add(bx(0.05, 1.0, 0.05, 0x333333, x, 5.5, z, 0.02));
      group3.add(gx(0.9, 0.35, 0.9, look.lamp, x, 4.9, z, 0.12));
      lamps.push([x, z]);
    }
  }
  group3.userData.lamps = lamps.map(([x, z]) => new THREE.Vector3(x, 4.6, z));

  const exit = buildExit();
  group3.add(exit.root);
  function setDoorOpen(open) {
    exit.door.rotation.y = open ? -1.45 : 0;
    exit.lampMat.color.set(open ? 0x2ee06a : 0xe74c3c);
    exit.outside.color.set(open ? 0xfff2b0 : 0x15151c);
  }
  setDoorOpen(false);

  // An interior wall standing between the lifted camera and the pug drops to a quarter height so
  // the pug is never hidden behind one. Outer walls never move: dropping them shows the void.
  function lowerWalls(camX, camZ, px, pz) {
    for (const w of wallGroups) w.g.scale.y = segmentBlocked(camX, camZ, px, pz, w.boxes, 0.6) ? 0.25 : 1;
  }

  return { group: group3, exitDoor: exit.door, setDoorOpen, solidMeshes, lowerWalls };
}

const SIGHT_RANGE = 9, SIGHT_HALF = 0.6;

export function buildSeeker() {
  const root = new THREE.Group();
  root.name = 'bolt';
  const body = new THREE.Group();
  body.scale.setScalar(0.62);
  root.add(body);

  const orange = 0xe8862a, cream = 0xffe9b8, dark = 0x2b1b12;
  body.add(bx(1.3, 1.4, 0.9, orange, 0, 1.55, 0, 0.16));
  body.add(bx(0.85, 0.85, 0.12, cream, 0, 1.5, 0.45, 0.1));
  const tie = group('tie', 0, 2.1, 0.5);
  const wingL = bx(0.38, 0.3, 0.14, 0xd2272f, -0.27, 0, 0, 0.06);
  wingL.rotation.z = 0.35;
  const wingR = bx(0.38, 0.3, 0.14, 0xd2272f, 0.27, 0, 0, 0.06);
  wingR.rotation.z = -0.35;
  tie.add(wingL, wingR, bx(0.2, 0.22, 0.18, 0xa81b22, 0, 0, 0.02, 0.06));
  body.add(tie);

  const head = group('head', 0, 2.35, 0);
  head.add(bx(1.4, 1.1, 1.1, orange, 0, 0.55, 0, 0.22));
  for (const s of [-1, 1]) {
    head.add(bx(0.5, 0.5, 0.26, orange, s * 0.55, 1.2, 0, 0.18));
    head.add(bx(0.28, 0.28, 0.1, cream, s * 0.55, 1.2, 0.12, 0.08));
    head.add(bx(0.38, 0.46, 0.1, 0xffffff, s * 0.3, 0.72, 0.56, 0.1));
    head.add(bx(0.17, 0.22, 0.08, dark, s * 0.3, 0.7, 0.62, 0.05));
    head.add(bx(0.34, 0.07, 0.07, dark, s * 0.3, 1.0, 0.6, 0.03));
    head.add(bx(0.2, 0.14, 0.06, 0xff9aa8, s * 0.55, 0.38, 0.56, 0.05));
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 10), phong(0x9aa0a8));
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(s * 0.78, 0.5, 0);
    head.add(bolt);
    head.add(bx(0.05, 0.14, 0.05, 0x55595f, s * 0.9, 0.5, 0, 0.02));
  }
  head.add(bx(0.74, 0.36, 0.34, cream, 0, 0.5, 0.6, 0.12));
  head.add(bx(0.26, 0.17, 0.14, dark, 0, 0.62, 0.78, 0.06));
  const mouth = bx(0.9, 0.22, 0.08, dark, 0, 0.2, 0.55, 0.04);
  mouth.name = 'mouth';
  head.add(mouth);
  for (let i = 0; i < 5; i++) head.add(bx(0.13, 0.13, 0.05, 0xffffff, -0.32 + i * 0.16, 0.27, 0.6, 0.02));
  const hat = group('hat', 0.1, 1.1, -0.05);
  [[0.8, 0xe74c3c], [0.64, 0xf1c40f], [0.5, 0x3498db], [0.36, 0xe74c3c], [0.22, 0xf1c40f]].forEach(([w, c], i) => hat.add(bx(w, 0.22, w, c, 0, 0.11 + i * 0.22, 0, 0.05)));
  hat.add(bx(0.2, 0.2, 0.2, 0xffffff, 0, 1.2, 0, 0.09));
  hat.rotation.z = -0.15;
  head.add(hat);
  body.add(head);

  const limbs = {};
  for (const [name, x] of [['armL', -0.85], ['armR', 0.85]]) {
    const p = group(name, x, 2.0, 0, bx(0.38, 1.0, 0.4, orange, 0, -0.5, 0, 0.12), bx(0.46, 0.3, 0.46, cream, 0, -1.1, 0, 0.12));
    body.add(p);
    limbs[name] = p;
  }
  for (const [name, x] of [['legL', -0.35], ['legR', 0.35]]) {
    const p = group(name, x, 0.85, 0, bx(0.5, 0.8, 0.55, 0xc9701c, 0, -0.4, 0, 0.12), bx(0.6, 0.25, 0.85, 0x5a2e14, 0, -0.78, 0.14, 0.1));
    body.add(p);
    limbs[name] = p;
  }
  root.userData.parts = { ...limbs, head };
  root.userData.body = body;
  root.userData.mouth = mouth;

  const beam = new THREE.Group();
  beam.name = 'beam';
  const coneLen = SIGHT_RANGE, coneR = SIGHT_RANGE * Math.tan(SIGHT_HALF);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(coneR, coneLen, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.rotation.x = -Math.PI / 2;
  cone.position.set(0, 1.5, coneLen / 2);
  beam.add(cone);
  const spot = new THREE.SpotLight(0xfff1c0, 30, SIGHT_RANGE + 2, SIGHT_HALF, 0.5, 1.5);
  spot.position.set(0, 1.6, 0.3);
  spot.target.position.set(0, 0.2, SIGHT_RANGE * 0.7);
  beam.add(spot, spot.target);
  root.add(beam);
  root.userData.beam = beam;
  return root;
}

export function animateSeeker(g, t, { moving = false, state = 'patrol' } = {}) {
  const p = g.userData.parts, body = g.userData.body;
  const swing = Math.sin(t * 7);
  let armL = Math.sin(t * 2) * 0.08, armR = -armL, legL = 0, legR = 0, wobble = 0, bob = 0;
  let headY = Math.sin(t * 1.3) * 0.1, headZ = Math.sin(t * 1.7) * 0.05, grin = 1;
  if (moving) {
    const k = state === 'chase' ? 1.15 : 0.7;
    armL = swing * k; armR = -swing * k;
    legL = -swing * 0.8; legR = swing * 0.8;
    wobble = Math.sin(t * 7) * 0.07;
    bob = Math.abs(Math.sin(t * 7)) * 0.06;
  }
  if (state === 'chase') {
    armL = -1.3 + swing * 0.25; armR = -1.3 - swing * 0.25;
    headZ = Math.sin(t * 14) * 0.06;
  } else if (state === 'investigate') {
    headY = Math.sin(t * 2.4) * 0.55;
  } else if (state === 'tickle') {
    armL = -2.7 + Math.sin(t * 22) * 0.5; armR = -2.7 - Math.sin(t * 22) * 0.5;
    wobble = Math.sin(t * 20) * 0.16;
    headZ = Math.sin(t * 24) * 0.2;
    grin = 1.12;
    bob = Math.abs(Math.sin(t * 11)) * 0.12;
  }
  p.armL.rotation.x = armL; p.armR.rotation.x = armR;
  p.legL.rotation.x = legL; p.legR.rotation.x = legR;
  p.head.rotation.y = headY; p.head.rotation.z = headZ;
  body.rotation.z = wobble;
  body.position.y = bob;
  g.userData.mouth.scale.set(grin, grin, 1);
}

export function buildToy() {
  const g = new THREE.Group();
  g.name = 'toy';
  g.add(bx(0.34, 0.26, 0.42, 0xffd23f, 0, 0.13, 0, 0.1));
  g.add(bx(0.24, 0.24, 0.24, 0xffd23f, 0, 0.34, 0.14, 0.09));
  g.add(bx(0.16, 0.07, 0.14, 0xff8a1f, 0, 0.3, 0.3, 0.03));
  g.add(bx(0.04, 0.05, 0.04, 0x222222, -0.07, 0.38, 0.25, 0.015));
  g.add(bx(0.04, 0.05, 0.04, 0x222222, 0.07, 0.38, 0.25, 0.015));
  g.add(bx(0.1, 0.1, 0.18, 0xf2bf1f, 0, 0.18, -0.24, 0.04));
  return g;
}

export function buildToyPickup() {
  const g = new THREE.Group();
  g.name = 'toyPickup';
  g.add(bx(0.85, 0.5, 0.85, 0x9a6a3a, 0, 0.25, 0, 0.07));
  for (const y of [0.15, 0.35]) g.add(bx(0.9, 0.07, 0.9, 0xc08a4f, 0, y, 0, 0.03));
  const duck = buildToy();
  duck.scale.setScalar(1.25);
  duck.position.y = 0.5;
  g.add(duck);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 24), new THREE.MeshBasicMaterial({ color: 0x66e0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  g.add(ring);
  return g;
}

export function buildBone() {
  const g = new THREE.Group();
  g.name = 'bone';
  const gold = phong(0xffc72c, 0x6b4a00);
  const part = (w, h, d, x, y, r) => {
    const m = box(w, h, d, 0xffc72c, x, y, 0, gold, r);
    g.add(m);
  };
  part(0.8, 0.2, 0.2, 0, 0, 0.07);
  for (const x of [-0.45, 0.45]) for (const y of [-0.11, 0.11]) part(0.24, 0.24, 0.24, x, y, 0.1);
  g.scale.setScalar(1.3);
  return g;
}
