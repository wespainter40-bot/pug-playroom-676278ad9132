import * as THREE from 'three';
import { FIELD } from './football-layout.js';
import { BLITZ } from './blitz-logic.js';

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const slab = (w, h, d, color, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'object' ? color : lambert(color));
  m.position.set(x, y, z);
  return m;
};

function textPlane(text, w, h, fill, bg) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = Math.round(256 * h / w);
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); } else g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = fill;
  g.font = `900 ${Math.round(c.height * 0.72)}px Arial Black, Arial`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
}

function crowdTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2b2f3a';
  g.fillRect(0, 0, 256, 64);
  const colors = ['#f5511e', '#ffb612', '#f4f4f4', '#17171c', '#e8b48a', '#8d5a3a', '#3a79a6'];
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 4; y < 64; y += 8) {
    for (let x = 3; x < 256; x += 7) {
      g.fillStyle = colors[Math.floor(rnd() * colors.length)];
      g.beginPath();
      g.arc(x + rnd() * 2, y + rnd() * 2, 2.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function buildField() {
  const group = new THREE.Group();
  const grassA = lambert(0x2f8a3c), grassB = lambert(0x2a7d36), outside = lambert(0x24692f);
  const midZ = (FIELD.goalZ + FIELD.backZ) / 2, len = FIELD.backZ - FIELD.goalZ;
  const width = FIELD.maxX - FIELD.minX;

  group.add(slab(width + 14, 0.2, len + 30, outside, 0, -0.11, midZ));
  const bands = Math.round(len / 5);
  for (let i = 0; i < bands; i++) {
    const z0 = FIELD.goalZ + (len / bands) * i;
    group.add(slab(width, 0.2, len / bands, i % 2 ? grassA : grassB, 0, -0.1, z0 + len / bands / 2));
  }
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let z = FIELD.goalZ; z <= FIELD.backZ + 0.01; z += 5) group.add(slab(width, 0.02, 0.18, white, 0, 0.011, z));
  for (const sx of [FIELD.minX, FIELD.maxX]) group.add(slab(0.2, 0.02, len, white, sx, 0.011, midZ));

  const bengalsZone = slab(width, 0.2, 8, lambert(0xf5511e), 0, -0.1, FIELD.backZ + 4);
  const steelersZone = slab(width, 0.2, FIELD.goalZ - FIELD.endZ, lambert(0x17171c), 0, -0.1, (FIELD.goalZ + FIELD.endZ) / 2);
  group.add(bengalsZone, steelersZone);
  const bt = textPlane('BENGALS', 12, 3, '#111111');
  bt.rotation.x = -Math.PI / 2;
  bt.position.set(0, 0.03, FIELD.backZ + 4);
  const st = textPlane('STEELERS', 12, 3, '#ffb612');
  st.rotation.x = -Math.PI / 2;
  st.position.set(0, 0.03, (FIELD.goalZ + FIELD.endZ) / 2);
  group.add(bt, st);

  const gold = lambert(0xffd21f);
  for (const z of [FIELD.endZ - 1.2, FIELD.backZ + 9.2]) {
    group.add(slab(0.18, 3.2, 0.18, gold, 0, 1.6, z));
    group.add(slab(5.6, 0.18, 0.18, gold, 0, 3.2, z));
    for (const sx of [-2.8, 2.8]) group.add(slab(0.14, 3, 0.14, gold, sx, 4.7, z));
  }

  const crowd = crowdTexture();
  const wallMat = lambert(0x3a4256);
  const farZ = FIELD.endZ - 2.4, nearZ = FIELD.backZ + 10.4;
  const sideX = FIELD.maxX + 5.6;
  for (const sx of [-1, 1]) {
    group.add(slab(0.6, 1.4, len + 24, wallMat, sx * sideX, 0.7, (farZ + nearZ) / 2));
    for (let r = 0; r < 3; r++) {
      const st2 = slab(2.4, 1.2, len + 24, lambert(0x4a526a), sx * (sideX + 1.8 + r * 2.4), 1.8 + r * 1.2, (farZ + nearZ) / 2);
      group.add(st2);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(len + 24, 1.1), new THREE.MeshBasicMaterial({ map: crowd.clone() }));
      face.material.map.repeat.set((len + 24) / 18, 1);
      face.material.map.needsUpdate = true;
      face.rotation.y = -sx * Math.PI / 2;
      face.position.set(sx * (sideX + 0.6 + r * 2.4) - sx * 0.02, 1.8 + r * 1.2, (farZ + nearZ) / 2);
      group.add(face);
    }
  }
  const endWidth = width + 12;
  for (const [z, color] of [[farZ, 0x17171c], [nearZ, 0xf5511e]]) {
    group.add(slab(endWidth + 8, 1.6, 0.6, lambert(color), 0, 0.8, z));
  }
  for (const sx of [-1, 1]) {
    for (const z of [-6, 10]) {
      group.add(slab(0.5, 0.12, 4, lambert(0x8a8f9c), sx * (FIELD.maxX + 2.2), 0.5, z));
      group.add(slab(0.5, 0.5, 0.12, lambert(0x5a606e), sx * (FIELD.maxX + 2.4), 0.8, z - 1.8));
    }
  }

  const grassMats = [grassA, grassB, outside];
  const base = grassMats.map((m) => m.color.getHex());
  const sick = new THREE.Color(0x56731f);
  const setZombieSky = (on) => grassMats.forEach((m, i) => { m.color.setHex(base[i]); if (on) m.color.lerp(sick, 0.35); });
  return { group, setZombieSky };
}

export function buildCooler() {
  const g = new THREE.Group();
  g.add(slab(1.5, 0.9, 0.95, 0xf5511e, 0, 0.45, 0));
  g.add(slab(1.6, 0.18, 1.05, 0xf4f4f4, 0, 0.98, 0));
  g.add(slab(0.6, 0.1, 0.1, 0x111111, 0, 1.12, 0));
  const label = textPlane('WATER', 1.1, 0.34, '#ffffff', '#1d6fb8');
  label.position.set(0, 0.5, 0.48);
  g.add(label);
  const ring = new THREE.Mesh(new THREE.RingGeometry(BLITZ.coolerRadius - 0.18, BLITZ.coolerRadius, 40), new THREE.MeshBasicMaterial({ color: 0x4fd3ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  g.add(ring);
  return g;
}

export function buildPickup(kind) {
  const g = new THREE.Group();
  const spot = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.65, 20), new THREE.MeshBasicMaterial({ color: 0xffe14f, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
  spot.rotation.x = -Math.PI / 2;
  spot.position.y = 0.04;
  g.add(spot);
  const item = new THREE.Group();
  if (kind === 'gun') {
    item.add(slab(0.55, 0.22, 0.2, 0x1d9bf0, 0, 0, 0));
    item.add(slab(0.3, 0.1, 0.1, 0x1d9bf0, 0.38, 0.03, 0));
    item.add(slab(0.14, 0.26, 0.14, 0xf4f4f4, -0.1, 0.18, 0));
    item.add(slab(0.14, 0.2, 0.12, 0xffe14f, -0.18, -0.18, 0));
  } else {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), lambert(0xff4d6d));
    b.scale.set(1, 1.15, 1);
    item.add(b);
    item.add(slab(0.03, 0.3, 0.03, 0xf4f4f4, 0, -0.42, 0));
  }
  item.position.y = 0.9;
  item.scale.setScalar(1.5);
  g.add(item);
  g.userData.item = item;
  return g;
}

export function buildSoakBeam() {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: 0x7fdcff, transparent: true, opacity: 0.6, depthWrite: false });
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.2, 1, 8, 1, true), m);
  stream.rotation.x = Math.PI / 2;
  stream.position.z = 0.5;
  g.add(stream);
  const drops = [];
  for (let i = 0; i < 6; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), m);
    g.add(d);
    drops.push(d);
  }
  g.userData.stream = stream;
  g.userData.drops = drops;
  g.userData.set = (length, t) => {
    stream.scale.set(1, length, 1);
    stream.position.z = length / 2;
    drops.forEach((d, i) => { d.position.set(Math.sin(t * 9 + i) * 0.12, Math.cos(t * 7 + i * 2) * 0.1, ((t * 6 + i / drops.length) % 1) * length); });
  };
  g.visible = false;
  return g;
}

export function buildBalloon() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), lambert(0xff4d6d));
  b.scale.set(1, 1.15, 1);
  g.add(b);
  g.add(slab(0.04, 0.2, 0.04, 0xf4f4f4, 0, -0.38, 0));
  return g;
}
