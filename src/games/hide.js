import * as THREE from 'three';
import { stepBody } from '../physics.js';
import { buildCharacter, animateCharacter, CHARACTERS } from '../characters.js';
import { createSeeker, STANCE_NOISE } from './seeker.js';
import {
  ROOM, START, EXIT, SOLIDS, BONES, TOY_PICKUPS, WAYPOINTS, STANCE_SPEED, SEEKER, NAV, roomIdAt,
  movers, sighters, isHidden, stanceFor, createHideRun,
} from './hide-layout.js';
import { buildPizzeria, buildSeeker, animateSeeker, buildToy, buildToyPickup, buildBone } from './hide-scene.js';
import { createScareDirector } from './hide-scare.js';

const CAM_DIST = 6.5, CAM_HEIGHT = 3.8, CAM_INSET = 0.8;
const DEV_SPEED = 1.6;
const TUNE = 'hide';
const TICKLE_SECONDS = 1.5, SLEEP_AFTER_CATCH = 2.5, START_SLEEP = 2.5;
const SCARE_SECONDS = 0.8;
const TOY_START = 3, TOY_CAP = 5, TOY_CRATE_GIVES = 2, THROW_RANGE = 7, THROW_TIME = 0.6, NOISE_RADIUS = 14;
const LIGHT = { gentle: { hemi: 1.35, dir: 0.7, sky: 0x1a2050, lantern: 0 }, scary: { hemi: 0.07, dir: 0.03, sky: 0x05061a, lantern: 6 } };

const SCARE_CSS = `
#scare { position: fixed; inset: 0; z-index: 30; display: none; align-items: center; justify-content: center; pointer-events: none; overflow: hidden;
  background: radial-gradient(circle, #4a1010 0%, #000 78%); }
#scare .face { position: relative; width: 78vmin; height: 70vmin; background: #e8862a; border: 1.4vmin solid #a85a12; border-radius: 9vmin; animation: scare-zoom .8s ease-out forwards; }
#scare .ear { position: absolute; top: -9vmin; width: 18vmin; height: 18vmin; background: #e8862a; border: 1.2vmin solid #a85a12; border-radius: 5vmin; }
#scare .hat { position: absolute; top: -34vmin; left: 50%; width: 30vmin; height: 32vmin; transform: translateX(-35%) rotate(-8deg); clip-path: polygon(50% 0, 100% 100%, 0 100%);
  background: repeating-linear-gradient(0deg, #e74c3c 0 5vmin, #f1c40f 5vmin 10vmin); }
#scare .eye { position: absolute; top: 15%; width: 21vmin; height: 25vmin; background: #fff; border-radius: 50%; border: 0.8vmin solid #2b1b12; }
#scare .eye i { position: absolute; left: 50%; top: 42%; width: 9vmin; height: 11vmin; background: #1b1b1b; border-radius: 50%; transform: translate(-50%, -50%); }
#scare .snout { position: absolute; left: 50%; top: 42%; width: 34vmin; height: 16vmin; transform: translateX(-50%); background: #ffe9b8; border-radius: 6vmin; }
#scare .nose { position: absolute; left: 50%; top: 4%; width: 11vmin; height: 7vmin; transform: translateX(-50%); background: #2b1b12; border-radius: 3vmin; }
#scare .mouth { position: absolute; left: 50%; bottom: 7%; width: 60vmin; height: 17vmin; transform: translateX(-50%); background: #2b1b12; border-radius: 3vmin; overflow: hidden; }
#scare .mouth i { position: absolute; left: 0; right: 0; top: 0; height: 52%; background: repeating-linear-gradient(90deg, #fff 0 5.4vmin, transparent 5.4vmin 6.4vmin); }
#scare .honk { position: absolute; bottom: 4vmin; left: 50%; transform: translateX(-50%) rotate(-4deg); font: 900 14vmin/1 "Trebuchet MS", system-ui, sans-serif; color: #f1c40f; text-shadow: 0 1vmin 0 #7d2118; letter-spacing: .04em; }
@keyframes scare-zoom { 0% { transform: scale(.55) rotate(-4deg); } 55% { transform: scale(1.18) rotate(3deg); } 100% { transform: scale(1.1) rotate(-2deg); } }
#panic-btn { position: absolute; right: 2vmin; top: 2vmin; }
`;

