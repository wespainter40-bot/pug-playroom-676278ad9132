import * as THREE from 'three';
import { box } from '../characters.js';
import { WALLS, SOLIDS, STUDENT_DESKS, SPOTS, EXIT } from './belair-layout.js';
import { segmentBlocked } from './seeker.js';

const SIGHT_RANGE = 9, SIGHT_HALF = 0.6;
const glow = (color) => new THREE.MeshBasicMaterial({ color });
const bx = (w, h, d, color, x = 0, y = 0, z = 0, r) => box(w, h, d, color, x, y, z, undefined, r);

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function textPlane(w, h, draw, px = 512) {
  const tex = canvasTexture(px, Math.round(px * (h / w)), draw);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
}

function signPlane(w, h, text, bg, fg, px = 512) {
  return textPlane(w, h, (c, cw, ch) => {
    c.fillStyle = bg;
    c.beginPath();
    c.roundRect(4, 4, cw - 8, ch - 8, ch * 0.18);
    c.fill();
    c.fillStyle = fg;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `900 ${Math.round(ch * 0.55)}px "Arial Black", Impact, sans-serif`;
    c.fillText(text, cw / 2, ch / 2 + ch * 0.03, cw - 24);
  }, px);
}

const wallSkin = (top, dado) => canvasTexture(2, 8, (g) => {
  g.fillStyle = top; g.fillRect(0, 0, 2, 6);
  g.fillStyle = dado; g.fillRect(0, 6, 2, 2);
});

function floorPlane(x0, z0, x1, z1, tex) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshPhongMaterial({ map: tex, shininess: 14 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set((x0 + x1) / 2, 0.01, (z0 + z1) / 2);
  return m;
}

function tiled(rx, rz, a, b) {
  const t = canvasTexture(2, 2, (g) => {
    g.fillStyle = a; g.fillRect(0, 0, 2, 2);
    g.fillStyle = b; g.fillRect(0, 0, 1, 1); g.fillRect(1, 1, 1, 1);
  });
  t.magFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, rz);
  return t;
}

function planks(rx, rz) {
  const t = canvasTexture(8, 64, (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#d9a566' : '#cf9a5c';
      g.fillRect(0, i * (h / 8), w, h / 8 - 1);
    }
    g.fillStyle = '#b8864a';
    for (let i = 0; i < 8; i++) g.fillRect(0, i * (h / 8) + h / 8 - 1, w, 1);
  });
  t.magFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, rz);
  return t;
}

const slabMesh = (s, material) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(s.max.x - s.min.x, s.max.y - s.min.y, s.max.z - s.min.z), material);
  m.position.set((s.min.x + s.max.x) / 2, (s.min.y + s.max.y) / 2, (s.min.z + s.max.z) / 2);
  return m;
};

const LOCKER_COLORS = [0x2f6fb5, 0xd94f3d, 0x2f6fb5, 0xf1b40f, 0x2f6fb5, 0x2e9b4a];

function buildLockers(group, s, index) {
  const w = s.max.x - s.min.x, h = s.max.y;
  const doors = Math.round(w);
  const dw = w / doors;
  for (let i = 0; i < doors; i++) {
    const cx = s.min.x + dw * (i + 0.5);
    const color = LOCKER_COLORS[(i + index) % LOCKER_COLORS.length];
    group.add(bx(dw - 0.05, h, s.max.z - s.min.z, color, cx, h / 2, (s.min.z + s.max.z) / 2, 0.03));
    for (const y of [h - 0.5, h - 0.7, h - 0.9]) group.add(bx(dw * 0.55, 0.06, 0.04, 0x16324f, cx, y, s.max.z + 0.01, 0.01));
    group.add(bx(0.07, 0.34, 0.08, 0xe6e6ea, cx + dw * 0.28, h * 0.52, s.max.z + 0.04, 0.02));
  }
}

function buildCoatCubby(group) {
  const sp = SPOTS.find((q) => q.id === 'cubby');
  const cx = (sp.x0 + sp.x1) / 2;
  group.add(bx(sp.x1 - sp.x0 + 0.1, 0.05, sp.z1 - sp.z0 + 0.1, 0x3b6ea8, cx, 0.03, (sp.z0 + sp.z1) / 2, 0.02));
  group.add(bx(sp.x1 - sp.x0, 0.07, 0.12, 0x8a5a2b, cx, 2.35, -7.82, 0.02));
  const colors = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71];
  colors.forEach((c, i) => {
    const x = sp.x0 + 0.3 + i * ((sp.x1 - sp.x0 - 0.6) / 3);
    group.add(bx(0.34, 1.45, 0.16, c, x, 1.55, -7.72, 0.08));
    group.add(bx(0.07, 0.07, 0.1, 0xdddddd, x, 2.3, -7.78, 0.02));
  });
  const sign = signPlane(2.6, 0.7, 'COAT CUBBY', '#f1b40f', '#2b1b00');
  sign.position.set(cx, 3.9, -7.96);
  group.add(sign);
}

