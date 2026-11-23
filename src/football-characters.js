import * as THREE from 'three';
import { animateCharacter } from './characters.js';
import { mat, rb, pivot, ball, canvasTex, faceTexture, rig, jerseyTrim, shortsStripe, textPlane } from './bel-characters.js';

const R = 0.47;
const SHELL_R = R * 1.12;
const THETA_END = 1.95;
const OPEN = 0.78;
const ZOMBIE_SKIN = 0x92d65a;
const LIFT = 0.26;

const TEAMS = {
  bengals: {
    shirt: 0xf5511e, trim: 0x111111, pants: 0xf4f4f4, stripe: 0x111111, sock: 0xf5511e, sockRing: 0x111111,
    shoe: 0x151515, sole: 0xf5511e, glove: 0xf5511e, shell: '#f5511e', mask: 0x1b1b1b, numFill: '#111111', numLine: '#ffffff', flag: 0xffd21f,
  },
  steelers: {
    shirt: 0x17171c, trim: 0xffb612, pants: 0xd9a21b, stripe: 0x17171c, sock: 0x17171c, sockRing: 0xffb612,
    shoe: 0x111111, sole: 0xffb612, glove: 0xffb612, shell: '#17171c', mask: 0xc9ced6, numFill: '#ffb612', numLine: '#ffffff', flag: 0xff7a1f,
  },
};
const SKINS = [0xf3c4a0, 0xd9a073, 0x8d5a3a, 0xf0c8a8, 0xc68a5c, 0x6b4128, 0xe8b48a];
const IRIS = [0x3a79a6, 0x5a3a1c, 0x2f8a92, 0x4a6b2a, 0x6b4a2a];

const brow = (d) => 1.08 + 0.35 * (d / OPEN) ** 2;
const pt = (d, th, rad) => new THREE.Vector3(rad * Math.sin(th) * Math.sin(d), rad * Math.cos(th), rad * Math.sin(th) * Math.cos(d));
const cache = {};
const once = (k, f) => (cache[k] ??= f());
const lodCache = new Map();
const markShared = (obj) => { obj.userData.shared = true; return obj; };
const shrinkGeo = (geo) => {
  const p = geo.parameters;
  const half = (n, lo) => Math.max(lo, Math.ceil(n * 0.5));
  let build = null;
  switch (geo.type) {
    case 'SphereGeometry':
      if (p.widthSegments > 16) build = () => new THREE.SphereGeometry(p.radius, half(p.widthSegments, 10), half(p.heightSegments, 7), p.phiStart, p.phiLength, p.thetaStart, p.thetaLength);
      break;
    case 'CapsuleGeometry':
      build = () => new THREE.CapsuleGeometry(p.radius, p.length, Math.max(2, Math.ceil(p.capSegments / 2)), half(p.radialSegments, 8));
      break;
    case 'TorusGeometry':
      build = () => new THREE.TorusGeometry(p.radius, p.tube, 4, 12, p.arc);
      break;
    case 'TubeGeometry':
      build = () => new THREE.TubeGeometry(p.path, Math.max(4, Math.ceil(p.tubularSegments / 2)), p.radius, 3, p.closed);
      break;
    case 'CylinderGeometry':
      build = () => new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, half(p.radialSegments, 8), p.heightSegments, p.openEnded);
      break;
    default:
  }
  if (!build) return geo;
  const key = geo.type === 'TubeGeometry' ? geo.uuid : geo.type + JSON.stringify(p);
  if (!lodCache.has(key)) lodCache.set(key, markShared(build()));
  return lodCache.get(key);
};
const shrinkPlayer = (g) => {
  g.traverse((o) => { if (o.isMesh && o !== g.userData.shell) o.geometry = shrinkGeo(o.geometry); });
};
const tube = (pts, rad, radial = 5) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, rad, radial);
const seeded = (n) => () => ((n = (n * 16807) % 2147483647) / 2147483647);
const tint = (mesh, hex) => {
  mesh.material.color.set(hex);
  if (mesh.material.emissive) mesh.material.emissive.set(hex).multiplyScalar(LIFT);
};

