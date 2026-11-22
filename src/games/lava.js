import * as THREE from 'three';
import { stepBody, applyAbility, createAbilityState } from '../physics.js';
import { buildCharacter, animateCharacter, buildBuddy, CHARACTERS } from '../characters.js';
import { createJokeTeller, nearestHazard } from '../buddy.js';
import {
  PLATFORMS, OBSTACLES, BONES, GOAL, START, LAVA_Y, KILL_Y,
  platformBox, moveObstacles, createRun,
} from './layout.js';

const CAM_DIST = 6.5, CAM_HEIGHT = 3.4;
const DEV_SPEED = 1.6, DEV_JUMP = 9 * 1.41;
const lambert = (color) => new THREE.MeshPhongMaterial({ color, shininess: 30, specular: 0x2a2a2a });

function slab(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color));
  m.position.set(x, y, z);
  return m;
}

// Round Lego-style studs across the top face, like a Roblox part.
function addStuds(group, w, d, topY, color) {
  const nx = Math.max(1, Math.round(w)), nz = Math.max(1, Math.round(d));
  const studs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.27, 0.27, 0.14, 14), lambert(color), nx * nz);
  const m = new THREE.Matrix4();
  let i = 0;
  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      m.makeTranslation((ix + 0.5 - nx / 2) * (w / nx), topY + 0.07, (iz + 0.5 - nz / 2) * (d / nz));
      studs.setMatrixAt(i++, m);
    }
  }
  group.add(studs);
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2f7fd8');
  grad.addColorStop(0.55, '#a9d8ff');
  grad.addColorStop(1, '#cfeaff');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  return new THREE.CanvasTexture(c);
}

function buildCloud() {
  const g = new THREE.Group();
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const [x, y, z, w, h, d] of [[0, 0, 0, 12, 3, 6], [4, 1.8, 0, 7, 3, 5], [-4, 1.4, 1, 6, 2.6, 4]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), white);
    m.position.set(x, y, z);
    g.add(m);
  }
  return g;
}

function lavaTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#b02a05';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 46; i++) {
    const x = (i * 83) % 256, y = (i * 149) % 256, r = 22 + ((i * 31) % 30);
    const hot = i % 3 === 0;
    for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
      const grad = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      grad.addColorStop(0, hot ? 'rgba(255,210,70,0.85)' : 'rgba(255,130,20,0.7)');
      grad.addColorStop(1, 'rgba(176,42,5,0)');
      g.fillStyle = grad;
      g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  t.repeat.set(36, 36);
  return t;
}

function buildPlatform(p) {
  const g = new THREE.Group();
  const h = p.top + 3;
  const cy = p.top - h / 2;
  const body = { start: 0xa3a2a5, present: 0xc4281c, candy: 0xf2f3f3, gingerbread: 0x7c5c46, bone: 0x4b974b, goal: 0xf5cd30 }[p.kind];
  g.add(slab(p.w, h, p.d, body, 0, cy, 0));
  addStuds(g, p.w, p.d, p.top, body);
  if (p.kind === 'start') g.add(slab(p.w + 0.1, 0.25, p.d + 0.1, 0xffffff, 0, p.top - 0.12, 0));
  if (p.kind === 'present') {
    g.add(slab(0.5, 0.05, p.d + 0.02, 0xffffff, 0, p.top + 0.02, 0));
    g.add(slab(p.w + 0.02, 0.05, 0.5, 0xffffff, 0, p.top + 0.02, 0));
    g.add(slab(0.5, h, p.d + 0.04, 0xffffff, 0, cy, 0));
  }
  if (p.kind === 'candy') {
    for (let i = -1; i <= 1; i++) g.add(slab(p.w + 0.04, h, 0.5, 0xd62828, 0, cy, i * 0.95));
  }
  if (p.kind === 'gingerbread') {
    g.add(slab(p.w + 0.12, 0.2, p.d + 0.12, 0xffffff, 0, p.top - 0.1, 0));
    for (let i = -1; i <= 1; i++) g.add(slab(0.28, 0.28, 0.06, 0xd62828, i * 0.8, p.top - 0.9, p.d / 2 + 0.03));
  }
  if (p.kind === 'bone') {
    g.add(slab(0.5, 0.2, p.d + 0.3, 0xffffff, -p.w / 2 + 0.2, p.top - 0.1, 0));
    g.add(slab(0.5, 0.2, p.d + 0.3, 0xffffff, p.w / 2 - 0.2, p.top - 0.1, 0));
  }
  if (p.kind === 'goal') g.add(slab(p.w + 0.1, 0.2, p.d + 0.1, 0xffffff, 0, p.top - 0.1, 0));
  g.position.set(p.x, 0, p.z);
  return g;
}