function buildBench(group) {
  group.add(bx(4, 0.12, 1.5, 0x9a6a38, 0, 0.64, -1.05, 0.04));
  for (const x of [-1.7, 1.7]) for (const z of [-1.6, -0.5]) group.add(bx(0.12, 0.6, 0.12, 0x5a3a1a, x, 0.3, z, 0.03));
}

function buildClassroom(group) {
  const desk = SOLIDS.find((s) => s.id === 'teacherDesk');
  const dx = (desk.min.x + desk.max.x) / 2, dz = (desk.min.z + desk.max.z) / 2;
  group.add(bx(desk.max.x - desk.min.x, 0.12, desk.max.z - desk.min.z, 0xa9753f, dx, desk.max.y - 0.06, dz, 0.04));
  group.add(bx(desk.max.x - desk.min.x - 0.2, desk.max.y - 0.14, desk.max.z - desk.min.z - 0.2, 0x7a4f26, dx, (desk.max.y - 0.12) / 2, dz, 0.04));
  group.add(bx(0.5, 0.5, 0.5, 0xd8d8e0, dx + 2.2, 1.35, dz + 0.1, 0.05));
  group.add(bx(0.9, 0.9, 0.9, 0x5a3a1a, dx, 0.45, dz - 1.3, 0.06));
  const apple = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), new THREE.MeshPhongMaterial({ color: 0xd2272f }));
  apple.position.set(dx - 1.6, desk.max.y + 0.16, dz);
  group.add(apple);

  for (const s of STUDENT_DESKS) {
    const cx = (s.min.x + s.max.x) / 2, cz = (s.min.z + s.max.z) / 2;
    group.add(bx(1.4, 0.08, 0.9, 0xe2b97b, cx, 0.86, cz, 0.03));
    for (const sx of [-0.62, 0.62]) for (const sz of [-0.36, 0.36]) group.add(bx(0.06, 0.82, 0.06, 0x555a66, cx + sx, 0.41, cz + sz, 0.02));
    group.add(bx(0.55, 0.06, 0.55, 0x3b6ea8, cx, 0.5, cz + 1.0, 0.03));
    group.add(bx(0.55, 0.5, 0.06, 0x3b6ea8, cx, 0.78, cz + 1.25, 0.03));
  }

  const shelf = SOLIDS.find((s) => s.id === 'bookshelf');
  const sx = (shelf.min.x + shelf.max.x) / 2, sz = (shelf.min.z + shelf.max.z) / 2;
  group.add(bx(shelf.max.x - shelf.min.x, shelf.max.y, shelf.max.z - shelf.min.z, 0x8a5a2b, sx, shelf.max.y / 2, sz, 0.04));
  const bookColors = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xff8a3d];
  for (const y of [0.5, 1.2, 1.9]) {
    for (let z = shelf.min.z + 0.3, i = 0; z < shelf.max.z - 0.25; z += 0.32, i++) {
      group.add(bx(0.4, 0.5, 0.22, bookColors[(i + Math.round(y * 3)) % bookColors.length], shelf.max.x + 0.02, y, z, 0.02));
    }
  }

  const bean = SOLIDS.find((s) => s.id === 'beanbag');
  const bag = new THREE.Mesh(new THREE.SphereGeometry(0.85, 18, 12), new THREE.MeshPhongMaterial({ color: 0xff6fb5 }));
  bag.scale.set(1, 0.55, 1);
  bag.position.set((bean.min.x + bean.max.x) / 2, 0.45, (bean.min.z + bean.max.z) / 2);
  group.add(bag);

  const table = SPOTS.find((q) => q.id === 'storyTable');
  const tx = (table.x0 + table.x1) / 2, tz = (table.z0 + table.z1) / 2;
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.03, 32), new THREE.MeshPhongMaterial({ color: 0x6fc3df }));
  rug.position.set(tx, 0.03, tz);
  group.add(rug);
  group.add(bx(table.x1 - table.x0, 0.8, table.z1 - table.z0, 0xf4a6c0, tx, 0.4, tz, 0.06));
  group.add(bx(table.x1 - table.x0 + 0.1, 0.07, table.z1 - table.z0 + 0.1, 0xffffff, tx, 0.82, tz, 0.03));

  const board = bx(8, 2.2, 0.1, 0xf4f4f6, -14, 3.0, 14.9, 0.04);
  group.add(board);
  const writing = signPlane(7.2, 1.6, 'WELCOME TO BEL AIR!', 'rgba(255,255,255,0)', '#1f4e9c', 768);
  writing.rotation.y = Math.PI;
  writing.position.set(-14, 3.0, 14.84);
  group.add(writing);
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 24), new THREE.MeshPhongMaterial({ color: 0xffffff }));
  clock.rotation.x = Math.PI / 2;
  clock.position.set(-6, 4.4, 14.92);
  group.add(clock);
  group.add(bx(0.05, 0.32, 0.03, 0x111111, -6, 4.48, 14.88, 0.01));
  group.add(bx(0.24, 0.05, 0.03, 0x111111, -5.9, 4.4, 14.88, 0.01));

  for (const z of [10.5, 13.5]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), glow(0xbfe6ff));
    win.rotation.y = Math.PI / 2;
    win.position.set(-23.96, 3.2, z);
    group.add(win);
    group.add(bx(0.06, 2.1, 0.06, 0xffffff, -23.93, 3.2, z, 0.01));
    group.add(bx(0.06, 0.06, 2.1, 0xffffff, -23.93, 3.2, z, 0.01));
  }
}