const helmetGeo = (lod) => once(lod ? 'helmet-lod' : 'helmet', () => {
  const g = lod
    ? new THREE.SphereGeometry(SHELL_R, 28, 16, 0, Math.PI * 2, 0, THETA_END)
    : new THREE.SphereGeometry(SHELL_R, 56, 32, 0, Math.PI * 2, 0, THETA_END);
  const pos = g.attributes.position, idx = g.index.array, keep = [];
  const v = new THREE.Vector3();
  const isIn = new Uint8Array(pos.count);
  for (let n = 0; n < pos.count; n++) {
    v.fromBufferAttribute(pos, n);
    const az = Math.atan2(v.x, v.z), d = Math.abs(az), th = Math.acos(v.y / v.length());
    if (d >= OPEN || th <= brow(d)) continue;
    isIn[n] = 1;
    const edgeTh = brow(d), toBrow = th - edgeTh, toSide = OPEN - d;
    let nth = th, naz = az;
    if (toBrow <= toSide) nth = edgeTh;
    else naz = Math.sign(az || 1) * OPEN;
    pos.setXYZ(n, SHELL_R * Math.sin(nth) * Math.sin(naz), SHELL_R * Math.cos(nth), SHELL_R * Math.sin(nth) * Math.cos(naz));
  }
  for (let i = 0; i < idx.length; i += 3) {
    if (isIn[idx[i]] && isIn[idx[i + 1]] && isIn[idx[i + 2]]) continue;
    keep.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  g.setIndex(keep);
  return markShared(g);
});

const trimGeos = () => once('trim', () => {
  const r = SHELL_R + 0.004;
  const front = [];
  for (let th = THETA_END; th >= brow(OPEN); th -= 0.08) front.push(pt(-OPEN, th, r));
  for (let d = -OPEN; d <= OPEN; d += 0.08) front.push(pt(d, brow(d), r));
  for (let th = brow(OPEN); th <= THETA_END; th += 0.08) front.push(pt(OPEN, th, r));
  const back = [];
  for (let a = OPEN; a <= Math.PI * 2 - OPEN + 1e-6; a += 0.1) back.push(pt(a, THETA_END, r));
  return [tube(front, 0.018), tube(back, 0.018)].map(markShared);
});

const maskGeos = () => once('mask', () => {
  const r0 = SHELL_R, bar = (th, y) => {
    const pts = [];
    for (let d = -OPEN; d <= OPEN + 1e-6; d += 0.13) pts.push(pt(d, th, r0 + y * (1 - (d / OPEN) ** 2)));
    return tube(pts, 0.016, 4);
  };
  const cup = [];
  for (const [d, th, lift] of [[-OPEN, 1.95, 0], [-0.66, 2.08, 0.04], [-0.36, 2.2, 0.075], [0, 2.26, 0.09], [0.36, 2.2, 0.075], [0.66, 2.08, 0.04], [OPEN, 1.95, 0]]) cup.push(pt(d, th, r0 + lift));
  const post = (s) => tube([pt(s * 0.36, 1.7, r0 + 0.045), pt(s * 0.36, 1.96, r0 + 0.065), pt(s * 0.36, 2.2, r0 + 0.075)], 0.015, 4);
  return [bar(1.7, 0.06), tube(cup, 0.016, 4), post(-1), post(1)].map(markShared);
});

function star(g, cx, cy, s, color) {
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * Math.PI * 2;
    const x = cx + s * Math.cos(t) ** 3, y = cy + s * Math.sin(t) ** 3;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
}

function helmetTex(team, zombie) {
  return once(`ht-${team}-${zombie}`, () => markShared(canvasTex(1024, 512, (g, W, H) => {
    g.fillStyle = TEAMS[team].shell;
    g.fillRect(0, 0, W, H);
    if (team === 'bengals') {
      g.fillStyle = '#0d0d0d';
      for (const cx of [0, 512, 1024]) {
        for (let k = -2; k <= 2; k++) {
          const x0 = cx + k * 58, y0 = 26, y1 = 250 + (2 - Math.abs(k)) * 42, bend = k * 12;
          g.beginPath();
          g.moveTo(x0 - 18, y0);
          g.quadraticCurveTo(x0 + bend - 8, (y0 + y1) / 2, x0 + bend * 1.6, y1);
          g.quadraticCurveTo(x0 + bend + 8, (y0 + y1) / 2, x0 + 18, y0);
          g.closePath();
          g.fill();
        }
      }
      g.fillRect(0, 0, W, 22);
    } else {
      g.fillStyle = '#ffb612';
      for (const [cx, yEnd] of [[256, 300], [768, H]]) {
        for (let y = 0; y < yEnd; y++) {
          const th = Math.max(0.05, (y / H) * THETA_END);
          const hw = Math.min(150, 12 / Math.sin(th));
          g.fillRect(cx - hw, y, hw * 2, 1);
        }
      }
      for (const cx of [0, 512, 1024]) {
        star(g, cx - 32, 226, 28, '#ffc928');
        star(g, cx + 32, 226, 28, '#e8402a');
        star(g, cx, 282, 28, '#3a9bff');
      }
    }
    if (zombie) {
      const rnd = seeded(team === 'bengals' ? 11 : 29);
      g.lineCap = 'round';
      for (let i = 0; i < 16; i++) {
        const x = rnd() * W, y = 30 + rnd() * 360, a = rnd() * Math.PI, len = 30 + rnd() * 60;
        g.strokeStyle = i % 2 ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.5)';
        g.lineWidth = 2 + rnd() * 3;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        g.stroke();
      }
      g.fillStyle = '#8ee36a';
      for (let j = 0; j < 8; j++) {
        const x = 256 - 150 + j * 43 + rnd() * 10, len = 16 + rnd() * 46;
        g.fillRect(x - 7, 262, 14, len);
        g.beginPath();
        g.arc(x, 262 + len, 9, 0, Math.PI * 2);
        g.fill();
      }
      g.fillRect(256 - 170, 248, 340, 20);
      for (let j = 0; j < 7; j++) {
        g.beginPath();
        g.arc(rnd() * W, 40 + rnd() * 320, 5 + rnd() * 9, 0, Math.PI * 2);
        g.fill();
      }
    }
  })));
}