function buildObstacle(o) {
  const g = new THREE.Group();
  if (o.kind === 'slider') {
    g.add(slab(o.w, o.h, o.d, 0x0d69ac));
    g.add(slab(o.w + 0.1, 0.2, o.d + 0.1, 0xf2f3f3, 0, o.h / 2 - 0.1, 0));
    addStuds(g, o.w, o.d, o.h / 2, 0x0d69ac);
  } else if (o.kind === 'log') {
    g.add(slab(o.w, o.h, o.d, 0x694028));
    g.add(slab(o.w + 0.02, o.h - 0.2, 0.12, 0xd9a566, 0, 0, o.d / 2 + 0.01));
    g.add(slab(o.w + 0.02, o.h - 0.2, 0.12, 0xd9a566, 0, 0, -o.d / 2 - 0.01));
    addStuds(g, o.w, o.d, o.h / 2, 0x694028);
  } else {
    g.add(slab(o.w, o.h, o.d, 0xc4281c));
    for (let i = -1; i <= 1; i++) g.add(slab(o.w + 0.02, o.h, 0.3, 0xf2f3f3, 0, 0, i * 0.8));
    addStuds(g, o.w, o.d, o.h / 2, 0xc4281c);
  }
  return g;
}

function buildBone() {
  const g = new THREE.Group();
  const c = 0xffc21a;
  g.add(slab(0.7, 0.16, 0.16, c));
  for (const sx of [-0.38, 0.38]) for (const sz of [-0.1, 0.1]) g.add(slab(0.2, 0.2, 0.2, c, sx, 0, sz));
  return g;
}

function buildGoal() {
  const g = new THREE.Group();
  g.add(slab(1.1, 1.0, 1.1, 0xffc21a));
  g.add(slab(0.25, 1.02, 1.12, 0xc0392b));
  g.add(slab(1.12, 1.02, 0.25, 0xc0392b));
  g.add(slab(0.5, 0.3, 0.5, 0xc0392b, 0, 0.62, 0));
  return g;
}