const ball = (r, color, x, y, z) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshPhongMaterial({ color }));
  m.position.set(x, y, z);
  return m;
};

function buildCafeteria(group) {
  for (const id of ['cafeTable1', 'cafeTable2']) {
    const t = SOLIDS.find((q) => q.id === id);
    const cx = (t.min.x + t.max.x) / 2, cz = (t.min.z + t.max.z) / 2;
    group.add(bx(t.max.x - t.min.x, 0.1, 1.15, 0x4a90d9, cx, 0.8, cz, 0.03));
    for (const x of [t.min.x + 0.4, t.max.x - 0.4]) group.add(bx(0.12, 0.76, 1.0, 0x555a66, x, 0.38, cz, 0.02));
    for (const dz of [-0.95, 0.95]) {
      group.add(bx(t.max.x - t.min.x - 0.3, 0.09, 0.42, 0xe8a23a, cx, 0.46, cz + dz, 0.03));
      for (const x of [t.min.x + 0.5, t.max.x - 0.5]) group.add(bx(0.1, 0.42, 0.1, 0x555a66, x, 0.21, cz + dz, 0.02));
    }
    for (let i = 0; i < 4; i++) {
      const x = t.min.x + 0.9 + i * 1.5;
      group.add(bx(0.6, 0.04, 0.42, 0xe2e2e8, x, 0.87, cz - 0.25, 0.01));
      const pizza = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 14), new THREE.MeshPhongMaterial({ color: 0xe9722b }));
      pizza.position.set(x, 0.9, cz - 0.25);
      group.add(pizza);
      group.add(bx(0.12, 0.2, 0.1, 0xf4f4f6, x + 0.35, 0.97, cz + 0.2, 0.02));
    }
  }

  const c = SOLIDS.find((q) => q.id === 'lunchCounter');
  const cx = (c.min.x + c.max.x) / 2, cz = (c.min.z + c.max.z) / 2;
  group.add(bx(c.max.x - c.min.x, c.max.y - 0.1, c.max.z - c.min.z, 0xd9d9e0, cx, (c.max.y - 0.1) / 2, cz, 0.04));
  group.add(bx(c.max.x - c.min.x + 0.15, 0.1, c.max.z - c.min.z + 0.2, 0xff8a3d, cx, c.max.y - 0.05, cz, 0.03));
  for (const x of [c.min.x + 1.2, c.min.x + 3, c.min.x + 4.8, c.min.x + 6.6]) {
    group.add(bx(0.7, 0.04, 0.5, 0x6a6a74, x, c.max.y + 0.03, cz - 0.25, 0.01));
    group.add(bx(0.7, 0.05, 0.5, 0xffd23f, x, c.max.y + 0.08, cz - 0.25, 0.01));
  }
  const guard = new THREE.Mesh(new THREE.PlaneGeometry(c.max.x - c.min.x - 0.6, 0.55), new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
  guard.position.set(cx, c.max.y + 0.4, c.min.z + 0.1);
  group.add(guard);

  const nook = SPOTS.find((q) => q.id === 'lunchNook');
  group.add(bx(nook.x1 - nook.x0, 0.04, nook.z1 - nook.z0, 0x6a6a74, (nook.x0 + nook.x1) / 2, 0.03, (nook.z0 + nook.z1) / 2, 0.01));
  for (const y of [1.2, 2.0]) group.add(bx(nook.x1 - nook.x0 - 0.4, 0.08, 0.5, 0xc8c8d0, (nook.x0 + nook.x1) / 2, y, 14.7, 0.02));
  for (let i = 0; i < 7; i++) group.add(bx(0.5, 0.22, 0.4, [0xe74c3c, 0xf1c40f, 0x3498db][i % 3], nook.x0 + 0.5 + i * 0.95, 1.35, 14.7, 0.03));
  const lunch = signPlane(5, 0.8, 'LUNCH LINE', '#e74c3c', '#ffffff', 640);
  lunch.rotation.y = Math.PI;
  lunch.position.set(7, 3.2, 14.9);
  group.add(lunch);
  const menu = signPlane(3.6, 1.3, 'TODAY: PIZZA!', '#2b3a2b', '#fff3c4', 512);
  menu.position.set(-0.92, 3.1, 8);
  menu.rotation.y = Math.PI / 2;
  group.add(menu);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.8), glow(0xbfe6ff));
  win.rotation.y = -Math.PI / 2;
  win.position.set(10.9, 3.2, 4.5);
  group.add(win);
}

