import * as THREE from 'three';
import { stepBody } from '../physics.js';
import { buildCharacter, animateCharacter, CHARACTERS } from '../characters.js';
import { createSeeker, STANCE_NOISE } from './seeker.js';
import {
  START, EXIT, CARD_RADIUS, SEEKER, SOLIDS, CARDS, WAYPOINTS, NAV, STANCE_SPEED,
  movers, sighters, isHidden, stanceFor, roomIdAt, createBelRun, SPEED_PER_CARD, SPEED_CAP,
} from './belair-layout.js';
import { buildSchool, buildCard, buildBeam } from './belair-scene.js';

const CAM_DIST = 6.5, CAM_HEIGHT = 3.8;
const CAM_BOX = { minX: -23, maxX: 22.4, minZ: -7.2, maxZ: 28.3 };
const DEV_SPEED = 1.6;
const TUNE = 'game';
const TICKLE_SECONDS = 1.5, SLEEP_AFTER_CATCH = 2.5, START_SLEEP = 2.5;
const PLAIN_SECONDS = 12, SUIT_SECONDS = 9;
const DANCE_SECONDS = 1.6, STUN_SECONDS = 3.5, DANCE_COOLDOWN = 18, DANCE_RANGE = 12;
const BUZZ_SPEED = 1.3, BUZZ_LINE = { z: -2.9, x0: -15, x1: 1 };
const LIGHT = { gentle: { hemi: 1.35, dir: 0.7, sky: 0x1a2050, lantern: 0 }, scary: { hemi: 0.07, dir: 0.03, sky: 0x05061a, lantern: 6 } };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const f2 = (n) => Number(n.toFixed(2));