function normalFace(s, T) {
  const o = {
    iris: IRIS[s.variant % IRIS.length], brow: 0x2a1a10, mouth: s.team === 'steelers' ? 'smirk' : 'grin',
    blush: s.team === 'bengals', angry: s.team === 'steelers', thickBrow: s.team === 'steelers',
  };
  if (s.hero) Object.assign(o, { iris: 0x3a79a6, brow: 0x4a2f1a, mouth: 'grin', blush: true });
  const tex = faceTexture(o);
  const g = tex.image.getContext('2d');
  g.fillStyle = 'rgba(15,15,15,.78)';
  for (const sd of [-1, 1]) g.fillRect(256 + sd * 90 - 36, 190, 72, 13);
  tex.needsUpdate = true;
  return tex;
}

function zombieFace() {
  return canvasTex(512, 350, (g, w) => {
    const cx = w / 2;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.fillStyle = 'rgba(88,48,120,.4)';
    for (const sd of [-1, 1]) {
      g.beginPath();
      g.ellipse(cx + sd * 90, 150, 56, 62, 0, 0, Math.PI * 2);
      g.fill();
    }
    const ball1 = (x, y, r) => {
      g.fillStyle = '#f6f2b0';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(30,20,20,.7)';
      g.lineWidth = 5;
      g.stroke();
    };
    ball1(cx - 90, 132, 52);
    g.strokeStyle = 'rgba(210,60,60,.7)';
    g.lineWidth = 3;
    for (const a of [0.3, 1.5, 2.5, 3.8, 5.2]) {
      g.beginPath();
      g.moveTo(cx - 90 + Math.cos(a) * 50, 132 + Math.sin(a) * 50);
      g.lineTo(cx - 90 + Math.cos(a) * 32, 132 + Math.sin(a) * 32);
      g.stroke();
    }
    g.fillStyle = '#0c0c10';
    g.beginPath();
    g.arc(cx - 78, 118, 14, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(cx - 73, 112, 5, 0, Math.PI * 2);
    g.fill();
    ball1(cx + 92, 140, 40);
    g.strokeStyle = '#2a2a2a';
    g.lineWidth = 5;
    g.beginPath();
    for (let t = 0; t < Math.PI * 4; t += 0.2) {
      const r = t * 2.9, x = cx + 92 + r * Math.cos(t), y = 140 + r * Math.sin(t);
      if (t === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.strokeStyle = '#1f4d12';
    g.lineWidth = 17;
    g.beginPath();
    g.moveTo(cx - 140, 62);
    g.quadraticCurveTo(cx - 90, 28, cx - 40, 56);
    g.stroke();
    g.beginPath();
    g.moveTo(cx + 54, 70);
    g.lineTo(cx + 140, 98);
    g.stroke();
    g.fillStyle = 'rgba(30,70,20,.6)';
    for (const sd of [-1, 1]) {
      g.beginPath();
      g.ellipse(cx + sd * 13, 212, 8, 6, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.ellipse(cx, 250, 84, 44, 0, 0, Math.PI * 2);
    g.fillStyle = '#5b1212';
    g.fill();
    g.strokeStyle = 'rgba(40,10,10,.9)';
    g.lineWidth = 6;
    g.stroke();
    g.save();
    g.beginPath();
    g.ellipse(cx, 250, 84, 44, 0, 0, Math.PI * 2);
    g.clip();
    for (let i = 0; i < 6; i++) {
      if (i === 3) continue;
      g.fillStyle = i === 1 ? '#ffc928' : '#f4f1da';
      g.fillRect(cx - 74 + i * 26, 208, 22, 22 + (i === 4 ? 14 : 0));
    }
    for (let i = 0; i < 3; i++) {
      g.fillStyle = '#f4f1da';
      g.fillRect(cx - 40 + i * 30, 270, 20, 20);
    }
    g.restore();
    g.fillStyle = '#e8737f';
    g.beginPath();
    g.ellipse(cx + 26, 296, 28, 38, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#b94a58';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx + 26, 270);
    g.lineTo(cx + 26, 322);
    g.stroke();
    g.fillStyle = 'rgba(190,235,255,.92)';
    g.beginPath();
    g.ellipse(cx - 68, 318, 9, 20, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(cx - 77, 280, 18, 38);
    g.strokeStyle = '#3a2a14';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(cx + 128, 196);
    g.lineTo(cx + 186, 262);
    g.stroke();
    g.lineWidth = 4;
    for (let i = 0; i < 6; i++) {
      const x = cx + 128 + i * 11.6, y = 196 + i * 13.2;
      g.beginPath();
      g.moveTo(x - 9, y + 8);
      g.lineTo(x + 9, y - 8);
      g.stroke();
    }
  });
}

function decal(text, fill, line, w, h) {
  return textPlane(w, h, (g, cw, ch) => {
    let px = ch * 0.95;
    const font = () => (g.font = `900 ${px}px Arial Black, Impact, sans-serif`);
    font();
    while (g.measureText(text).width > cw * 0.88) { px -= 6; font(); }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = px * 0.15;
    g.strokeStyle = line;
    g.strokeText(text, cw / 2, ch / 2 + px * 0.04);
    g.fillStyle = fill;
    g.fillText(text, cw / 2, ch / 2 + px * 0.04);
  }, 384);
}

function patch() {
  return textPlane(0.13, 0.11, (g, w, h) => {
    g.fillStyle = '#7a8a5e';
    g.beginPath();
    g.roundRect(8, 8, w - 16, h - 16, 18);
    g.fill();
    g.setLineDash([12, 8]);
    g.strokeStyle = '#2f3a22';
    g.lineWidth = 6;
    g.stroke();
    g.setLineDash([]);
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(w * 0.28, h * 0.28);
    g.lineTo(w * 0.72, h * 0.72);
    g.moveTo(w * 0.72, h * 0.28);
    g.lineTo(w * 0.28, h * 0.72);
    g.stroke();
  }, 192);
}

function tatter(w, h, color, teeth = 5) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  for (let i = 0; i <= teeth; i++) s.lineTo(w / 2 - (i / teeth) * w, -h * (i % 2 ? 0.5 : 1));
  s.closePath();
  const m = mat(color);
  m.side = THREE.DoubleSide;
  return new THREE.Mesh(new THREE.ShapeGeometry(s), m);
}

const torus = (r, tube, color, x, y, z, rx = Math.PI / 2) => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 20), mat(color));
  m.position.set(x, y, z);
  m.rotation.x = rx;
  return m;
};

export function buildFootball() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), mat(0x8b4a1f));
  b.scale.set(0.62, 0.62, 1);
  g.add(b);
  for (const z of [-0.09, 0.09]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 20), mat(0xffffff));
    ring.position.z = z;
    g.add(ring);
  }
  g.add(rb(0.004, 0.012, 0.012, 0.17, 0xffffff, 0, 0.108, 0));
  for (const z of [-0.06, -0.03, 0, 0.03, 0.06]) g.add(rb(0.004, 0.04, 0.01, 0.012, 0xffffff, 0, 0.108, z));
  return g;
}