function buildGym(group) {
  const lineMat = 0xffffff;
  const L = (w, d, x, z) => group.add(bx(w, 0.02, d, lineMat, x, 0.035, z, 0));
  L(7.8, 0.12, 16.4, 2.2); L(7.8, 0.12, 16.4, 14.2);
  L(0.12, 12, 12.5, 8.2); L(0.12, 12, 20.3, 8.2);
  L(7.8, 0.1, 16.4, 8.2);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.05, 6, 40), new THREE.MeshBasicMaterial({ color: lineMat }));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(16.4, 0.04, 8.2);
  group.add(ring);
  L(2.4, 0.1, 18, 11.2); L(0.1, 3, 16.8, 12.7); L(0.1, 3, 19.2, 12.7);

  group.add(bx(2.2, 1.4, 0.1, 0xffffff, 18, 3.6, 14.9, 0.03));
  group.add(bx(0.8, 0.5, 0.05, 0xd2272f, 18, 3.4, 14.84, 0.01));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 8, 24), new THREE.MeshPhongMaterial({ color: 0xff6a00 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(18, 3.0, 14.4);
  group.add(rim);
  group.add(bx(2.2, 1.4, 0.1, 0xffffff, 14.5, 3.6, 1.1, 0.03));
  const rim2 = rim.clone();
  rim2.position.set(14.5, 3.0, 1.6);
  group.add(rim2);

  const b = SOLIDS.find((q) => q.id === 'bleachers');
  const bz = (b.min.z + b.max.z) / 2, bl = b.max.z - b.min.z;
  for (let i = 0; i < 4; i++) {
    const h = 0.55 * (i + 1);
    group.add(bx(0.45, h, bl, i % 2 ? 0xf1b40f : 0x2f6fb5, b.min.x + 0.225 + i * 0.45, h / 2, bz, 0.02));
  }
  group.add(bx(0.06, 1.0, bl, 0x555a66, b.min.x - 0.02, 0.5, bz, 0.01));

  const nook = SPOTS.find((q) => q.id === 'bleacherNook');
  group.add(bx(nook.x1 - nook.x0, 0.03, nook.z1 - nook.z0, 0x3b6ea8, (nook.x0 + nook.x1) / 2, 0.03, (nook.z0 + nook.z1) / 2, 0.01));

  const cart = SOLIDS.find((q) => q.id === 'ballCart');
  const kx = (cart.min.x + cart.max.x) / 2, kz = (cart.min.z + cart.max.z) / 2;
  group.add(bx(1.4, 0.7, 1.2, 0x555a66, kx, 0.55, kz, 0.04));
  for (const x of [-0.45, 0, 0.45]) for (const z of [-0.3, 0.3]) group.add(ball(0.24, x ? 0xff7a1c : 0xe74c3c, kx + x, 1.05, kz + z));
  for (const x of [-0.55, 0.55]) for (const z of [-0.45, 0.45]) group.add(bx(0.1, 0.2, 0.1, 0x222222, kx + x, 0.1, kz + z, 0.02));

  const crates = SOLIDS.find((q) => q.id === 'crates');
  const rx = (crates.min.x + crates.max.x) / 2, rz = (crates.min.z + crates.max.z) / 2;
  group.add(bx(1.4, 0.7, 1.4, 0xc99b5a, rx, 0.35, rz, 0.03));
  group.add(bx(1.2, 0.7, 1.2, 0xb8864a, rx, 1.05, rz, 0.03));

  const v = SOLIDS.find((q) => q.id === 'vaultBox');
  const vx = (v.min.x + v.max.x) / 2, vz = (v.min.z + v.max.z) / 2;
  group.add(bx(1.6, 0.75, 1.1, 0x8f5d2e, vx, 0.38, vz, 0.03));
  group.add(bx(1.6, 0.3, 1.1, 0x2f6fb5, vx, 0.9, vz, 0.05));

  for (const [x, z] of [[13.4, 4], [19.6, 6], [14, 13.1]]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 12), new THREE.MeshPhongMaterial({ color: 0xff7a1c }));
    cone.position.set(x, 0.25, z);
    group.add(cone);
  }
  group.add(ball(0.24, 0xff7a1c, 16.4, 0.24, 8.2));

  const banner = signPlane(8, 1.2, 'BUZZ BEES GYM', '#f1b40f', '#2b1b00', 768);
  banner.rotation.y = Math.PI;
  banner.position.set(19, 4.4, 14.9);
  group.add(banner);
  group.add(bx(0.12, 1.3, 3.2, 0x1b1b1b, 12.1, 3.6, 4.5, 0.03));
  const score = signPlane(3, 1.1, 'HOME 0  GUEST 0', '#111111', '#ff4d4d', 512);
  score.rotation.y = Math.PI / 2;
  score.position.set(12.18, 3.6, 4.5);
  group.add(score);
}

