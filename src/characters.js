import * as THREE from 'three';

export const CHARACTERS = [
  { id: 'pug', name: 'Pearson', blurb: 'Blocky pug in a Santa hat', special: 'none', walkSpeed: 6 },
  { id: 'phoenix', name: 'Captain Phoenix', blurb: 'Green polo and a big smile. Can glide.', special: 'glide', walkSpeed: 6 },
  { id: 'orbit', name: 'Orbit', blurb: 'Floating robot cube. Can hover.', special: 'hover', walkSpeed: 6 },
];

let lift = 0;
const mat = (color) => {
  const m = new THREE.MeshPhongMaterial({ color, shininess: 35, specular: 0x333333 });
  if (lift) m.emissive.set(color).multiplyScalar(lift);
  return m;
};
const glow = (color) => new THREE.MeshBasicMaterial({ color });

// A box with rounded edges: vertices outside the inner box are pushed onto a radius-r shell.
export function roundedGeo(w, h, d, r) {
  const cap = r > 0.1 ? 10 : 3;
  const seg = (dim) => Math.max(2, Math.min(cap, Math.round(dim / (r / 2))));
  const g = new THREE.BoxGeometry(w, h, d, seg(w), seg(h), seg(d));
  const pos = g.attributes.position, nor = g.attributes.normal;
  const ix = Math.max(0, w / 2 - r), iy = Math.max(0, h / 2 - r), iz = Math.max(0, d / 2 - r);
  const v = new THREE.Vector3();
  const clamp = (n, lim) => Math.max(-lim, Math.min(lim, n));
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const px = clamp(v.x, ix), py = clamp(v.y, iy), pz = clamp(v.z, iz);
    v.set(v.x - px, v.y - py, v.z - pz);
    const len = v.length();
    if (len < 1e-6) continue;
    v.divideScalar(len);
    nor.setXYZ(i, v.x, v.y, v.z);
    pos.setXYZ(i, px + v.x * r, py + v.y * r, pz + v.z * r);
  }
  return g;
}

export function box(w, h, d, color, x = 0, y = 0, z = 0, material, radius) {
  const r = radius ?? Math.min(0.05, 0.45 * Math.min(w, h, d));
  const m = new THREE.Mesh(roundedGeo(w, h, d, r), material || mat(color));
  m.position.set(x, y, z);
  return m;
}
const rb = (r, ...a) => box(...a, undefined, r);
function pivot(x, y, z, ...children) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  children.forEach((c) => g.add(c));
  return g;
}
function disc(radius, depth, color, x, y, z, material) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 16), material || mat(color));
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}

function addEyes(head, z, spread, size, pupil, y = 0.05, bulge = 0.05) {
  for (const s of [-1, 1]) {
    head.add(box(size, size, bulge, 0xffffff, s * spread, y, z));
    head.add(box(pupil, pupil, 0.04, 0x111111, s * spread + s * -0.015, y - 0.01, z + bulge / 2 + 0.015));
    head.add(box(pupil * 0.3, pupil * 0.3, 0.03, 0xffffff, s * spread + s * -0.015 + 0.02, y + 0.03, z + bulge / 2 + 0.04));
  }
}

function buildPug() {
  const g = new THREE.Group();
  const fur = 0xd9b27c, dark = 0x4a3a2e;
  const body = rb(0.15, 0.62, 0.5, 0.4, fur, 0, 0.62, 0);
  body.add(box(0.34, 0.3, 0.02, 0xefd9b4, 0, -0.02, 0.21));
  const head = pivot(0, 1.0, 0,
    rb(0.14, 0.62, 0.5, 0.52, fur, 0, 0.0, 0),
    box(0.36, 0.2, 0.16, dark, 0, -0.14, 0.32),
    box(0.12, 0.07, 0.06, 0x111111, 0, -0.07, 0.41),
    box(0.3, 0.04, 0.04, 0xb88f58, 0, 0.19, 0.27),
    box(0.2, 0.04, 0.04, 0xb88f58, 0, 0.14, 0.27),
    box(0.16, 0.22, 0.08, dark, -0.36, 0.1, 0.02),
    box(0.16, 0.22, 0.08, dark, 0.36, 0.1, 0.02));
  addEyes(head, 0.31, 0.17, 0.26, 0.15, 0.06, 0.14);
  const armL = pivot(-0.4, 0.82, 0, rb(0.075, 0.16, 0.4, 0.16, fur, 0, -0.18, 0));
  const armR = pivot(0.4, 0.82, 0, rb(0.075, 0.16, 0.4, 0.16, fur, 0, -0.18, 0));
  const legL = pivot(-0.16, 0.38, 0, rb(0.09, 0.2, 0.38, 0.22, fur, 0, -0.19, 0), box(0.22, 0.08, 0.28, dark, 0, -0.38, 0.03));
  const legR = pivot(0.16, 0.38, 0, rb(0.09, 0.2, 0.38, 0.22, fur, 0, -0.19, 0), box(0.22, 0.08, 0.28, dark, 0, -0.38, 0.03));
  const tail = pivot(0, 0.72, -0.22, box(0.12, 0.12, 0.12, fur, 0, 0.06, -0.05), box(0.12, 0.12, 0.12, fur, 0.07, 0.15, -0.05));
  const hat = pivot(0, 0.26, 0,
    box(0.7, 0.1, 0.6, 0xffffff, 0, 0, 0),
    box(0.5, 0.26, 0.44, 0xc0392b, 0, 0.17, 0),
    pivot(0.06, 0.28, 0, box(0.32, 0.22, 0.3, 0xc0392b, 0.08, 0.1, 0), box(0.2, 0.18, 0.2, 0xc0392b, 0.26, 0.0, 0),
      box(0.14, 0.14, 0.14, 0xffffff, 0.4, -0.1, 0)));
  head.add(hat);
  g.add(body, head, armL, armR, legL, legR, tail);
  g.userData.parts = { head, armL, armR, legL, legR, tail, body, hat };
  return g;
}