export function buildFootballPlayer(spec) {
  const s = { team: 'bengals', number: 0, variant: 0, zombie: false, hero: false, name: '', lod: false, ...spec };
  const T = TEAMS[s.team];
  const skin = s.hero ? SKINS[0] : SKINS[s.variant % SKINS.length];
  const faceNormal = normalFace(s, T);
  const r = rig({
    skin, shirt: T.shirt, shorts: T.pants, shoe: T.shoe, sole: T.sole, sock: T.sock, legs: 'suit',
    face: faceNormal, R, torsoW: 0.62, torsoD: 0.44, ears: false,
  });
  const { g, body, hips, head, armL, armR, legL, legR } = r;
  g.rotation.order = 'YXZ';
  const num = String(s.number);

  jerseyTrim(body, T.trim, 0.62);
  shortsStripe(hips, T.stripe);
  const front = decal(num, T.numFill, T.numLine, num.length > 1 ? 0.4 : 0.26, 0.28);
  front.position.set(0, -0.03, 0.224);
  const back = decal(num, T.numFill, T.numLine, num.length > 1 ? 0.46 : 0.3, 0.32);
  back.position.set(0, -0.04, -0.224);
  back.rotation.y = Math.PI;
  body.add(front, back);
  if (s.name) {
    const nm = decal(s.name, T.numFill, T.numLine, 0.5, 0.1);
    nm.position.set(0, 0.19, -0.224);
    nm.rotation.y = Math.PI;
    body.add(nm);
  }
  body.add(rb(0.03, 0.2, 0.07, 0.3, T.trim, 0, 0.3, 0.02));
  g.add(torus(0.15, 0.03, T.trim, 0, 1.075, 0));

  for (const sd of [-1, 1]) {
    const pad = ball(0.19, T.shirt, sd * 0.375, 1.06, 0);
    pad.scale.set(1.05, 0.7, 1);
    g.add(pad);
    g.add(torus(0.17, 0.02, T.trim, sd * 0.375, 1.11, 0, 0));
  }
  for (const arm of [armL, armR]) {
    arm.add(torus(0.121, 0.018, T.trim, 0, -0.1, 0), torus(0.097, 0.018, T.trim, 0, -0.16, 0));
    tint(arm.children[2], T.glove);
    if (s.hero) arm.add(torus(0.091, 0.017, 0xffffff, 0, -0.37, 0));
  }
  for (const leg of [legL, legR]) {
    const side = Math.sign(leg.position.x);
    leg.add(rb(0.01, 0.03, 0.22, 0.1, T.stripe, side * 0.103, -0.1, 0));
    leg.add(torus(0.093, 0.016, T.sockRing, 0, -0.23, 0));
    leg.add(rb(0.01, 0.012, 0.05, 0.2, T.sole, side * 0.118, -0.38, 0.06));
  }

  const belt = new THREE.Group();
  belt.position.y = 0.55;
  const bc = 0xffffff;
  belt.add(rb(0.015, 0.62, 0.06, 0.03, bc, 0, 0, 0.215), rb(0.015, 0.62, 0.06, 0.03, bc, 0, 0, -0.215),
    rb(0.015, 0.03, 0.06, 0.43, bc, 0.31, 0, 0), rb(0.015, 0.03, 0.06, 0.43, bc, -0.31, 0, 0),
    rb(0.01, 0.1, 0.075, 0.035, T.trim, 0, 0, 0.225));
  const flags = [-1, 1].map((sd) => {
    const f = pivot(sd * 0.335, 0, 0.02, rb(0.01, 0.06, 0.34, 0.14, T.flag, 0, -0.17, 0));
    belt.add(f);
    return f;
  });
  g.add(belt);

  const helmet = new THREE.Group();
  const shell = new THREE.Mesh(helmetGeo(s.lod),new THREE.MeshPhongMaterial({
    color: 0xffffff, map: helmetTex(s.team, false), emissive: 0x424242, emissiveMap: helmetTex(s.team, false), shininess: 90, specular: 0x999999,
  }));
  helmet.add(shell);
  const trimMat = mat(s.team === 'bengals' ? 0x111111 : 0xffb612);
  for (const geo of trimGeos()) helmet.add(new THREE.Mesh(geo, trimMat));
  const maskMat = mat(T.mask);
  maskMat.shininess = 90;
  for (const geo of maskGeos()) helmet.add(new THREE.Mesh(geo, maskMat));
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x202020 });
  for (const sd of [-1, 1]) {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.09, 14), holeMat);
    hole.position.set(sd * (Math.sqrt(SHELL_R ** 2 - 0.06 ** 2 - 0.0004) + 0.003), -0.06, 0.02);
    hole.rotation.y = sd * Math.PI / 2;
    helmet.add(hole);
  }
  head.add(helmet);
  if (s.hero) {
    const hair = 0x6a4224;
    for (let i = 0; i < 15; i++) {
      const a = 0.95 + (i / 14) * (Math.PI * 2 - 1.9);
      head.add(ball(0.075, hair, ...pt(a, 2.02, R * 1.05).toArray()));
    }
    for (let i = 0; i < 11; i++) {
      const a = 1.2 + (i / 10) * (Math.PI * 2 - 2.4);
      head.add(ball(0.065, hair, ...pt(a, 2.24, R * 1.0).toArray()));
    }
  }

  const skinMeshes = [];
  g.traverse((o) => { if (o.isMesh && o.material.color && o.material.color.getHex() === skin) skinMeshes.push(o); });

  const zx = [];
  const flap = (w, x, z, ry) => {
    const t = tatter(w, 0.3, T.shirt);
    t.position.set(x, -0.2, z);
    t.rotation.y = ry;
    body.add(t);
    zx.push(t);
  };
  flap(0.56, 0, 0.226, 0);
  flap(0.56, 0, -0.226, Math.PI);
  flap(0.38, 0.316, 0, Math.PI / 2);
  flap(0.38, -0.316, 0, -Math.PI / 2);
  const pch = patch();
  pch.position.set(-0.17, 0.14, 0.225);
  body.add(pch);
  zx.push(pch);
  for (const y of [-0.2, -0.26, -0.32]) {
    const bd = torus(0.095, 0.02, 0xf2ead2, 0, y, 0);
    armR.add(bd);
    zx.push(bd);
  }
  const tail = rb(0.01, 0.03, 0.16, 0.05, 0xf2ead2, 0.09, -0.3, 0.04);
  tail.rotation.z = -0.25;
  armR.add(tail);
  zx.push(tail);
  const foot = new THREE.Group();
  const fm = mat(ZOMBIE_SKIN);
  const sole = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), fm);
  sole.scale.set(1, 0.5, 1.7);
  sole.position.set(0, -0.43, 0.06);
  foot.add(sole);
  for (let i = 0; i < 5; i++) {
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.03 - i * 0.002, 8, 6), fm);
    toe.position.set(-0.075 + i * 0.037, -0.435, 0.215 - Math.abs(i - 1.5) * 0.005);
    foot.add(toe);
  }
  foot.visible = false;
  legR.add(foot);
  const aura = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 28), new THREE.MeshBasicMaterial({ color: 0x9be564, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.03;
  g.add(aura);
  zx.push(aura);
  zx.forEach((o) => { o.visible = false; });

  Object.assign(g.userData, {
    skinHex: skin, skinMeshes, zx, foot, flags, shell, facePatch: head.children[0].children[1], faceNormal, faceZombie: null, shoeR: [legR.children[2], legR.children[3]], team: s.team,
    zombie: false, seed: s.number * 0.37 + s.variant,
  });
  g.userData.parts.helmet = helmet;
  if (s.hero) {
    const fb = buildFootball();
    fb.position.set(0.3, -0.06, 0.26);
    fb.rotation.y = 0.5;
    body.add(fb);
    g.userData.parts.ball = fb;
  }
  g.scale.setScalar(0.95);
  if (s.lod) shrinkPlayer(g);
  if (s.zombie) setZombie(g, true);
  return g;
}

export function setZombie(g, on) {
  const u = g.userData;
  if (u.zombie === on) return;
  u.zombie = on;
  u.skinMeshes.forEach((m) => tint(m, on ? ZOMBIE_SKIN : u.skinHex));
  u.zx.forEach((o) => { o.visible = on; });
  u.foot.visible = on;
  u.shoeR.forEach((m) => { m.visible = !on; });
  u.flags.forEach((f) => { f.visible = !on; });
  if (on) u.faceZombie ??= zombieFace();
  u.facePatch.material.map = on ? u.faceZombie : u.faceNormal;
  u.facePatch.material.needsUpdate = true;
  const ht = helmetTex(u.team, on);
  u.shell.material.map = ht;
  u.shell.material.emissiveMap = ht;
  u.shell.material.needsUpdate = true;
}

export function setFlags(g, count) {
  g.userData.flags.forEach((f, i) => { f.visible = !g.userData.zombie && i < count; });
}

export function buildPearson8() {
  return buildFootballPlayer({ team: 'bengals', number: 8, variant: 0, hero: true, name: 'PEARSON' });
}

export function buildGiantZombie() {
  const g = buildFootballPlayer({ team: 'steelers', number: 99, variant: 2, zombie: true });
  g.userData.parts.head.scale.setScalar(1.22);
  g.scale.setScalar(2.6);
  return g;
}

export function animateFootball(g, t, state = {}) {
  animateCharacter(g, t, state);
  const p = g.userData.parts, u = g.userData;
  if (u.zombie) {
    const w = t * 5 + u.seed;
    const sway = state.moving ? Math.sin(t * 7 + u.seed) * 0.45 : 0;
    p.armL.rotation.x = -1.35 + Math.sin(w) * 0.12;
    p.armR.rotation.x = -1.25 + Math.sin(w + 1.7) * 0.12;
    p.armL.rotation.z = 0.12;
    p.armR.rotation.z = -0.12;
    p.legL.rotation.x = -sway;
    p.legR.rotation.x = sway;
    p.head.rotation.z = 0.24 + Math.sin(t * 2.6 + u.seed) * 0.07;
    p.head.rotation.x = 0.08;
    p.body.rotation.z = Math.sin(t * 3.4 + u.seed) * 0.07;
  }
  g.rotation.x = state.sprint ? 0.2 : 0;
  if (p.ball && !u.zombie) p.ball.visible = !state.noBall;
}

export const FOOTBALL_CAST = [
  { id: 'pearson8', name: 'Pearson, Bengals #8' },
  { id: 'qb', name: 'Hudson, Bengals QB #9' },
  { id: 'mate', name: 'Bengals #22' },
  { id: 'def1', name: 'Steelers #52' },
  { id: 'def2', name: 'Steelers #90' },
  { id: 'def3', name: 'Steelers #34' },
  { id: 'zdef1', name: 'Zombie Steeler' },
  { id: 'zdef2', name: 'Zombie Steeler 2' },
  { id: 'zmate', name: 'Zombie Bengal' },
  { id: 'giant', name: 'Giant Zombie Steeler' },
];

export function buildFootballCharacter(id) {
  switch (id) {
    case 'pearson8': return buildPearson8();
    case 'qb': return buildFootballPlayer({ team: 'bengals', number: 9, variant: 3 });
    case 'mate': return buildFootballPlayer({ team: 'bengals', number: 22, variant: 2 });
    case 'def1': return buildFootballPlayer({ team: 'steelers', number: 52, variant: 1 });
    case 'def2': return buildFootballPlayer({ team: 'steelers', number: 90, variant: 5 });
    case 'def3': return buildFootballPlayer({ team: 'steelers', number: 34, variant: 4 });
    case 'zdef1': return buildFootballPlayer({ team: 'steelers', number: 52, variant: 1, zombie: true });
    case 'zdef2': return buildFootballPlayer({ team: 'steelers', number: 90, variant: 5, zombie: true });
    case 'zmate': return buildFootballPlayer({ team: 'bengals', number: 22, variant: 2, zombie: true });
    case 'giant': return buildGiantZombie();
    default: throw new Error(`unknown football character: ${id}`);
  }
}

export function disposeObject(root) {
  const free = (t) => { if (t && !t.userData.shared) t.dispose(); };
  root.traverse((o) => {
    if (o.geometry) free(o.geometry);
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { free(m.map); free(m.emissiveMap); m.dispose(); });
    }
    if (o.userData.faceNormal) { free(o.userData.faceNormal); free(o.userData.faceZombie); }
  });
}