function bookFace(w, h) {
  const tex = canvasTexture(512, Math.round(512 * (h / w)), (g, cw, ch) => {
    g.fillStyle = '#6b4423';
    g.fillRect(0, 0, cw, ch);
    const rows = 4, rh = ch / rows;
    const cols = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#ff8a3d', '#1abc9c', '#ecf0f1'];
    let n = 0;
    for (let r = 0; r < rows; r++) {
      let x = 6;
      while (x < cw - 14) {
        const bw = 9 + ((n * 7) % 13), bh = rh * (0.62 + ((n * 5) % 4) * 0.08);
        g.fillStyle = cols[(n * 3 + r) % cols.length];
        g.fillRect(x, (r + 1) * rh - 8 - bh, bw, bh);
        x += bw + 2;
        n++;
      }
      g.fillStyle = '#3d2610';
      g.fillRect(0, (r + 1) * rh - 8, cw, 8);
    }
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}

function buildLibrary(group) {
  for (const id of ['libA1', 'libA2', 'libB1', 'libB2', 'libB3', 'libC']) {
    const sh = SOLIDS.find((q) => q.id === id);
    const cx = (sh.min.x + sh.max.x) / 2, cz = (sh.min.z + sh.max.z) / 2;
    group.add(slabMesh(sh, new THREE.MeshPhongMaterial({ color: 0x6b4423 })));
    const alongX = sh.max.x - sh.min.x > sh.max.z - sh.min.z;
    const len = alongX ? sh.max.x - sh.min.x : sh.max.z - sh.min.z;
    for (const side of [-1, 1]) {
      const face = bookFace(len - 0.1, sh.max.y - 0.2);
      if (alongX) {
        face.position.set(cx, sh.max.y / 2, cz + side * ((sh.max.z - sh.min.z) / 2 + 0.01));
        if (side < 0) face.rotation.y = Math.PI;
      } else {
        face.rotation.y = side * Math.PI / 2;
        face.position.set(cx + side * ((sh.max.x - sh.min.x) / 2 + 0.01), sh.max.y / 2, cz);
      }
      group.add(face);
    }
  }

  const t = SOLIDS.find((q) => q.id === 'readTable');
  const tx = (t.min.x + t.max.x) / 2, tz = (t.min.z + t.max.z) / 2;
  group.add(bx(t.max.x - t.min.x, 0.1, t.max.z - t.min.z, 0xc99b5a, tx, 0.8, tz, 0.03));
  for (const x of [t.min.x + 0.3, t.max.x - 0.3]) for (const z of [t.min.z + 0.3, t.max.z - 0.3]) group.add(bx(0.1, 0.76, 0.1, 0x5a3a1a, x, 0.38, z, 0.02));
  group.add(bx(0.5, 0.06, 0.38, 0xe74c3c, tx - 0.6, 0.88, tz, 0.01));
  group.add(bx(0.5, 0.06, 0.38, 0x3498db, tx + 0.5, 0.88, tz + 0.1, 0.01));
  group.add(bx(0.1, 0.45, 0.1, 0x2b3a2b, tx, 1.05, tz, 0.02));
  group.add(bx(0.4, 0.14, 0.4, 0xffe14d, tx, 1.32, tz, 0.04));

  const c = SOLIDS.find((q) => q.id === 'libCounter');
  const cx = (c.min.x + c.max.x) / 2, cz = (c.min.z + c.max.z) / 2;
  group.add(bx(c.max.x - c.min.x, c.max.y - 0.1, c.max.z - c.min.z, 0x9a6a38, cx, (c.max.y - 0.1) / 2, cz, 0.04));
  group.add(bx(c.max.x - c.min.x + 0.15, 0.1, c.max.z - c.min.z + 0.2, 0xc99b5a, cx, c.max.y - 0.05, cz, 0.03));
  group.add(bx(0.6, 0.35, 0.45, 0xd8d8e0, cx - 1.2, c.max.y + 0.2, cz, 0.05));
  for (let i = 0; i < 4; i++) group.add(bx(0.5, 0.08 + i * 0.01, 0.38, [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71][i], cx + 0.9, c.max.y + 0.05 + i * 0.09, cz, 0.01));

  const rug = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.03, 32), new THREE.MeshPhongMaterial({ color: 0xe9b949 }));
  rug.position.set(-4.2, 0.03, 22.3);
  group.add(rug);
  const nook = SPOTS.find((q) => q.id === 'libNook');
  group.add(bx(nook.x1 - nook.x0 + 0.2, 0.03, nook.z1 - nook.z0, 0x3b6ea8, (nook.x0 + nook.x1) / 2, 0.03, (nook.z0 + nook.z1) / 2, 0.01));
  const bag = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 10), new THREE.MeshPhongMaterial({ color: 0x4ac1a2 }));
  bag.scale.set(1, 0.5, 1);
  bag.position.set(-16, 0.3, 28);
  group.add(bag);

  const lib = signPlane(5, 0.9, 'LIBRARY', '#6b3fa0', '#ffe14d', 640);
  lib.rotation.y = Math.PI;
  lib.position.set(-10, 4.2, 28.93);
  group.add(lib);
  const quiet = signPlane(4, 0.7, 'SHHH! QUIET BEES', '#f4f4f6', '#6b3fa0', 640);
  quiet.rotation.y = Math.PI;
  quiet.position.set(-18, 3.6, 28.93);
  group.add(quiet);
  const check = signPlane(2.6, 0.55, 'CHECK OUT', '#6b3fa0', '#ffffff', 384);
  check.position.set(7, 2.3, 17.55);
  group.add(check);
}