function capsule(radius, length, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 14), mat(color));
  m.position.set(x, y, z);
  return m;
}

function buildPhoenix() {
  lift = 0.32;
  const g = new THREE.Group();
  const skin = 0xf0b48a, green = 0x52b848, collar = 0x3f9e3a, khaki = 0xc9b68a;
  const body = rb(0.19, 0.66, 0.64, 0.4, green, 0, 0.78, 0);
  body.add(rb(0.02, 0.1, 0.16, 0.03, 0xffffff, 0, 0.3, 0.205));
  for (const s of [-1, 1]) {
    const flap = rb(0.03, 0.2, 0.09, 0.05, collar, s * 0.1, 0.3, 0.22);
    flap.rotation.z = -s * 0.55;
    body.add(flap);
  }
  for (const by of [0.17, 0.07, -0.03]) body.add(disc(0.024, 0.02, 0x1f5f26, 0, by, 0.207));
  body.add(disc(0.085, 0.02, 0x111111, 0.18, 0.1, 0.207));
  body.add(disc(0.065, 0.02, green, 0.18, 0.1, 0.216));
  body.add(box(0.05, 0.06, 0.02, 0x111111, 0.18, 0.1, 0.226));
  const hips = rb(0.1, 0.6, 0.24, 0.38, khaki, 0, 0.47, 0);
  const head = pivot(0, 1.42, 0,
    rb(0.26, 0.62, 0.58, 0.54, skin, 0, 0.0, 0),
    rb(0.12, 0.6, 0.25, 0.52, 0x151515, 0, -0.205, 0.03),
    rb(0.03, 0.3, 0.06, 0.05, 0x151515, 0, -0.085, 0.292),
    box(0.24, 0.09, 0.02, 0x6b1f1f, 0, -0.15, 0.288),
    box(0.22, 0.05, 0.02, 0xffffff, 0, -0.118, 0.297),
    rb(0.035, 0.1, 0.09, 0.08, 0xd98d63, 0, -0.01, 0.3),
    rb(0.04, 0.08, 0.2, 0.1, 0xd98d63, -0.34, 0.02, 0),
    rb(0.04, 0.08, 0.2, 0.1, 0xd98d63, 0.34, 0.02, 0));
  for (const s of [-1, 1]) {
    head.add(rb(0.05, 0.12, 0.13, 0.04, 0xffffff, s * 0.14, 0.08, 0.255));
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), mat(0x3a2414));
    pupil.position.set(s * 0.14 - s * 0.01, 0.075, 0.282);
    pupil.scale.z = 0.5;
    head.add(pupil);
    head.add(box(0.03, 0.03, 0.02, 0xffffff, s * 0.14 + s * 0.005, 0.1, 0.31));
    const brow = rb(0.02, 0.17, 0.045, 0.04, 0x151515, s * 0.15, 0.19, 0.225);
    brow.rotation.z = -s * 0.1;
    head.add(brow);
  }
  const armL = pivot(-0.45, 1.02, 0, capsule(0.125, 0.08, green, 0, -0.08, 0), capsule(0.095, 0.2, skin, 0, -0.3, 0));
  const armR = pivot(0.45, 1.02, 0, capsule(0.125, 0.08, green, 0, -0.08, 0), capsule(0.095, 0.2, skin, 0, -0.3, 0));
  const legL = pivot(-0.17, 0.5, 0, capsule(0.12, 0.26, khaki, 0, -0.25, 0), rb(0.05, 0.26, 0.12, 0.34, 0x3b2a1c, 0, -0.5, 0.05));
  const legR = pivot(0.17, 0.5, 0, capsule(0.12, 0.26, khaki, 0, -0.25, 0), rb(0.05, 0.26, 0.12, 0.34, 0x3b2a1c, 0, -0.5, 0.05));
  g.add(body, hips, head, armL, armR, legL, legR);
  head.scale.setScalar(1.12);
  g.scale.setScalar(0.95);
  lift = 0;
  g.userData.parts = { head, armL, armR, legL, legR, body, wave: true };
  return g;
}