export function startBelAir(ctx) {
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

  const school = buildSchool();
  world.add(school.group);

  const cardMeshes = CARDS.map((c) => {
    const m = buildCard();
    m.position.set(c.x, c.y, c.z);
    world.add(m);
    return { id: c.id, mesh: m, base: c.y };
  });

  const charDef = CHARACTERS.find((c) => c.id === ctx.character) || CHARACTERS[0];
  const player = buildCharacter(charDef.id);
  world.add(player);

  const grinch = new THREE.Group();
  const grinchPlain = buildCharacter('grinch');
  const grinchSuit = buildCharacter('beegrinch');
  const beam = buildBeam();
  grinch.add(grinchPlain, grinchSuit, beam);
  world.add(grinch);

  const buzz = buildCharacter('bee');
  world.add(buzz);

  const seeker = createSeeker({ waypoints: WAYPOINTS, boxes: movers, sightBoxes: sighters, nav: NAV, patrolSpeed: SEEKER.patrol, chaseSpeed: SEEKER.chase });

  const panic = document.createElement('button');
  panic.id = 'panic-btn';
  panic.className = 'btn gold small hidden';
  panic.textContent = 'Calm down';
  panic.style.cssText = 'position:absolute;right:2vmin;top:2vmin;';
  (document.getElementById('ui') || document.body).appendChild(panic);
  panic.addEventListener('click', () => ctx.setScary(false));

  let run = createBelRun();
  const body = { pos: { ...START }, vel: { x: 0, y: 0, z: 0 }, onGround: false, ridingId: null };
  let yaw = 0, animT = 0, hudT = 0;
  let finished = false, lastResult = null, exitOpen = false;
  let noise = 0, stance = 'still', hidden = false;
  let caughtT = 0, sleepLeft = 0, danceT = 0, danceCd = 0, stunT = 0;
  let appliedScary = null;
  let buildUp = false, buildT = 0, buildSince = 0, musicDropped = false;
  let disguised = false, disguiseT = PLAIN_SECONDS, tellShown = false;
  let prevG = { x: 0, z: 0 };
  let buzzX = BUZZ_LINE.x0, buzzDir = 1, buzzWait = 0, buzzTold = 0;

  const farthestWp = () => {
    let best = 0, bd = -1;
    WAYPOINTS.forEach((w, i) => { const d = Math.hypot(w.x - START.x, w.z - START.z); if (d > bd) { bd = d; best = i; } });
    return best;
  };

  function sleepSeeker(seconds) {
    seeker.reset(farthestWp(), seconds);
    sleepLeft = seconds;
    prevG = { x: seeker.x, z: seeker.z };
  }

  function respawnPlayer() {
    body.pos.x = START.x; body.pos.y = START.y; body.pos.z = START.z;
    body.vel.x = body.vel.y = body.vel.z = 0;
    body.onGround = false;
    body.ridingId = null;
    yaw = 0;
    player.rotation.y = Math.PI / 2;
  }

  function setDisguise(on) {
    disguised = on;
    disguiseT = on ? SUIT_SECONDS : PLAIN_SECONDS;
    tellShown = false;
    grinchPlain.visible = !on;
    grinchSuit.visible = on;
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

  function refreshSpeed() {
    const base = appliedScary ? SEEKER.scaryScale : 1;
    seeker.setSpeedScale(Math.min(SPEED_CAP, 1 + SPEED_PER_CARD * run.cardCount()) * base);
  }

  function applyScary(on) {
    appliedScary = on;
    const L = on ? LIGHT.scary : LIGHT.gentle;
    hemi.intensity = L.hemi;
    dir.intensity = L.dir;
    lantern.intensity = L.lantern;
    scene.background = new THREE.Color(L.sky);
    refreshSpeed();
    panic.classList.toggle('hidden', !on);
    if (!on) restoreMusic();
  }

  const say = (text) => ui.toast(text, 2200, 'The Grinch says');

  function onCaught() {
    run.caught();
    caughtT = TICKLE_SECONDS;
    say('Gotcha! Tickle tickle!');
    audio?.sfx('tickle');
  }

  function openExit() {
    exitOpen = true;
    school.setExitOpen(true);
    audio?.sfx('door');
    ui.toast(`All ${CARDS.length} Bee Key Cards! The exit is open. Run for the door!`, 3500);
  }

  function collectCard(c) {
    if (!c.mesh.visible || !run.collect(c.id)) return;
    c.mesh.visible = false;
    refreshSpeed();
    audio?.sfx('bone');
    if (!run.canExit()) ui.toast(`Bee Key Card ${run.cardCount()} of ${CARDS.length}!`, 1800);
  }

  function win() {
    finished = true;
    lastResult = run.win(store, ctx.getDev());
    audio?.sfx('win');
    ctx.onWin(lastResult);
  }

  function tryDance() {
    if (danceCd > 0 || caughtT > 0 || finished || danceT > 0) return;
    const d = Math.hypot(seeker.x - body.pos.x, seeker.z - body.pos.z);
    if (d > DANCE_RANGE) {
      ui.toast('Save your DJ Dance for when the Grinch is close!', 2200, 'DJ Marshmallow');
      return;
    }
    danceT = DANCE_SECONDS;
    stunT = STUN_SECONDS;
    danceCd = DANCE_COOLDOWN;
    audio?.sfx('boing');
    ui.toast('DJ Dance! The Grinch cannot stop dancing!', 2200, 'DJ Marshmallow');
  }

  function reset() {
    run = createBelRun();
    refreshSpeed();
    noise = 0;
    finished = false;
    lastResult = null;
    exitOpen = false;
    school.setExitOpen(false);
    caughtT = 0;
    danceT = 0;
    danceCd = 0;
    stunT = 0;
    for (const c of cardMeshes) c.mesh.visible = true;
    setDisguise(false);
    buzzX = BUZZ_LINE.x0;
    buzzDir = 1;
    buzzWait = 0;
    buzzTold = 0;
    restoreMusic();
    respawnPlayer();
    sleepSeeker(START_SLEEP);
    ui.clearToast();
  }

  function pushHud(force) {
    hudT -= 1;
    if (!force && hudT > 0) return;
    hudT = 6;
    ctx.setHud({ time: run.time(), bonesRun: run.cardCount(), bonesMax: CARDS.length, itemLabel: 'CARDS', noise, hidden, dance: Math.ceil(danceCd) });
  }

  function updateBuzz(dt) {
    if (buzzWait > 0) buzzWait -= dt;
    else {
      buzzX += buzzDir * BUZZ_SPEED * dt;
      if (buzzX >= BUZZ_LINE.x1) { buzzX = BUZZ_LINE.x1; buzzDir = -1; buzzWait = 1.2; }
      else if (buzzX <= BUZZ_LINE.x0) { buzzX = BUZZ_LINE.x0; buzzDir = 1; buzzWait = 1.2; }
    }
    buzz.position.set(buzzX, 0, BUZZ_LINE.z);
    buzz.rotation.y = buzzDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    animateCharacter(buzz, animT, { moving: buzzWait <= 0, airborne: false });
    if (buzzTold > 0) buzzTold -= dt;
    else if (Math.hypot(buzzX - body.pos.x, BUZZ_LINE.z - body.pos.z) < 2.2) {
      buzzTold = 10;
      ui.toast('Bzzz! I am Buzz the Bee. I am a friend. Watch out for a green bee!', 3000, 'Buzz says');
    }
  }

  function update(dt) {
    animT += dt;
    const dev = ctx.getDev();
    const sc = ctx.getScary();
    if (sc !== appliedScary) applyScary(sc);

    const raw = input.read();
    yaw += raw.lookDeltaX;
    const frozen = finished || caughtT > 0 || danceT > 0;
    const inp = frozen ? { ...raw, moveX: 0, moveZ: 0, jump: false, tiptoe: false } : raw;
    if (raw.throwPressed) tryDance();
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

    if (danceCd > 0) danceCd = Math.max(0, danceCd - dt);
    if (danceT > 0) danceT -= dt;

    if (!finished) {
      for (const c of cardMeshes) {
        const def = CARDS.find((q) => q.id === c.id);
        if (c.mesh.visible && Math.hypot(def.x - body.pos.x, def.z - body.pos.z) < CARD_RADIUS) collectCard(c);
      }
      if (!exitOpen && run.canExit()) openExit();
      if (exitOpen && Math.hypot(EXIT.x - body.pos.x, EXIT.z - body.pos.z) < EXIT.radius) win();
    }

    if (sleepLeft > 0) sleepLeft -= dt;
    if (!finished) {
      disguiseT -= dt;
      if (disguiseT <= 0) setDisguise(!disguised);
      if (disguised && !tellShown && Math.hypot(seeker.x - body.pos.x, seeker.z - body.pos.z) < 7) {
        tellShown = true;
        ui.toast('Wait... that bee has a green face!', 2200);
      }
      if (caughtT > 0) {
        caughtT -= dt;
        if (caughtT <= 0) {
          respawnPlayer();
          sleepSeeker(SLEEP_AFTER_CATCH);
          restoreMusic();
        }
      } else if (stunT > 0) {
        stunT -= dt;
        restoreMusic();
      } else {
        const events = seeker.step(dt, { player: { x: body.pos.x, z: body.pos.z }, hidden: hidden || dev, stance });
        for (const e of events) {
          if (e === 'spotted') { say('Hey! I see you!'); if (appliedScary) startBuildUp(); }
          else if (e === 'heard') say('Did I hear something?');
          else if (e === 'lost') { say('Hmm... where did you go?'); restoreMusic(); }
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

    player.position.set(body.pos.x, body.pos.y, body.pos.z);
    lantern.position.set(body.pos.x, body.pos.y + 2.6, body.pos.z);
    const moving = Math.hypot(wx, wz) > 0.1;
    if (moving) player.rotation.y = Math.atan2(wx, wz);
    animateCharacter(player, animT, { moving: moving && body.onGround, airborne: false, griddy: finished || danceT > 0 });

    grinch.position.set(seeker.x, 0, seeker.z);
    grinch.rotation.y = stunT > 0 ? animT * 6 : seeker.facing;
    const moved = Math.hypot(seeker.x - prevG.x, seeker.z - prevG.z) > 0.4 * dt;
    prevG = { x: seeker.x, z: seeker.z };
    const gm = stunT > 0 ? { moving: false, griddy: true } : { moving: moved, griddy: false };
    animateCharacter(disguised ? grinchSuit : grinchPlain, animT, { ...gm, airborne: false });
    beam.visible = !disguised && sleepLeft <= 0 && stunT <= 0 && seeker.state !== 'tickle';

    updateBuzz(dt);

    for (const c of cardMeshes) {
      c.mesh.rotation.y = animT * 2.2;
      c.mesh.position.y = c.base + Math.sin(animT * 3 + c.base) * 0.1;
    }

    pushHud(false);
  }

  function frame() {
    const cx = clamp(body.pos.x + Math.sin(yaw) * CAM_DIST, CAM_BOX.minX, CAM_BOX.maxX);
    const cz = clamp(body.pos.z + Math.cos(yaw) * CAM_DIST, CAM_BOX.minZ, CAM_BOX.maxZ);
    const pulledIn = 1 - Math.hypot(cx - body.pos.x, cz - body.pos.z) / CAM_DIST;
    const cy = body.pos.y + CAM_HEIGHT + Math.max(0, pulledIn) * 3;
    school.lowerWalls(cx, cz, body.pos.x, body.pos.z);
    camera.position.set(cx, cy, cz);
    camera.lookAt(body.pos.x, body.pos.y + 1.2, body.pos.z);
  }

  function state() {
    return {
      level: 'belair',
      player: { x: f2(body.pos.x), y: f2(body.pos.y), z: f2(body.pos.z), hidden, onGround: body.onGround },
      stance,
      room: { player: roomIdAt(body.pos.x, body.pos.z), seeker: roomIdAt(seeker.x, seeker.z) },
      noise: f2(noise),
      cards: run.cardCount(),
      exitOpen,
      caught: run.caughtCount(),
      time: f2(run.time()),
      finished,
      result: lastResult,
      scary: !!appliedScary,
      lighting: f2(hemi.intensity),
      disguised,
      dance: { cooldown: f2(danceCd), dancing: danceT > 0, stunned: stunT > 0 },
      seeker: { x: f2(seeker.x), z: f2(seeker.z), facing: f2(seeker.facing), state: seeker.state, asleep: sleepLeft > 0 },
      buzz: { x: f2(buzzX), z: BUZZ_LINE.z },
      camera: { x: f2(camera.position.x), y: f2(camera.position.y), z: f2(camera.position.z) },
      yaw: f2(yaw),
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
    prevG = { x, z };
  }

  function collectAllCards() { for (const c of cardMeshes) collectCard(c); }

  function dispose() {
    restoreMusic();
    panic.remove();
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
  return {
    update, frame, state, teleport, placeSeeker, collectAllCards, setDisguise, dispose,
    restart: reset, isFinished: () => finished,
  };
}