function buildOffice(group) {
  const d = SOLIDS.find((q) => q.id === 'principalDesk');
  const dx = (d.min.x + d.max.x) / 2, dz = (d.min.z + d.max.z) / 2;
  group.add(bx(d.max.x - d.min.x, 0.12, d.max.z - d.min.z, 0x5a3a1a, dx, d.max.y - 0.06, dz, 0.04));
  group.add(bx(d.max.x - d.min.x - 0.3, d.max.y - 0.14, d.max.z - d.min.z - 0.3, 0x3e2712, dx, (d.max.y - 0.12) / 2, dz, 0.04));
  group.add(bx(0.7, 0.05, 0.5, 0xd8d8e0, dx + 1.4, d.max.y + 0.03, dz - 0.2, 0.01));
  group.add(bx(0.7, 0.4, 0.05, 0x222a33, dx + 1.4, d.max.y + 0.25, dz - 0.4, 0.01));
  group.add(bx(0.9, 0.2, 0.25, 0xffd23f, dx - 0.5, d.max.y + 0.12, dz + 0.45, 0.02));
  group.add(bx(1.0, 1.4, 0.5, 0x2b1b3a, dx, 0.8, dz - 1.4, 0.08));
  group.add(bx(1.0, 0.5, 1.0, 0x2b1b3a, dx, 0.3, dz - 1.2, 0.08));

  const f = SOLIDS.find((q) => q.id === 'filing');
  const fz = (f.min.z + f.max.z) / 2;
  group.add(bx(f.max.x - f.min.x, f.max.y, f.max.z - f.min.z, 0x8a919e, (f.min.x + f.max.x) / 2, f.max.y / 2, fz, 0.04));
  for (let i = 0; i < 4; i++) {
    const z = f.min.z + 0.65 + i * 1.25;
    group.add(bx(0.04, 0.5, 1.1, 0x6a717e, f.min.x - 0.02, 0.5 + (i % 2) * 0.6, z, 0.02));
    group.add(bx(0.06, 0.08, 0.4, 0xe6e6ea, f.min.x - 0.05, 0.55 + (i % 2) * 0.6, z, 0.01));
  }

  const cu = SOLIDS.find((q) => q.id === 'couch');
  const ux = (cu.min.x + cu.max.x) / 2, uz = (cu.min.z + cu.max.z) / 2;
  group.add(bx(cu.max.x - cu.min.x, 0.5, cu.max.z - cu.min.z, 0xc0392b, ux, 0.3, uz, 0.08));
  group.add(bx(0.4, 0.9, cu.max.z - cu.min.z, 0xa93226, cu.max.x - 0.2, 0.7, uz, 0.08));
  group.add(bx(0.8, 0.25, 0.8, 0xf1c40f, ux - 0.1, 0.65, uz - 0.7, 0.08));

  const pl = SOLIDS.find((q) => q.id === 'plant');
  const px = (pl.min.x + pl.max.x) / 2, pz = (pl.min.z + pl.max.z) / 2;
  group.add(bx(0.9, 0.6, 0.9, 0xb5651d, px, 0.3, pz, 0.08));
  for (const [ox, oy, oz, r] of [[0, 1.2, 0, 0.6], [0.3, 1.55, 0.1, 0.45], [-0.3, 1.45, -0.2, 0.45]]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), new THREE.MeshPhongMaterial({ color: 0x2e9b4a }));
    leaf.position.set(px + ox, oy, pz + oz);
    group.add(leaf);
  }

  const m = SPOTS.find((q) => q.id === 'meetingTable');
  const mx = (m.x0 + m.x1) / 2, mz = (m.z0 + m.z1) / 2;
  group.add(bx(m.x1 - m.x0, 0.1, m.z1 - m.z0, 0xf4f4f6, mx, 0.8, mz, 0.04));
  for (const x of [m.x0 + 0.3, m.x1 - 0.3]) for (const z of [m.z0 + 0.3, m.z1 - 0.3]) group.add(bx(0.1, 0.76, 0.1, 0x555a66, x, 0.38, z, 0.02));
  for (const x of [mx - 1, mx + 1]) for (const dzc of [-1.3, 1.3]) {
    group.add(bx(0.5, 0.08, 0.5, 0x3b6ea8, x, 0.45, mz + dzc, 0.03));
    group.add(bx(0.5, 0.5, 0.08, 0x3b6ea8, x, 0.72, mz + dzc + (dzc < 0 ? -0.22 : 0.22), 0.03));
  }
  group.add(bx(0.6, 0.06, 0.4, 0xffd23f, mx, 0.88, mz, 0.01));

  const rug = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.03, 32), new THREE.MeshPhongMaterial({ color: 0x2f6fb5 }));
  rug.position.set(18.5, 0.03, 20);
  group.add(rug);

  const plate = signPlane(5.4, 0.9, "PRINCIPAL'S OFFICE", '#1f4e9c', '#ffe14d', 768);
  plate.rotation.y = Math.PI;
  plate.position.set(18, 4.2, 28.93);
  group.add(plate);
  for (const [x, c1] of [[14.5, 0xf1c40f], [17.5, 0x3498db], [20.5, 0xe74c3c]]) {
    group.add(bx(1.5, 1.1, 0.06, 0x3e2712, x, 3.1, 28.92, 0.02));
    group.add(bx(1.3, 0.9, 0.04, c1, x, 3.1, 28.88, 0.01));
  }
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2), glow(0xbfe6ff));
  win.rotation.y = -Math.PI / 2;
  win.position.set(23.92, 3.2, 24);
  group.add(win);
}