function buildOrbitShape(scale) {
  const g = new THREE.Group();
  const core = new THREE.Group();
  core.add(rb(0.2, 0.7, 0.7, 0.7, 0xd7dde5, 0, 0, 0));
  core.add(box(0.5, 0.34, 0.04, 0x0e1522, 0, 0.04, 0.36));
  core.add(box(0.1, 0.1, 0.04, 0x39d0ff, -0.12, 0.06, 0.39, glow(0x39d0ff)));
  core.add(box(0.1, 0.1, 0.04, 0x39d0ff, 0.12, 0.06, 0.39, glow(0x39d0ff)));
  core.add(box(0.04, 0.2, 0.04, 0x9aa7b8, 0, 0.45, 0));
  core.add(box(0.1, 0.1, 0.1, 0x39d0ff, 0, 0.58, 0, glow(0x39d0ff)));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 28), glow(0x39d0ff));
  ring.rotation.x = Math.PI / 2;
  core.position.y = 0.7;
  ring.position.y = 0.2;
  g.add(core, ring);
  g.scale.setScalar(scale);
  g.userData.parts = { core, ring };
  return g;
}

export function buildCharacter(id) {
  if (id === 'pug') return buildPug();
  if (id === 'phoenix') return buildPhoenix();
  if (id === 'orbit') return buildOrbitShape(1);
  throw new Error(`unknown character: ${id}`);
}

export function buildBuddy() {
  const g = buildOrbitShape(0.5);
  g.userData.isBuddy = true;
  return g;
}

// state: { moving, airborne, griddy }
export function animateCharacter(group, t, state = {}) {
  const p = group.userData.parts;
  if (!p) return;
  const { moving = false, airborne = false, griddy = false, menu = false } = state;

  if (p.ring) {
    p.ring.rotation.z = t * 2.5;
    p.core.position.y = 0.7 + Math.sin(t * 2.2) * 0.06;
    p.ring.position.y = p.core.position.y - 0.5;
    if (griddy) p.core.rotation.z = Math.sin(t * 10) * 0.3;
    else p.core.rotation.z *= 0.8;
    return;
  }

  const swing = moving ? Math.sin(t * 11) * 0.8 : 0;
  p.armL.rotation.set(0, 0, 0);
  p.armR.rotation.set(0, 0, 0);
  p.legL.position.x = -(p.legL.userData.baseX ??= Math.abs(p.legL.position.x));
  p.legR.position.x = (p.legR.userData.baseX ??= Math.abs(p.legR.position.x));
  p.legL.rotation.set(0, 0, 0);
  p.legR.rotation.set(0, 0, 0);
  p.body.rotation.z = 0;

  if (griddy) {
    const beat = Math.sin(t * 10);
    p.armL.rotation.z = 1.25 + beat * 0.25;
    p.armR.rotation.z = -(1.25 - beat * 0.25);
    p.legL.position.x += beat * 0.1;
    p.legR.position.x += beat * 0.1;
    p.legL.rotation.z = beat * 0.15;
    p.legR.rotation.z = beat * 0.15;
    p.body.rotation.z = beat * 0.12;
    group.position.y = Math.abs(Math.sin(t * 10)) * 0.04;
  } else if (menu && p.wave) {
    p.armR.rotation.set(0, 0, 2.6 + Math.sin(t * 7) * 0.3);
  } else if (airborne) {
    p.armL.rotation.z = 2.4;
    p.armR.rotation.z = -2.4;
    p.legL.rotation.x = 0.4;
    p.legR.rotation.x = -0.3;
  } else {
    p.armL.rotation.x = swing;
    p.armR.rotation.x = -swing;
    p.legL.rotation.x = -swing;
    p.legR.rotation.x = swing;
  }
  if (p.tail) p.tail.rotation.y = Math.sin(t * (moving ? 14 : 5)) * 0.4;
  if (p.hat) p.hat.rotation.z = -Math.sin(t * 6) * (moving ? 0.1 : 0.03);
}
