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
  const void_ = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ color: 0x0e1a2c }));
  void_.rotation.x = -Math.PI / 2;
  void_.position.y = -0.05;
  root.add(void_);

  const skin = new THREE.MeshPhongMaterial({ map: wallSkin('#f6e7a8', '#2f6fb5'), shininess: 8 });
  const wallGroups = [];
  const outer = new Set(['wallN', 'wallE', 'wallW', 'wallCS']);
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
  const exit = buildExit(root);

  const banner = signPlane(9, 1.5, 'BEL AIR', '#2f6fb5', '#ffe14d', 768);
  banner.position.set(-17, 4.5, -7.95);
  root.add(banner);
  const banner2 = signPlane(8, 1.2, 'BUZZ BEES WELCOME YOU!', '#f1b40f', '#2b1b00', 768);
  banner2.position.set(12, 4.5, -7.95);
  root.add(banner2);

  const lamps = [[-18, -4], [-7, -4], [8, -4], [20, -4], [-18, 8], [-8, 8]];
  for (const [x, z] of lamps) root.add(bx(1.4, 0.15, 0.6, 0xfff7d0, x, 5.35, z, 0.05));

  function lowerWalls(camX, camZ, px, pz) {
    for (const w of wallGroups) w.g.scale.y = segmentBlocked(camX, camZ, px, pz, w.boxes, 0.6) ? 0.25 : 1;
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