const SCARE_HTML = `<div class="face">
  <div class="hat"></div>
  <div class="ear" style="left:-6vmin"></div><div class="ear" style="right:-6vmin"></div>
  <div class="eye" style="left:12%"><i></i></div><div class="eye" style="right:12%"><i></i></div>
  <div class="snout"><div class="nose"></div></div>
  <div class="mouth"><i></i></div>
</div><div class="honk">HONK!</div>`;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const f2 = (n) => Number(n.toFixed(2));

export function startHide(ctx) {
  const { scene, camera, input, store, ui, audio } = ctx;
  const world = new THREE.Group();
  scene.add(world);

  const prevBackground = scene.background;
  scene.background = new THREE.Color(LIGHT.gentle.sky);

  const hemi = new THREE.HemisphereLight(0xfff1dc, 0x5a4636, LIGHT.gentle.hemi);
  const dir = new THREE.DirectionalLight(0xffe9c8, LIGHT.gentle.dir);
  dir.position.set(4, 12, 6);
  const lantern = new THREE.PointLight(0xffe0a8, 0, 9, 1.6);
  world.add(hemi, dir, lantern);

  const pizzeria = buildPizzeria();
  world.add(pizzeria.group);

  const boneMeshes = BONES.map((b) => {
    const m = buildBone();
    m.position.set(b.x, b.y, b.z);
    world.add(m);
    return { id: b.id, mesh: m, base: b.y };
  });
  const crates = TOY_PICKUPS.map((p) => {
    const m = buildToyPickup();
    m.position.set(p.x, 0, p.z);
    world.add(m);
    return { id: p.id, x: p.x, z: p.z, mesh: m, taken: false };
  });

  const bolt = buildSeeker();
  world.add(bolt);
  const charDef = CHARACTERS.find((c) => c.id === ctx.character) || CHARACTERS[0];
  const player = buildCharacter(charDef.id);
  world.add(player);

  const seeker = createSeeker({ waypoints: WAYPOINTS, boxes: movers, sightBoxes: sighters, nav: NAV, patrolSpeed: SEEKER.patrol, chaseSpeed: SEEKER.chase });
  const director = createScareDirector();

  const style = document.createElement('style');
  style.textContent = SCARE_CSS;
  document.head.appendChild(style);
  const scareEl = document.createElement('div');
  scareEl.id = 'scare';
  scareEl.innerHTML = SCARE_HTML;
  document.body.appendChild(scareEl);
  const panic = document.createElement('button');
  panic.id = 'panic-btn';
  panic.className = 'btn gold small hidden';
  panic.textContent = 'Calm down';
  (document.getElementById('ui') || document.body).appendChild(panic);
  panic.addEventListener('click', () => ctx.setScary(false));

  // A map twice the size cannot beat times set on the old one, so retire them once.
  if (store.load('hideMapVersion', 1) < 2) {
    const stored = store.load('bestTimes', {});
    const times = stored && typeof stored === 'object' ? stored : {};
    delete times.hide;
    store.save('bestTimes', times);
    store.save('hideMapVersion', 2);
  }

  let run = createHideRun();
  const body = { pos: { ...START }, vel: { x: 0, y: 0, z: 0 }, onGround: false, ridingId: null };
  let yaw = 0, animT = 0, hudT = 0;
  let finished = false, lastResult = null, exitOpen = false;
  let toys = TOY_START, noise = 0, stance = 'still', hidden = false;
  let caughtT = 0, sleepLeft = 0;
  let appliedScary = null, scareT = 0, shakeT = 0, pendingTickle = false;
  let buildUp = false, buildT = 0, buildSince = 0, musicDropped = false;
  let flying = [];
  let prevBolt = { x: 0, z: 0 };

  const farthestWp = () => {
    let best = 0, bd = -1;
    WAYPOINTS.forEach((w, i) => { const d = Math.hypot(w.x - START.x, w.z - START.z); if (d > bd) { bd = d; best = i; } });
    return best;
  };

  function sleepSeeker(seconds) {
    seeker.reset(farthestWp(), seconds);
    sleepLeft = seconds;
    prevBolt = { x: seeker.x, z: seeker.z };
  }

  function respawnPlayer() {
    body.pos.x = START.x; body.pos.y = START.y; body.pos.z = START.z;
    body.vel.x = body.vel.y = body.vel.z = 0;
    body.onGround = false;
    body.ridingId = null;
    yaw = 0;
    player.rotation.y = Math.PI;
  }

  function restoreMusic() {
    buildUp = false;
    if (musicDropped) { musicDropped = false; audio?.music(TUNE); }
  }

  function startBuildUp() {
    buildUp = true;
    buildT = 0;
    buildSince = 0;
    if (!musicDropped) { musicDropped = true; audio?.music(null); }
  }

  function showScare(on) { scareEl.style.display = on ? 'flex' : 'none'; }

  function endScare() {
    scareT = 0;
    shakeT = 0;
    showScare(false);
  }

  function startScare() {
    director.record(run.time());
    scareT = SCARE_SECONDS;
    shakeT = SCARE_SECONDS;
    pendingTickle = true;
    showScare(true);
    audio?.sfx('honk');
  }

  function applyScary(on) {
    appliedScary = on;
    const L = on ? LIGHT.scary : LIGHT.gentle;
    hemi.intensity = L.hemi;
    dir.intensity = L.dir;
    lantern.intensity = L.lantern;
    scene.background = new THREE.Color(L.sky);
    seeker.setSpeedScale(on ? SEEKER.scaryScale : 1);
    panic.classList.toggle('hidden', !on);
    if (!on) {
      endScare();
      if (pendingTickle) { pendingTickle = false; audio?.sfx('tickle'); }
      restoreMusic();
    }
  }

  function bolt_say(text) { ui.toast(text, 2200, 'Bolt says'); }

  function onCaught() {
    run.caught();
    caughtT = TICKLE_SECONDS;
    bolt_say('Gotcha! Tickle tickle!');
    if (appliedScary && director.canScare(run.time())) startScare();
    else audio?.sfx('tickle');
  }

  function openExit() {
    exitOpen = true;
    pizzeria.setDoorOpen(true);
    audio?.sfx('door');
    ui.toast(`All ${BONES.length} bones! The exit is open. Run for the door!`, 3500);
  }

  function collectBone(b) {
    if (!b.mesh.visible || !run.collect(b.id)) return;
    b.mesh.visible = false;
    audio?.sfx('bone');
  }

  function win() {
    finished = true;
    endScare();
    lastResult = run.win(store, ctx.getDev());
    audio?.sfx('win');
    ctx.onWin(lastResult);
  }

  function throwToy() {
    toys -= 1;
    audio?.sfx('throw');
    const face = player.rotation.y;
    const dx = Math.sin(face), dz = Math.cos(face);
    let d = 1;
    for (let t = 1; t <= THROW_RANGE; t += 0.25) {
      const x = body.pos.x + dx * t, z = body.pos.z + dz * t;
      const out = x < ROOM.minX + 0.6 || x > ROOM.maxX - 0.6 || z < ROOM.minZ + 0.6 || z > ROOM.maxZ - 0.6;
      const inside = movers.some((m) => x > m.min.x - 0.3 && x < m.max.x + 0.3 && z > m.min.z - 0.3 && z < m.max.z + 0.3);
      if (out || inside) break;
      d = t;
    }
    const mesh = buildToy();
    world.add(mesh);
    flying.push({ mesh, t: 0, from: { x: body.pos.x, y: body.pos.y + 1.2, z: body.pos.z }, to: { x: body.pos.x + dx * d, z: body.pos.z + dz * d }, landed: false, life: 4 });
  }

  function updateToys(dt) {
    for (const ft of flying) {
      if (!ft.landed) {
        ft.t += dt;
        const p = Math.min(1, ft.t / THROW_TIME);
        ft.mesh.position.set(ft.from.x + (ft.to.x - ft.from.x) * p, ft.from.y * (1 - p) + 0.12 * p + Math.sin(Math.PI * p) * 1.6, ft.from.z + (ft.to.z - ft.from.z) * p);
        ft.mesh.rotation.y += dt * 12;
        if (p >= 1) {
          ft.landed = true;
          audio?.sfx('thud');
          seeker.hearNoise(ft.to.x, ft.to.z, NOISE_RADIUS);
        }
      } else {
        ft.life -= dt;
      }
    }
    flying = flying.filter((ft) => {
      if (ft.life > 0) return true;
      world.remove(ft.mesh);
      return false;
    });
  }

  function reset() {
    run = createHideRun();
    toys = TOY_START;
    noise = 0;
    finished = false;
    lastResult = null;
    exitOpen = false;
    pizzeria.setDoorOpen(false);
    caughtT = 0;
    for (const b of boneMeshes) b.mesh.visible = true;
    for (const c of crates) { c.taken = false; c.mesh.visible = true; }
    for (const ft of flying) world.remove(ft.mesh);
    flying = [];
    director.reset();
    endScare();
    pendingTickle = false;
    restoreMusic();
    respawnPlayer();
    sleepSeeker(START_SLEEP);
    ui.clearToast();
  }

  function pushHud(force) {
    hudT -= 1;
    if (!force && hudT > 0) return;
    hudT = 6;
    ctx.setHud({ time: run.time(), bonesRun: run.bonesCount(), bonesMax: BONES.length, toys, noise, hidden });
  }

  function update(dt) {
    animT += dt;
    const dev = ctx.getDev();
    const sc = ctx.getScary();
    if (sc !== appliedScary) applyScary(sc);

    const raw = input.read();
    yaw += raw.lookDeltaX;
    const frozen = finished || caughtT > 0;
    const inp = frozen ? { ...raw, moveX: 0, moveZ: 0, jump: false, tiptoe: false, throwPressed: false } : raw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const wx = fx * inp.moveZ + rx * inp.moveX;
    const wz = fz * inp.moveZ + rz * inp.moveX;

    stance = stanceFor(inp);
    if (!finished) {
      const speed = STANCE_SPEED[stance === 'still' ? 'walk' : stance] * (dev ? DEV_SPEED : 1);
      stepBody(body, SOLIDS, { moveX: wx, moveZ: wz, jump: false }, dt, { speed, gravity: 28 });
      run.tick(dt);
    }
    hidden = isHidden(body.pos.x, body.pos.z);
    const noiseTarget = (STANCE_NOISE[stance] ?? 0) / 10;
    noise += (noiseTarget - noise) * Math.min(1, dt * 6);

    if (inp.throwPressed && toys > 0 && !frozen) throwToy();
    updateToys(dt);

    if (!finished) {
      for (const b of boneMeshes) {
        const def = BONES.find((q) => q.id === b.id);
        if (b.mesh.visible && Math.hypot(def.x - body.pos.x, def.z - body.pos.z) < 0.95) collectBone(b);
      }
      if (!exitOpen && run.canExit()) openExit();
      for (const c of crates) {
        if (c.taken || Math.hypot(c.x - body.pos.x, c.z - body.pos.z) >= 1.1) continue;
        c.taken = true;
        c.mesh.visible = false;
        toys = Math.min(TOY_CAP, toys + TOY_CRATE_GIVES);
        audio?.sfx('boing');
        ui.toast(`Toy crate! You have ${toys} toys. Press E to throw one.`, 2500);
      }
      if (exitOpen && Math.hypot(EXIT.x - body.pos.x, EXIT.z - body.pos.z) < EXIT.radius) win();
    }

    if (sleepLeft > 0) sleepLeft -= dt;
    if (!finished) {
      if (caughtT > 0) {
        caughtT -= dt;
        if (caughtT <= 0) {
          respawnPlayer();
          sleepSeeker(SLEEP_AFTER_CATCH);
          restoreMusic();
        }
      } else {
        const events = seeker.step(dt, { player: { x: body.pos.x, z: body.pos.z }, hidden: hidden || dev, stance });
        for (const e of events) {
          if (e === 'spotted') { bolt_say('Hey! I see you!'); if (appliedScary) startBuildUp(); }
          else if (e === 'heard') bolt_say('Did I hear something?');
          else if (e === 'lost') { bolt_say('Hmm... where did you go?'); restoreMusic(); }
          else if (e === 'tickle') onCaught();
        }
      }
    }

    if (buildUp) {
      buildSince += dt;
      buildT -= dt;
      if (buildT <= 0) {
        audio?.sfx('footstep');
        buildT = Math.max(0.28, 0.75 - buildSince * 0.12);
      }
    }
    if (scareT > 0) {
      scareT -= dt;
      shakeT = Math.max(0, shakeT - dt);
      if (scareT <= 0) {
        showScare(false);
        if (pendingTickle) { pendingTickle = false; audio?.sfx('tickle'); }
      }
    }

    player.position.set(body.pos.x, body.pos.y, body.pos.z);
    lantern.position.set(body.pos.x, body.pos.y + 2.6, body.pos.z);
    const moving = Math.hypot(wx, wz) > 0.1;
    if (moving) player.rotation.y = Math.atan2(wx, wz);
    animateCharacter(player, animT, { moving: moving && body.onGround, airborne: false, griddy: finished });

    bolt.position.set(seeker.x, 0, seeker.z);
    bolt.rotation.y = seeker.facing;
    const moved = Math.hypot(seeker.x - prevBolt.x, seeker.z - prevBolt.z) > 0.4 * dt;
    prevBolt = { x: seeker.x, z: seeker.z };
    animateSeeker(bolt, animT, { moving: moved, state: seeker.state });
    bolt.userData.beam.visible = sleepLeft <= 0 && seeker.state !== 'tickle';

    for (const b of boneMeshes) {
      b.mesh.rotation.y = animT * 2.2;
      b.mesh.position.y = b.base + Math.sin(animT * 3 + b.base) * 0.12;
    }
    for (const c of crates) c.mesh.rotation.y = Math.sin(animT * 1.5) * 0.25;

    pushHud(false);
  }

  function frame() {
    let cx = clamp(body.pos.x + Math.sin(yaw) * CAM_DIST, ROOM.minX + CAM_INSET, ROOM.maxX - CAM_INSET);
    let cz = clamp(body.pos.z + Math.cos(yaw) * CAM_DIST, ROOM.minZ + CAM_INSET, ROOM.maxZ - CAM_INSET);
    const pulledIn = 1 - Math.hypot(cx - body.pos.x, cz - body.pos.z) / CAM_DIST;
    let cy = body.pos.y + CAM_HEIGHT + Math.max(0, pulledIn) * 3;
    if (shakeT > 0) {
      const k = (shakeT / SCARE_SECONDS) * 0.35;
      cx += Math.sin(animT * 95) * k;
      cy += Math.cos(animT * 83) * k;
      cz += Math.sin(animT * 71) * k;
    }
    pizzeria.lowerWalls(cx, cz, body.pos.x, body.pos.z);
    camera.position.set(cx, cy, cz);
    camera.lookAt(body.pos.x, body.pos.y + 1.2, body.pos.z);
  }

  function state() {
    return {
      level: 'hide',
      player: { x: f2(body.pos.x), y: f2(body.pos.y), z: f2(body.pos.z), hidden, onGround: body.onGround },
      stance,
      room: { player: roomIdAt(body.pos.x, body.pos.z), seeker: roomIdAt(seeker.x, seeker.z) },
      noise: f2(noise),
      toys,
      bonesRun: run.bonesCount(),
      exitOpen,
      caught: run.caughtCount(),
      time: f2(run.time()),
      finished,
      result: lastResult,
      scary: !!appliedScary,
      lighting: f2(hemi.intensity),
      seekerSpeedScale: appliedScary ? SEEKER.scaryScale : 1,
      seeker: { x: f2(seeker.x), z: f2(seeker.z), facing: f2(seeker.facing), state: seeker.state, asleep: sleepLeft > 0 },
      scare: { count: director.count(), active: scareT > 0 },
      camera: { x: f2(camera.position.x), y: f2(camera.position.y), z: f2(camera.position.z) },
      yaw: f2(yaw),
      toysInFlight: flying.length,
    };
  }

  function teleport(x, y, z) {
    body.pos.x = x; body.pos.y = y; body.pos.z = z;
    body.vel.x = body.vel.y = body.vel.z = 0;
  }

  function placeSeeker(x, z, facing) {
    seeker.reset(0, 0);
    sleepLeft = 0;
    seeker.x = x;
    seeker.z = z;
    seeker.facing = facing;
    prevBolt = { x, z };
  }

  function collectAllBones() { for (const b of boneMeshes) collectBone(b); }

  function dispose() {
    endScare();
    restoreMusic();
    scareEl.remove();
    panic.remove();
    style.remove();
    scene.remove(world);
    scene.background = prevBackground;
    scene.fog = null;
    world.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
  }

  reset();
  applyScary(ctx.getScary());
  pushHud(true);
  return { update, frame, state, teleport, placeSeeker, collectAllBones, dispose, restart: reset, isFinished: () => finished };
}
