import * as THREE from 'three';
import { box } from './characters.js';

export const BEL_CAST = [
  { id: 'dj', name: 'Marshmallow DJ' },
  { id: 'grinch', name: 'The Grinch' },
  { id: 'bee', name: 'Buzz the Bee' },
  { id: 'beegrinch', name: 'Grinch in Bee Suit' },
  { id: 'pearson', name: 'Pearson (Basketball)' },
  { id: 'alpink', name: 'Alpink' },
  { id: 'ezra', name: 'Ezra' },
  { id: 'coach', name: 'Coach Adam' },
  { id: 'teacher', name: 'Mr. Wesley' },
];

const YELLOW = 0xffc928, BLACK = 0x1c1c1c;
const LIFT = 0.26;
const mat = (color) => {
  const m = new THREE.MeshPhongMaterial({ color, shininess: 40, specular: 0x444444 });
  m.emissive.set(color).multiplyScalar(LIFT);
  return m;
};
const rb = (r, ...a) => box(...a, undefined, r);
const pivot = (x, y, z, ...kids) => {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  kids.forEach((c) => g.add(c));
  return g;
};
const capsule = (radius, length, color, x, y, z) => {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 8, 16), mat(color));
  m.position.set(x, y, z);
  return m;
};
const ball = (radius, color, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), mat(color));
  m.position.set(x, y, z);
  return m;
};
const cyl = (rt, rb2, h, color, x, y, z) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb2, h, 20), mat(color));
  m.position.set(x, y, z);
  return m;
};
const onSphere = (R, theta, phi) => new THREE.Vector3(R * Math.sin(theta) * Math.cos(phi), R * Math.cos(theta), R * Math.sin(theta) * Math.sin(phi));

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function textPlane(w, h, draw, px = 256) {
  const tex = canvasTex(px, Math.round(px * h / w), draw);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
}
function numberPatch(text, color, w = 0.3, h = 0.26) {
  return textPlane(w, h, (g, cw, ch) => {
    g.font = `900 ${Math.round(ch * 0.95)}px Arial Black, Impact, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.fillText(text, cw / 2, ch / 2);
  });
}

const css = (hex) => '#' + hex.toString(16).padStart(6, '0');

function mouthPath(g, kind, cx, cy, tilt = 0) {
  g.beginPath();
  if (kind === 'smirk') {
    g.moveTo(cx - 84, cy + 4 - tilt);
    g.quadraticCurveTo(cx - 10, cy + 6, cx + 86, cy - 30 - tilt * 0.4);
    g.quadraticCurveTo(cx + 70, cy + 52, cx - 8, cy + 60);
    g.quadraticCurveTo(cx - 70, cy + 52, cx - 84, cy + 4 - tilt);
  } else {
    g.moveTo(cx - 80, cy);
    g.quadraticCurveTo(cx, cy + 6, cx + 80, cy);
    g.quadraticCurveTo(cx + 74, cy + 68, cx, cy + 74);
    g.quadraticCurveTo(cx - 74, cy + 68, cx - 80, cy);
  }
  g.closePath();
}

// o: iris, brow, angry, thickBrow, mouth ('grin'|'smirk'|'smile'), blush, patch, eyeWhite, slit, eyeY, mouthY, eyeScale
function faceTexture(o) {
  return canvasTex(512, 350, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    if (o.patch) {
      g.fillStyle = css(o.patch);
      g.beginPath();
      g.ellipse(w / 2, h * 0.55, w * 0.4, h * 0.44, 0, 0, Math.PI * 2);
      g.fill();
    }
    const ey = o.eyeY ?? 132, es = o.eyeScale ?? 1;
    for (const s of [-1, 1]) {
      const ex = w / 2 + s * 90;
      g.fillStyle = css(o.eyeWhite ?? 0xffffff);
      g.beginPath();
      g.ellipse(ex, ey, 40 * es, 50 * es, 0, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(30,20,20,.55)';
      g.stroke();
      const ix = ex - s * 3, iy = ey + 6 * es;
      g.fillStyle = css(o.iris);
      g.beginPath();
      g.ellipse(ix, iy, 29 * es, (o.slit ? 38 : 33) * es, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#0c0c10';
      g.beginPath();
      if (o.slit) g.ellipse(ix, iy, 7 * es, 33 * es, 0, 0, Math.PI * 2);
      else g.ellipse(ix, iy, 17 * es, 19 * es, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(ix + 10 * es, iy - 14 * es, 8 * es, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(ix - 9 * es, iy + 12 * es, 4 * es, 0, Math.PI * 2);
      g.fill();
      if (o.lid) {
        g.save();
        g.beginPath();
        g.ellipse(ex, ey, 40 * es, 50 * es, 0, 0, Math.PI * 2);
        g.clip();
        g.fillStyle = css(o.lid);
        g.fillRect(ex - 50, ey - 60, 100, 60 * es + 4);
        g.restore();
        g.strokeStyle = 'rgba(20,50,10,.8)';
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(ex - 40 * es, ey + 2 * es);
        g.lineTo(ex + 40 * es, ey + 2 * es);
        g.stroke();
      }
      g.strokeStyle = css(o.brow ?? 0x2a1a10);
      g.lineCap = 'round';
      g.lineWidth = o.thickBrow ? 20 : 13;
      g.beginPath();
      const by = ey - 66 * es;
      if (o.angry) {
        g.moveTo(ex + s * 50, by - 14);
        g.lineTo(ex - s * 44, by + 22);
      } else {
        g.moveTo(ex - 44, by + 8);
        g.quadraticCurveTo(ex, by - 14, ex + 44, by + 8);
      }
      g.stroke();
    }
    g.fillStyle = 'rgba(70,30,10,.16)';
    g.beginPath();
    g.ellipse(w / 2, ey + 76, 20, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.22)';
    g.beginPath();
    g.ellipse(w / 2 - 4, ey + 70, 8, 5, 0, 0, Math.PI * 2);
    g.fill();
    if (o.blush) {
      g.fillStyle = 'rgba(255,90,100,.34)';
      for (const s of [-1, 1]) {
        g.beginPath();
        g.ellipse(w / 2 + s * 160, ey + 96, 34, 20, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    const my = o.mouthY ?? 232;
    if (o.mouth === 'grin' || o.mouth === 'smirk') {
      const tilt = o.mouth === 'smirk' ? 16 : 0;
      mouthPath(g, o.mouth, w / 2, my, tilt);
      g.save();
      g.clip();
      g.fillStyle = '#5b1212';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffffff';
      g.fillRect(0, my - 40, w, o.mouth === 'smirk' ? 54 : 44);
      g.fillStyle = '#e8737f';
      g.beginPath();
      g.ellipse(w / 2 + 6, my + 70, 44, 24, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      mouthPath(g, o.mouth, w / 2, my, tilt);
      g.strokeStyle = 'rgba(60,20,20,.9)';
      g.lineWidth = 6;
      g.stroke();
    } else if (o.mouth === 'smile') {
      g.strokeStyle = '#4a1b1b';
      g.lineWidth = 11;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(w / 2 - 70, my);
      g.quadraticCurveTo(w / 2, my + 56, w / 2 + 70, my);
      g.stroke();
    }
  });
}

const FACE_PHI = 1.6, FACE_THETA = 1.12;
function headGroup({ R, skin, face, scaleY = 1, ears = true }) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.set(1, scaleY, 0.97);
  const sk = new THREE.Mesh(new THREE.SphereGeometry(R, 36, 28), mat(skin));
  const patch = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.012, 32, 20, Math.PI / 2 - FACE_PHI / 2, FACE_PHI, Math.PI / 2 - 0.48, FACE_THETA),
    new THREE.MeshBasicMaterial({ map: face, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  inner.add(sk, patch);
  if (ears) {
    for (const s of [-1, 1]) {
      const ear = ball(R * 0.17, skin, s * R * 0.96, -R * 0.06, 0);
      ear.scale.set(0.5, 1, 0.8);
      inner.add(ear);
    }
  }
  g.add(inner);
  return g;
}

function hairCap(R, color, { tilt = -0.32, thetaMax = 1.42 } = {}) {
  const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.05, 32, 20, 0, Math.PI * 2, 0, thetaMax), mat(color));
  const g = pivot(0, 0, -R * 0.02, cap);
  g.rotation.x = tilt;
  return g;
}
function hairCurls(R, color, size, rings) {
  const g = new THREE.Group();
  rings.forEach(({ theta, n, backOnly, off = 0 }, k) => {
    for (let i = 0; i < n; i++) {
      const phi = off + (i / n) * Math.PI * 2;
      if (backOnly && Math.sin(phi) > -0.15) continue;
      const p = onSphere(R * 1.04, theta, phi);
      g.add(ball(size * (1 - k * 0.05), color, p.x, p.y, p.z));
    }
  });
  g.add(ball(size * 1.15, color, 0, R * 1.08, -R * 0.1));
  return g;
}

function rig(o) {
  const {
    skin, shirt, shorts, shoe, sock = 0xffffff, sole = 0xffffff, sleeve = 'short', legs = 'bare',
    torsoW = 0.64, torsoD = 0.42, R = 0.46, face, faceScaleY = 1, ears = true, armColor, headObj,
  } = o;
  const g = new THREE.Group();
  const body = rb(0.13, torsoW, 0.56, torsoD, shirt, 0, 0.8, 0);
  const hips = rb(0.1, torsoW - 0.04, 0.24, torsoD - 0.04, shorts, 0, 0.5, 0);
  const neck = cyl(0.12, 0.13, 0.12, skin, 0, 1.1, 0);
  const head = headObj ?? headGroup({ R, skin, face, scaleY: faceScaleY, ears });
  head.position.set(0, 1.12 + R * 0.88, 0);
  const armSkin = armColor ?? (sleeve === 'long' ? shirt : skin);
  const arm = (x) => pivot(x, 1.0, 0,
    capsule(0.125, 0.04, shirt, 0, -0.06, 0),
    capsule(0.088, sleeve === 'long' ? 0.2 : 0.14, armSkin, 0, -0.27, 0),
    ball(0.1, skin, 0, -0.5, 0.01));
  const legColor = legs === 'bare' ? skin : shorts;
  const leg = (x) => pivot(x, 0.46, 0,
    capsule(0.105, 0.1, legColor, 0, -0.12, 0),
    cyl(0.085, 0.09, 0.14, sock, 0, -0.26, 0),
    rb(0.07, 0.23, 0.14, 0.36, shoe, 0, -0.38, 0.06),
    rb(0.02, 0.235, 0.04, 0.37, sole, 0, -0.45, 0.06));
  const armL = arm(-torsoW / 2 - 0.1), armR = arm(torsoW / 2 + 0.1), legL = leg(-0.16), legR = leg(0.16);
  g.add(body, hips, neck, head, armL, armR, legL, legR);
  g.userData.parts = { head, armL, armR, legL, legR, body };
  return { g, body, hips, head, armL, armR, legL, legR, R };
}

function jerseyTrim(body, trim, torsoW = 0.64) {
  for (const s of [-1, 1]) body.add(rb(0.02, 0.05, 0.5, 0.4, trim, s * (torsoW / 2 - 0.01), 0, 0));
  body.add(rb(0.03, 0.34, 0.07, 0.3, trim, 0, 0.27, 0.02));
}
function shortsStripe(hips, color) {
  for (const s of [-1, 1]) hips.add(rb(0.015, 0.04, 0.22, 0.32, color, s * 0.28, 0, 0));
}

function buildPearson() {
  const face = faceTexture({ iris: 0x3a79a6, brow: 0x4a2f1a, mouth: 'grin', blush: true });
  const r = rig({ skin: 0xf3c4a0, shirt: YELLOW, shorts: BLACK, shoe: BLACK, sole: YELLOW, face, R: 0.47, torsoW: 0.6 });
  const { g, body, hips, head, armR } = r;
  jerseyTrim(body, BLACK, 0.6);
  shortsStripe(hips, YELLOW);
  const num = numberPatch('8', css(BLACK), 0.26, 0.28);
  num.position.set(0, -0.03, 0.215);
  body.add(num);
  const hairC = 0x6a4224;
  head.add(hairCap(r.R, hairC));
  head.add(hairCurls(r.R, hairC, 0.115, [{ theta: 0.3, n: 5 }, { theta: 0.62, n: 9 }, { theta: 0.95, n: 13, off: 0.2 }, { theta: 1.3, n: 11, backOnly: true }]));
  const bb = ball(0.2, 0xe8731a, 0.03, -0.62, 0.2);
  for (const [rx, ry] of [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.013, 6, 32), new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
    ring.rotation.set(rx, ry, 0);
    bb.add(ring);
  }
  armR.add(bb);
  g.scale.setScalar(0.95);
  return g;
}

function buildAlpink() {
  const suit = 0xf48fb1, deep = 0xe9669c, hairC = 0xe0206e;
  const face = faceTexture({ iris: 0x2f8a92, brow: 0x9c1450, mouth: 'grin', blush: true });
  const r = rig({ skin: 0xf6c7a5, shirt: suit, shorts: suit, shoe: 0xd94b86, sole: 0xffffff, sleeve: 'long', legs: 'suit', sock: 0xffd6e4, face, R: 0.47, torsoW: 0.6 });
  const { g, body, head, armR } = r;
  body.add(rb(0.05, 0.28, 0.42, 0.04, deep, 0, -0.04, 0.2));
  body.add(rb(0.03, 0.16, 0.26, 0.04, 0xffe1ec, 0, 0.2, 0.21));
  for (const by of [0.06, -0.08, -0.22]) body.add(ball(0.025, 0x9c1450, 0, by, 0.235));
  for (const s of [-1, 1]) {
    const lap = rb(0.02, 0.1, 0.3, 0.04, 0xf9a8c6, s * 0.14, 0.2, 0.2);
    lap.rotation.z = s * 0.55;
    body.add(lap);
  }
  body.add(pivot(0, 0.3, 0.225, rb(0.03, 0.14, 0.1, 0.05, 0xff4f9a, -0.1, 0, 0), rb(0.03, 0.14, 0.1, 0.05, 0xff4f9a, 0.1, 0, 0),
    rb(0.02, 0.07, 0.08, 0.06, 0xd81b60, 0, 0, 0.01)));
  head.add(hairCap(r.R, hairC));
  head.add(hairCurls(r.R, hairC, 0.125, [{ theta: 0.3, n: 5 }, { theta: 0.62, n: 10 }, { theta: 0.95, n: 14, off: 0.2 }, { theta: 1.28, n: 12, backOnly: true }]));
  const rose = pivot(0.04, -0.52, 0.16, ball(0.075, 0xe91e63, 0, 0.03, 0), ball(0.05, 0xf06292, 0, 0.07, 0.03),
    rb(0.012, 0.025, 0.16, 0.025, 0x2e7d32, 0, -0.1, 0));
  armR.add(rose);
  armR.rotation.x = -0.15;
  g.scale.setScalar(0.95);
  return g;
}

function buildEzra() {
  const face = faceTexture({ iris: 0x6b4a2a, brow: 0x5a3a1c, mouth: 'smirk', blush: true });
  const r = rig({ skin: 0xf0b48a, shirt: 0xd32f2f, shorts: 0xcdb892, shoe: 0xeceef2, sole: 0xe57373, sock: 0x607d8b, face, R: 0.47, torsoW: 0.58 });
  const { g, body, head, armR } = r;
  for (const s of [-1, 1]) {
    const flap = rb(0.02, 0.2, 0.08, 0.04, 0xb71c1c, s * 0.09, 0.28, 0.2);
    flap.rotation.z = -s * 0.55;
    body.add(flap);
  }
  body.add(rb(0.02, 0.04, 0.16, 0.03, 0xe05555, 0, 0.18, 0.215));
  body.add(ball(0.03, 0x7a1313, 0.17, 0.12, 0.215));
  const hairC = 0x8a5a33;
  head.add(hairCap(r.R, hairC, { tilt: -0.22, thetaMax: 1.38 }));
  head.add(hairCurls(r.R, hairC, 0.1, [{ theta: 0.35, n: 5 }, { theta: 0.75, n: 9 }, { theta: 1.1, n: 8, backOnly: true }]));
  const club = pivot(0.02, -0.5, 0.1);
  club.add(cyl(0.017, 0.017, 1.05, 0x1e88e5, 0, -0.18, 0), rb(0.025, 0.14, 0.07, 0.34, 0x1565c0, 0, -0.74, 0.12),
    cyl(0.03, 0.03, 0.22, 0x111111, 0, 0.26, 0));
  club.rotation.set(0.3, 0, 0.1);
  armR.add(club);
  armR.rotation.x = -0.25;
  g.add(ball(0.06, 0xffffff, 0.6, 0.06, 0.6));
  g.scale.setScalar(0.95);
  return g;
}

function buildCoach() {
  const face = faceTexture({ iris: 0x3c6e96, brow: 0x2d1c12, mouth: 'grin', thickBrow: true, mouthY: 236 });
  const r = rig({ skin: 0xeab088, shirt: BLACK, shorts: BLACK, shoe: 0xf6f6f6, sole: YELLOW, face, R: 0.48, torsoW: 0.74, torsoD: 0.46 });
  const { g, body, hips, head } = r;
  jerseyTrim(body, YELLOW, 0.74);
  shortsStripe(hips, YELLOW);
  const num = numberPatch('23', css(YELLOW), 0.36, 0.26);
  num.position.set(0, -0.05, 0.235);
  body.add(num);
  body.add(rb(0.015, 0.025, 0.4, 0.02, 0x2a2a2a, 0, 0.14, 0.235));
  body.add(rb(0.03, 0.09, 0.06, 0.05, 0xffc107, 0, 0.0, 0.26));
  const hairC = 0x33241a, beardC = 0x4a2f1c;
  head.add(hairCap(r.R, hairC, { tilt: -0.3, thetaMax: 1.12 }));
  head.add(new THREE.Mesh(new THREE.SphereGeometry(r.R * 1.025, 36, 20, Math.PI / 2 - 1.15, 2.3, 2.12, 0.6), mat(beardC)));
  g.scale.setScalar(1.12);
  return g;
}

function buildTeacher() {
  const beardC = 0x16110e;
  const face = faceTexture({ iris: 0x3b2314, brow: 0x16110e, mouth: 'grin', thickBrow: true, mouthY: 252 });
  const r = rig({ skin: 0xe3a27a, shirt: YELLOW, shorts: BLACK, shoe: BLACK, sole: 0xf2f2f2, sock: BLACK, legs: 'suit', face, R: 0.48, torsoW: 0.72, torsoD: 0.44 });
  const { g, body, head } = r;
  for (const s of [-1, 1]) {
    const collar = rb(0.02, 0.14, 0.1, 0.05, 0xffd95a, s * 0.08, 0.29, 0.215);
    collar.rotation.z = -s * 0.5;
    body.add(collar);
  }
  body.add(rb(0.03, 0.08, 0.08, 0.04, BLACK, 0, 0.26, 0.23));
  body.add(rb(0.02, 0.09, 0.38, 0.03, BLACK, 0, 0.07, 0.232));
  for (const y of [0.17, -0.02, -0.17]) body.add(ball(0.022, 0xc99a14, 0, y, 0.235));
  body.add(rb(0.015, 0.02, 0.4, 0.015, 0xf2f2f2, -0.12, 0.02, 0.222));
  body.add(rb(0.015, 0.02, 0.4, 0.015, 0xf2f2f2, 0.12, 0.02, 0.222));
  body.add(rb(0.02, 0.16, 0.2, 0.025, 0xffffff, 0, -0.22, 0.236), rb(0.01, 0.06, 0.06, 0.03, BLACK, 0, -0.2, 0.25));
  head.add(new THREE.Mesh(new THREE.SphereGeometry(r.R * 1.03, 36, 20, Math.PI / 2 - 1.3, 2.6, 2.16, 0.7), mat(beardC)));
  const stache = ball(0.11, beardC, 0, 0, 0);
  stache.scale.set(1.35, 0.3, 0.5);
  const sp = onSphere(r.R * 1.0, 1.78, Math.PI / 2);
  stache.position.set(sp.x, sp.y, sp.z);
  head.add(stache);
  g.scale.setScalar(1.08);
  return g;
}

function buildDJ() {
  const face = canvasTex(512, 420, (g, w, h) => {
    g.strokeStyle = '#111111';
    g.lineCap = 'round';
    g.lineWidth = 36;
    for (const x of [w * 0.28, w * 0.72]) {
      g.beginPath();
      g.moveTo(x - 52, h * 0.1);
      g.lineTo(x + 52, h * 0.42);
      g.moveTo(x + 52, h * 0.1);
      g.lineTo(x - 52, h * 0.42);
      g.stroke();
    }
    g.lineWidth = 30;
    g.beginPath();
    g.moveTo(w * 0.17, h * 0.62);
    g.quadraticCurveTo(w * 0.5, h * 1.08, w * 0.83, h * 0.62);
    g.stroke();
    g.lineWidth = 22;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(w / 2 + s * w * 0.35, h * 0.56);
      g.lineTo(w / 2 + s * w * 0.35, h * 0.7);
      g.stroke();
    }
  });
  const helmet = new THREE.Group();
  helmet.add(box(0.94, 0.92, 0.9, 0xfafafa, 0, 0, 0, mat(0xfafafa), 0.18));
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.51), new THREE.MeshBasicMaterial({ map: face, transparent: true }));
  plane.position.set(0, -0.02, 0.456);
  helmet.add(plane);
  const r = rig({ skin: 0xfafafa, shirt: 0xf6f6f8, shorts: 0xf0f1f5, shoe: 0xffffff, sole: 0xd9dde6, sleeve: 'long', legs: 'suit', sock: 0xffffff, R: 0.5, headObj: helmet, torsoW: 0.74, torsoD: 0.5, armColor: 0xf6f6f8 });
  const { g, body, hips, armL, armR } = r;
  body.material = mat(0xf6f6f8);
  hips.material = mat(0xf0f1f5);
  body.add(rb(0.16, 0.6, 0.3, 0.3, 0xf6f6f8, 0, 0.3, -0.2));
  body.add(rb(0.08, 0.5, 0.2, 0.06, 0xe6e8ef, 0, -0.14, 0.255));
  const mark = canvasTex(256, 200, (c, w, h) => {
    c.strokeStyle = '#111';
    c.lineCap = 'round';
    c.lineWidth = 16;
    for (const x of [w * 0.28, w * 0.72]) {
      c.beginPath();
      c.moveTo(x - 24, h * 0.1);
      c.lineTo(x + 24, h * 0.42);
      c.moveTo(x + 24, h * 0.1);
      c.lineTo(x - 24, h * 0.42);
      c.stroke();
    }
    c.lineWidth = 14;
    c.beginPath();
    c.moveTo(w * 0.2, h * 0.62);
    c.quadraticCurveTo(w * 0.5, h * 1.0, w * 0.8, h * 0.62);
    c.stroke();
  });
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.133), new THREE.MeshBasicMaterial({ map: mark, transparent: true }));
  logo.position.set(0, 0.16, 0.256);
  body.add(logo);
  for (const s of [-1, 1]) {
    body.add(cyl(0.011, 0.011, 0.22, 0xffffff, s * 0.07, 0.15, 0.262), ball(0.022, 0xffffff, s * 0.07, 0.03, 0.262));
  }
  const pack = rb(0.1, 0.5, 0.56, 0.22, 0xffffff, 0, 0.0, -0.37);
  pack.add(rb(0.05, 0.36, 0.2, 0.05, 0xe6e8ef, 0, -0.1, -0.12));
  body.add(pack);
  for (const s of [-1, 1]) body.add(rb(0.02, 0.07, 0.5, 0.04, 0xdcdfe6, s * 0.22, 0.02, 0.255));
  const deck = pivot(0, -0.14, 0.4, rb(0.04, 0.6, 0.06, 0.36, 0x1b1b22, 0, 0, 0));
  const padCols = [0xff4d4d, 0xffa726, 0xffee58, 0x66bb6a, 0x29b6f6, 0xab47bc];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) deck.add(rb(0.01, 0.075, 0.015, 0.075, padCols[(i + j * 2) % 6], -0.2 + i * 0.133, 0.04, -0.1 + j * 0.1));
  for (const s of [-1, 1]) deck.add(cyl(0.05, 0.05, 0.03, 0xdddddd, s * 0.2, 0.04, 0.13));
  deck.rotation.x = 1.05;
  body.add(deck);
  armL.rotation.x = -0.2;
  armR.rotation.x = -0.2;
  g.scale.setScalar(0.95);
  return g;
}

function grinchFace(bee) {
  return faceTexture({
    iris: bee ? 0x39b54a : 0xc62828, eyeWhite: bee ? 0xffffff : 0xf3e65a, brow: bee ? 0x14501c : 0x2e5a1f, angry: true, lid: 0x5aa83a,
    slit: !bee, mouth: 'smirk', patch: bee ? 0x6dbf45 : undefined, thickBrow: true, eyeScale: 0.95, mouthY: 236,
  });
}

function bellyPatch(body, color) {
  const b = ball(0.27, color, 0, -0.05, 0.1);
  b.scale.set(1, 1.1, 0.5);
  body.add(b);
}

function buildGrinch() {
  const green = 0x6dbf45, dark = 0x4a8f2f, fur = 0x5aa83a;
  const r = rig({ skin: green, shirt: green, shorts: dark, shoe: dark, sole: 0x3a6f24, sleeve: 'long', legs: 'suit', sock: dark, face: grinchFace(false), R: 0.5, faceScaleY: 1.22, ears: false, torsoW: 0.62, torsoD: 0.44, armColor: green });
  const { g, body, head, armL, armR } = r;
  const belly = ball(0.27, 0xcfe18a, 0, -0.08, 0.1);
  belly.scale.set(1.0, 1.05, 0.6);
  body.add(belly);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 14), mat(green));
    ear.position.set(s * 0.48, 0.3, 0);
    ear.rotation.z = -s * 0.75;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 12), mat(0xe58a8a));
    inner.position.set(s * 0.48, 0.29, 0.04);
    inner.rotation.z = -s * 0.75;
    head.add(ear, inner);
  }
  for (const [x, y, z] of [[0, 0.6, 0], [-0.12, 0.58, 0.02], [0.12, 0.58, 0.02], [-0.06, 0.57, -0.1], [0.07, 0.57, -0.1], [0, 0.55, 0.1]]) head.add(ball(0.075, fur, x, y, z));
  for (const a of [armL, armR]) for (const y of [-0.2, -0.3, -0.4]) a.add(ball(0.05, fur, 0, y, 0.07));
  g.scale.setScalar(1.08);
  return g;
}

function buildBee(grinch) {
  const green = 0x6dbf45;
  const face = grinch
    ? faceTexture({ iris: 0x8a9a1a, eyeWhite: 0xf0e668, brow: 0x14501c, angry: true, thickBrow: true, mouth: 'smirk', eyeScale: 0.95, mouthY: 236 })
    : faceTexture({ iris: 0x151515, brow: 0x1b1b1b, mouth: 'smile', blush: true, eyeScale: 0.9, mouthY: 236 });
  const R = 0.5, sy = grinch ? 1.1 : 1;
  const r = rig({ skin: grinch ? green : 0xffe3b0, shirt: YELLOW, shorts: YELLOW, shoe: BLACK, sole: BLACK, sleeve: 'long', legs: 'suit', sock: YELLOW, face, R, faceScaleY: sy, ears: false, torsoW: 0.7, torsoD: 0.5, armColor: YELLOW });
  const { g, body, head, armL, armR, legL, legR } = r;
  for (const y of [0.21, -0.21]) body.add(rb(0.03, 0.74, 0.08, 0.54, BLACK, 0, y, 0));
  const badge = textPlane(0.4, 0.3, (c, w, h) => {
    c.fillStyle = '#fff3c4';
    c.strokeStyle = '#111';
    c.lineWidth = 12;
    c.beginPath();
    c.roundRect(8, 8, w - 16, h - 16, 40);
    c.fill();
    c.stroke();
    c.fillStyle = '#111';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `900 ${Math.round(h * 0.3)}px Arial Black, Impact, sans-serif`;
    c.fillText('BUZZ', w / 2, h * 0.34);
    c.fillText('BEES!', w / 2, h * 0.68);
  }, 384);
  badge.position.set(0, 0, 0.256);
  body.add(badge);
  g.add(rb(0.02, 0.72, 0.07, 0.52, BLACK, 0, 0.53, 0));
  const buckle = cyl(0.07, 0.07, 0.025, YELLOW, 0, 0.53, 0.26);
  buckle.rotation.x = Math.PI / 2;
  g.add(buckle);
  for (const a of [armL, armR]) a.add(cyl(0.096, 0.096, 0.05, BLACK, 0, -0.22, 0), cyl(0.096, 0.096, 0.05, BLACK, 0, -0.35, 0));
  for (const l of [legL, legR]) {
    l.children[2].scale.set(1.2, 1, 1.15);
    l.children[3].scale.set(1.2, 1, 1.15);
    l.add(cyl(0.1, 0.1, 0.05, BLACK, 0, -0.18, 0));
  }
  const hm = mat(YELLOW);
  hm.side = THREE.DoubleSide;
  const hood = new THREE.Group();
  hood.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.1, 36, 24, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, 0, 2.0), hm));
  hood.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.1, 36, 16, 0, Math.PI * 2, 0, 1.1), hm));
  for (const t of [0.3, 0.6]) hood.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.116, 36, 4, 0, Math.PI * 2, t, 0.11), mat(BLACK)));
  const rimC = 0xffd95a, Rh = R * 1.1;
  for (let i = 0; i <= 14; i++) {
    const th = 1.1 + (i / 14) * 0.95;
    for (const phi of [Math.PI / 2 + 0.8, Math.PI / 2 - 0.8]) {
      const q = onSphere(Rh, th, phi);
      hood.add(ball(0.052, rimC, q.x, q.y, q.z));
    }
  }
  for (let i = 1; i < 16; i++) {
    const q = onSphere(Rh, 1.1, Math.PI / 2 - 0.8 + (i / 16) * 1.6);
    hood.add(ball(0.052, rimC, q.x, q.y, q.z));
  }
  hood.scale.set(1, sy, 0.97);
  head.add(hood);
  for (const s of [-1, 1]) {
    const ant = pivot(s * 0.2, R * 1.08 * sy, 0.02, cyl(0.02, 0.02, 0.32, BLACK, 0, 0.16, 0), ball(0.075, BLACK, 0, 0.34, 0));
    ant.rotation.z = -s * 0.35;
    head.add(ant);
  }
  g.scale.setScalar(1.0);
  return g;
}

export function buildBelCharacter(id) {
  switch (id) {
    case 'pearson': return buildPearson();
    case 'alpink': return buildAlpink();
    case 'ezra': return buildEzra();
    case 'coach': return buildCoach();
    case 'teacher': return buildTeacher();
    case 'dj': return buildDJ();
    case 'grinch': return buildGrinch();
    case 'bee': return buildBee(false);
    case 'beegrinch': return buildBee(true);
    default: throw new Error(`unknown Bel Air character: ${id}`);
  }
}