function buildDoorHeaders(group) {
  const out = [];
  for (const [x, text, bg, fg] of [[-7, 'CLASSROOM', '#2f6fb5', '#ffe14d'], [5, 'CAFETERIA', '#e8a23a', '#2b1b00'], [18, 'GYM', '#2e9b4a', '#ffffff']]) {
    const g = new THREE.Group();
    g.add(bx(4.4, 1.4, 1, 0xf6e7a8, x, 4.8, 0.5, 0.03));
    const sign = signPlane(3.4, 0.8, text, bg, fg, 512);
    sign.rotation.y = Math.PI;
    sign.position.set(x, 4.8, -0.03);
    g.add(sign);
    group.add(g);
    out.push(g);
  }
  return out;
}

function buildExit(group) {
  const x = 23.9;
  const dark = glow(0x15151c);
  const opening = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.4), dark);
  opening.rotation.y = -Math.PI / 2;
  opening.position.set(x + 0.04, 1.7, EXIT.z);
  group.add(opening);
  group.add(bx(0.2, 0.25, 3.6, 0x555a66, x, 3.55, EXIT.z, 0.03));
  for (const s of [-1, 1]) group.add(bx(0.2, 3.6, 0.2, 0x555a66, x, 1.8, EXIT.z + s * 1.6, 0.03));
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xe74c3c });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.55, 1.7), lampMat);
  sign.position.set(x - 0.08, 4.1, EXIT.z);
  group.add(sign);
  const word = signPlane(1.5, 0.45, 'EXIT', 'rgba(0,0,0,0)', '#ffffff', 384);
  word.rotation.y = -Math.PI / 2;
  word.position.set(x - 0.17, 4.1, EXIT.z);
  group.add(word);

  const panels = [];
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(x - 0.04, 0, EXIT.z + s * 1.5);
    hinge.add(bx(0.1, 3.4, 1.45, 0x8f5d2e, 0, 1.7, -s * 0.74, 0.03));
    hinge.add(bx(0.06, 0.5, 0.08, 0xdddddd, -0.05, 1.7, -s * 1.3, 0.02));
    group.add(hinge);
    panels.push({ hinge, s });
  }

  return {
    set(open) {
      lampMat.color.set(open ? 0x2ee06a : 0xe74c3c);
      dark.color.set(open ? 0xfff2b0 : 0x15151c);
      for (const p of panels) p.hinge.rotation.y = open ? p.s * 1.35 : 0;
    },
  };
}