export function startLava(ctx) {
  const { scene, camera, input, store, ui } = ctx;
  const world = new THREE.Group();
  scene.add(world);

  const prevBackground = scene.background;
  const sky = skyTexture();
  scene.background = sky;
  scene.fog = new THREE.Fog(0xbfe4ff, 70, 190);

  world.add(new THREE.HemisphereLight(0xffffff, 0xc98a5a, 1.5));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
  sun.position.set(6, 12, 4);
  world.add(sun);
  const glow = new THREE.PointLight(0xff6a1a, 1.2, 60);
  glow.position.set(3, 1, -26);
  world.add(glow);

  for (const [x, y, z, s] of [[-45, 30, -20, 1], [50, 36, -50, 1.3], [-60, 40, -80, 1.5], [30, 28, 20, 0.9], [-20, 34, -110, 1.4], [70, 32, -10, 1.1]]) {
    const cloud = buildCloud();
    cloud.position.set(x, y, z);
    cloud.scale.setScalar(s);
    world.add(cloud);
  }

  const tex = lavaTexture();
  const lava = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshBasicMaterial({ map: tex }));
  lava.rotation.x = -Math.PI / 2;
  lava.position.set(0, LAVA_Y, -25);
  world.add(lava);

  const platBoxes = PLATFORMS.map((p) => platformBox(p));
  for (const p of PLATFORMS) world.add(buildPlatform(p));

  const obsMeshes = OBSTACLES.map((o) => { const m = buildObstacle(o); world.add(m); return m; });

  const boneMeshes = BONES.map((b) => {
    const m = buildBone();
    m.position.set(b.x, b.y, b.z);
    world.add(m);
    return { id: b.id, mesh: m, base: b.y };
  });

  const goal = buildGoal();
  goal.position.set(GOAL.x, 4.5, GOAL.z);
  world.add(goal);

  const charDef = CHARACTERS.find((c) => c.id === ctx.character) || CHARACTERS[0];
  const player = buildCharacter(charDef.id);
  world.add(player);

  const buddy = buildBuddy();
  world.add(buddy);

  const run = createRun();
  const body = { pos: { ...START }, vel: { x: 0, y: 0, z: 0 }, onGround: false, ridingId: null };
  const ability = createAbilityState();
  const teller = createJokeTeller();
  const warnedAt = new Map();
  let safe = { ...START };
  let yaw = 0;
  let worldT = 0;
  let animT = 0;
  let hudT = 0;
  let finished = false;
  let griddyT = 0;
  let lastObstacles = moveObstacles(OBSTACLES, 0);
  let lastResult = null;

  function respawn() {
    body.pos.x = START.x; body.pos.y = START.y; body.pos.z = START.z;
    body.vel.x = body.vel.y = body.vel.z = 0;
    body.onGround = false;
    body.ridingId = null;
    ability.left = null;
    safe = { ...START };
    yaw = 0;
  }
  respawn();

  function resetBones() { for (const b of boneMeshes) b.mesh.visible = true; }

  function die(quiet = false) {
    run.die();
    resetBones();
    respawn();
    if (quiet) return;
    ctx.audio?.sfx('splash');
    if (ctx.getBuddy()) ui.toast(teller.next(), 5000, 'Orbit says');
    else ui.toast('Splash! Back to the start. Try again!', 2500);
  }

  function win() {
    finished = true;
    lastResult = run.win(store, ctx.getDev());
    ctx.audio?.sfx('win');
    ctx.onWin(lastResult);
  }

  function pushHud(force) {
    hudT -= 1;
    if (!force && hudT > 0) return;
    hudT = 6;
    ctx.setHud({ time: run.time(), bonesRun: run.bonesCount(), bonesMax: BONES.length });
  }

  function update(dt) {
    worldT += dt;
    animT += dt;
    const dev = ctx.getDev();
    lastObstacles = moveObstacles(OBSTACLES, worldT);

    lastObstacles.forEach((o, i) => {
      obsMeshes[i].position.set((o.min.x + o.max.x) / 2, (o.min.y + o.max.y) / 2, (o.min.z + o.max.z) / 2);
    });

    const inp = finished ? { moveX: 0, moveZ: 0, jump: false, lookDeltaX: input.read().lookDeltaX } : input.read();
    yaw += inp.lookDeltaX;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const wx = fx * inp.moveZ + rx * inp.moveX;
    const wz = fz * inp.moveZ + rz * inp.moveX;

    if (!finished) {
      applyAbility(body, charDef.special, inp.jump, ability, dt);
      const boxes = [...platBoxes, ...lastObstacles];
      const wasGround = body.onGround;
      stepBody(body, boxes, { moveX: wx, moveZ: wz, jump: inp.jump }, dt, {
        speed: charDef.walkSpeed * (dev ? DEV_SPEED : 1),
        jumpSpeed: dev ? DEV_JUMP : 9,
        gravity: 28,
      });
      if (wasGround && !body.onGround && body.vel.y > 1) ctx.audio?.sfx('jump');
      else if (!wasGround && body.onGround) ctx.audio?.sfx('land');
      if (body.onGround && body.ridingId && platBoxes.some((b) => b.id === body.ridingId)) {
        safe = { x: body.pos.x, y: body.pos.y, z: body.pos.z };
      }
      run.tick(dt);

      if (body.pos.y < KILL_Y) {
        if (dev) {
          body.pos.x = safe.x; body.pos.y = safe.y + 0.05; body.pos.z = safe.z;
          body.vel.x = body.vel.y = body.vel.z = 0;
        } else {
          die();
        }
      }

      const cy = body.pos.y + 0.6;
      for (const b of boneMeshes) {
        if (!b.mesh.visible) continue;
        const def = BONES.find((q) => q.id === b.id);
        const bx = b.id === 'b12' ? lastObstacles.find((o) => o.id === 'slider1') : null;
        const ox = bx ? (bx.min.x + bx.max.x) / 2 - OBSTACLES[0].cx : 0;
        if (Math.hypot(def.x + ox - body.pos.x, def.y - cy, def.z - body.pos.z) < 0.95) {
          b.mesh.visible = false;
          run.collect(b.id);
          ctx.audio?.sfx('bone');
        }
      }

      if (Math.hypot(GOAL.x - body.pos.x, GOAL.y - cy, GOAL.z - body.pos.z) < GOAL.radius + 0.5) win();

      if (ctx.getBuddy()) {
        const h = nearestHazard(body.pos, lastObstacles, 6);
        if (h && worldT - (warnedAt.get(h.id) ?? -99) > 9) {
          warnedAt.set(h.id, worldT);
          ui.toast(h.kind === 'wall' ? 'Heads up! A moving wall. Time your jump!' : 'Heads up! A rolling log. Jump over it!', 2800, 'Orbit says');
        }
      }
    } else {
      griddyT += dt;
    }

    player.position.set(body.pos.x, body.pos.y, body.pos.z);
    if (finished) player.rotation.y = yaw;
    else if (Math.hypot(wx, wz) > 0.1) player.rotation.y = Math.atan2(wx, wz);
    animateCharacter(player, animT, {
      moving: !finished && Math.hypot(wx, wz) > 0.1 && body.onGround,
      airborne: !body.onGround && !finished,
      griddy: finished,
    });

    buddy.visible = ctx.getBuddy();
    if (buddy.visible) {
      const bx = body.pos.x + rx * 1.1 + fx * -0.4, bz = body.pos.z + rz * 1.1 + fz * -0.4;
      buddy.position.x += (bx - buddy.position.x) * Math.min(1, dt * 6);
      buddy.position.z += (bz - buddy.position.z) * Math.min(1, dt * 6);
      buddy.position.y += (body.pos.y + 1.4 + Math.sin(animT * 3) * 0.1 - buddy.position.y) * Math.min(1, dt * 6);
      animateCharacter(buddy, animT, {});
    }

    for (const b of boneMeshes) {
      b.mesh.rotation.y = animT * 2.2;
      b.mesh.position.y = b.base + Math.sin(animT * 3 + b.base) * 0.12;
      if (b.id === 'b12') {
        const s = lastObstacles.find((o) => o.id === 'slider1');
        b.mesh.position.x = (s.min.x + s.max.x) / 2;
      }
    }
    goal.rotation.y = animT * 1.2;
    goal.position.y = 4.5 + Math.sin(animT * 2) * 0.1;
    tex.offset.set(animT * 0.02, animT * 0.035);
    glow.intensity = 1.3 + Math.sin(animT * 3) * 0.25;

    pushHud(false);
  }

  function frame() {
    const dist = CAM_DIST;
    camera.position.set(body.pos.x + Math.sin(yaw) * dist, body.pos.y + CAM_HEIGHT, body.pos.z + Math.cos(yaw) * dist);
    camera.lookAt(body.pos.x, body.pos.y + 1.2, body.pos.z);
  }

  function state() {
    const f = (n) => Number(n.toFixed(2));
    return {
      level: 'lava',
      player: { x: f(body.pos.x), y: f(body.pos.y), z: f(body.pos.z), onGround: body.onGround, ridingId: body.ridingId },
      yaw: f(yaw),
      lavaY: LAVA_Y,
      time: f(run.time()),
      deaths: run.deaths(),
      bonesRun: run.bonesCount(),
      finished,
      result: lastResult,
      goal: { x: GOAL.x, y: GOAL.y, z: GOAL.z },
      obstacles: lastObstacles.map((o) => ({ id: o.id, x: f((o.min.x + o.max.x) / 2), y: f((o.min.y + o.max.y) / 2), z: f((o.min.z + o.max.z) / 2) })),
    };
  }

  function teleport(x, y, z) {
    body.pos.x = x; body.pos.y = y; body.pos.z = z;
    body.vel.x = body.vel.y = body.vel.z = 0;
  }

  function dispose() {
    scene.remove(world);
    scene.background = prevBackground;
    scene.fog = null;
    tex.dispose();
    sky.dispose();
    world.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  pushHud(true);
  return { update, frame, state, teleport, dispose, restart: () => die(true), isFinished: () => finished };
}