export function buildSchool() {
  const root = new THREE.Group();
  root.name = 'school';

  root.add(floorPlane(-25, -9, 25, 0.5, tiled(25, 5, '#f4efe2', '#9db4cf')));
  root.add(floorPlane(-25, 0.5, -1, 16, planks(8, 4)));
  root.add(floorPlane(-1, 0.5, 11.5, 16, tiled(6.25, 7.75, '#f7e1b5', '#d98c4a')));
  root.add(floorPlane(11.5, 0.5, 25, 16, planks(7, 5)));
  root.add(floorPlane(-25, 16, 11.5, 30, tiled(18, 7, '#8a63b0', '#7a54a0')));
  root.add(floorPlane(11.5, 16, 25, 30, tiled(6.75, 7, '#4f8c6a', '#447d5d')));
  const void_ = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ color: 0x0e1a2c }));
  void_.rotation.x = -Math.PI / 2;
  void_.position.y = -0.05;
  root.add(void_);

  const skin = new THREE.MeshPhongMaterial({ map: wallSkin('#f6e7a8', '#2f6fb5'), shininess: 8 });
  const wallGroups = [];
  const outer = new Set(['wallN', 'wallE', 'wallW', 'wallS']);
  for (const w of WALLS) {
    const g = new THREE.Group();
    g.add(slabMesh(w, skin));
    root.add(g);
    if (!outer.has(w.id.replace(/\d+$/, ''))) wallGroups.push({ g, boxes: [w] });
  }

  SOLIDS.filter((s) => s.id.startsWith('lockers')).forEach((s, i) => buildLockers(root, s, i));
  for (const id of ['cubbyL', 'cubbyR']) {
    const s = SOLIDS.find((q) => q.id === id);
    root.add(slabMesh(s, new THREE.MeshPhongMaterial({ color: 0x3b6ea8 })));
  }
  buildCoatCubby(root);
  buildBench(root);
  const can = SOLIDS.find((s) => s.id === 'trashCan');
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 1, 16), new THREE.MeshPhongMaterial({ color: 0x4a8f5c }));
  bin.position.set((can.min.x + can.max.x) / 2, 0.5, (can.min.z + can.max.z) / 2);
  root.add(bin);
  buildClassroom(root);
  buildCafeteria(root);
  buildGym(root);
  buildLibrary(root);
  buildOffice(root);
  const headers = buildDoorHeaders(root);
  wallGroups.push(...headers.map((g) => ({ g, hide: true, boxes: WALLS.filter((w) => w.id.startsWith('wallHS')) })));
  const exit = buildExit(root);

  const banner = signPlane(9, 1.5, 'BEL AIR', '#2f6fb5', '#ffe14d', 768);
  banner.position.set(-17, 4.5, -7.95);
  root.add(banner);
  const banner2 = signPlane(8, 1.2, 'BUZZ BEES WELCOME YOU!', '#f1b40f', '#2b1b00', 768);
  banner2.position.set(12, 4.5, -7.95);
  root.add(banner2);

  const lamps = [[-18, -4], [-7, -4], [8, -4], [20, -4], [-18, 8], [-8, 8], [5, 4.8], [5, 8.8], [16.4, 4], [16.4, 12], [-14, 22.3], [-4, 22.3], [5, 26], [-14, 27], [18, 19], [18, 26]];
  for (const [x, z] of lamps) root.add(bx(1.4, 0.15, 0.6, 0xfff7d0, x, 5.35, z, 0.05));

  function lowerWalls(camX, camZ, px, pz) {
    for (const w of wallGroups) {
      const low = segmentBlocked(camX, camZ, px, pz, w.boxes, 0.6)
        || w.boxes.some((b) => camX > b.min.x - 1.5 && camX < b.max.x + 1.5 && camZ > b.min.z - 1.5 && camZ < b.max.z + 1.5);
      if (w.hide) w.g.visible = !low;
      else w.g.scale.y = low ? 0.25 : 1;
    }
  }

  return { group: root, setExitOpen: exit.set, lowerWalls };
}

export function buildCard() {
  const g = new THREE.Group();
  g.name = 'beeCard';
  g.add(bx(0.95, 0.6, 0.07, 0xffd23f, 0, 0, 0, 0.05));
  for (const x of [-0.3, 0.3]) g.add(bx(0.1, 0.62, 0.075, 0x1b1b1b, x, 0, 0, 0.01));
  const label = signPlane(0.5, 0.3, 'BEE KEY', '#fff3c4', '#111111', 256);
  label.position.set(0, 0, 0.045);
  g.add(label);
  const back = label.clone();
  back.rotation.y = Math.PI;
  back.position.z = -0.045;
  g.add(back);
  g.add(bx(0.12, 0.12, 0.08, 0x333333, 0, 0.42, 0, 0.04));
  g.scale.setScalar(1.25);
  return g;
}

export function buildBeam() {
  const beam = new THREE.Group();
  const coneLen = SIGHT_RANGE, coneR = SIGHT_RANGE * Math.tan(SIGHT_HALF);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(coneR, coneLen, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.rotation.x = -Math.PI / 2;
  cone.position.set(0, 1.4, coneLen / 2);
  beam.add(cone);
  return beam;
}
