import * as THREE from 'three';
import { buildFootballPlayer, buildPearson8, buildGiantZombie, animateFootball, setFlags, setZombie, disposeObject } from '../football-characters.js';
import { buildField, buildCooler, buildPickup, buildSoakBeam, buildBalloon } from './football-scene.js';
import { FIELD } from './football-layout.js';
import { TUNE, createMoves } from './football-ai.js';
import { BLITZ, createBlitz } from './blitz-logic.js';
import { recordRun } from '../rules.js';

const CAM_UP = 9, CAM_BACK = 11, CAM_FOLLOW_X = 0.6, CAM_MAX_Z = 42;
const START = { x: 0, z: 26 };
const SOAK_COOLDOWN = 0.2, BEAM_SECONDS = 0.18, BALLOON_SECONDS = 0.4, CHEER_SECONDS = 1.4, SIDELINE_X = 15.5;
const PICKUP_RADIUS = 1.2, AIM_ASSIST = 0.9, JUKE_SHOVE = 2.2;
const STEELER_NUMBERS = [52, 90, 34, 58, 21, 77, 43];
const MATE_NUMBERS = [22, 31, 15, 44, 12, 80];
const SPOTS = [[-8, 14], [8, 4], [-5, -2], [5, 18], [0, 9], [-9, -8], [9, -6], [-2, 20]];
const LOOKS = {
  gentle: { sky: 0x74b9f0, hemi: 0xffffff, hemiI: 1.25, sun: 0xffffff, sunI: 0.95, sick: false },
  scary: { sky: 0x1f2f2a, hemi: 0x9fd09a, hemiI: 0.6, sun: 0xb6ffb0, sunI: 0.4, sick: true },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const f2 = (n) => Number(n.toFixed(2));

export function startBlitz(ctx) {
  const { scene, camera, input, store, ui, audio } = ctx;
  const world = new THREE.Group();
  scene.add(world);
  const prevBackground = scene.background;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x446644, 1.25);
  const sun = new THREE.DirectionalLight(0xffffff, 0.95);
  sun.position.set(6, 14, 8);
  world.add(hemi, sun);

  const field = buildField();
  world.add(field.group);
  const cooler = buildCooler();
  cooler.position.set(BLITZ.COOLER.x, 0, BLITZ.COOLER.z);
  world.add(cooler);

  const player = buildPearson8();
  setFlags(player, 0);
  world.add(player);
  const beam = buildSoakBeam();
  world.add(beam);
  const balloon = buildBalloon();
  balloon.visible = false;
  world.add(balloon);
  const pickupGroup = new THREE.Group();
  world.add(pickupGroup);

  let blitz = null, gentle = true;
  let moves = createMoves();
  const runner = { x: START.x, z: START.z, vx: 0, vz: 0, facing: Math.PI };
  const views = new Map();
  let pickups = [];
  let phase = 'play', finished = false, lastResult = null;
  let time = 0, animT = 0, hudT = 0, cam = { x: 0, z: 0 };
  let prevTiptoe = false, jukeSlide = 0;
  let soakCd = 0, beamT = 0, balloonT = 0, balloonFrom = null, balloonTo = null, dryToastCd = 0;
  let curedBase = 0, curedWave = 0;

  function applyLook() {
    const look = LOOKS[gentle ? 'gentle' : 'scary'];
    scene.background = new THREE.Color(look.sky);
    hemi.color.setHex(look.hemi);
    hemi.intensity = look.hemiI;
    sun.color.setHex(look.sun);
    sun.intensity = look.sunI;
    field.setZombieSky(look.sick);
  }

  function clearPickups() {
    pickups.forEach((p) => { pickupGroup.remove(p.mesh); disposeObject(p.mesh); });
    pickups = [];
  }

  function spawnPickups() {
    clearPickups();
    const base = (blitz.wave() * 3) % SPOTS.length;
    for (let k = 0; k < 5; k++) {
      const kind = k < 2 ? 'gun' : 'balloon';
      const [x, z] = SPOTS[(base + k) % SPOTS.length];
      const mesh = buildPickup(kind);
      mesh.position.set(x, 0, z);
      pickupGroup.add(mesh);
      pickups.push({ kind, x, z, mesh });
    }
  }

  function removeView(id) {
    const v = views.get(id);
    if (!v) return;
    world.remove(v.mesh);
    disposeObject(v.mesh);
    views.delete(id);
  }

  function ensureView(f) {
    if (views.has(f.id)) return;
    let mesh;
    if (f.kind === 'giant') mesh = buildGiantZombie();
    else if (f.kind === 'mate') {
      const i = Number(f.id.slice(1));
      mesh = buildFootballPlayer({ team: 'bengals', number: MATE_NUMBERS[i % MATE_NUMBERS.length], variant: i + 1, lod: true });
    } else {
      const i = Number(f.id.split('_')[1]);
      mesh = buildFootballPlayer({ team: 'steelers', number: STEELER_NUMBERS[i % STEELER_NUMBERS.length], variant: i + 1, zombie: true, lod: true });
    }
    world.add(mesh);
    views.set(f.id, { mesh, curedT: 0, wasState: f.state });
  }

  function syncViews() {
    const ids = new Set(blitz.foes.map((f) => f.id));
    for (const id of [...views.keys()]) if (!ids.has(id)) removeView(id);
    blitz.foes.forEach(ensureView);
  }

  function toast(text, ms = 1500) { ui.toast(text, ms); }

  function resetPlayer() {
    runner.x = START.x;
    runner.z = START.z;
    runner.vx = runner.vz = 0;
    runner.facing = Math.PI;
    moves = createMoves();
    jukeSlide = 0;
  }

  function reset() {
    gentle = !ctx.getScary();
    applyLook();
    for (const id of [...views.keys()]) removeView(id);
    blitz = createBlitz({ gentle });
    finished = false;
    lastResult = null;
    phase = 'play';
    time = 0;
    curedBase = curedWave = 0;
    soakCd = beamT = balloonT = dryToastCd = 0;
    beam.visible = false;
    balloon.visible = false;
    resetPlayer();
    cam = { x: 0, z: runner.z + CAM_BACK };
    syncViews();
    spawnPickups();
    ui.clearToast();
    toast('Wave 1! Soak the zombie Steelers with water!', 2200);
    pushHud(true);
  }

  function pushHud(force) {
    hudT -= 1;
    if (!force && hudT > 0) return;
    hudT = 6;
    ctx.setHud({
      time, bonesRun: blitz.hearts(), bonesMax: gentle ? BLITZ.heartsGentle : BLITZ.heartsNormal, itemLabel: 'HEARTS',
      down: `WAVE ${blitz.wave()} of 4`, ammo: blitz.ammo.gun + blitz.ammo.balloon,
    });
  }

  function win() {
    if (finished) return;
    finished = true;
    phase = 'won';
    const { isBest, best } = recordRun(store, 'blitz', time, ctx.getDev());
    lastResult = { time, isBest, best, summary: `Zombies cured: ${curedBase + curedWave}` };
    audio?.sfx('win');
    ctx.onWin(lastResult);
  }

  function aimVector() {
    const fx = Math.sin(runner.facing), fz = Math.cos(runner.facing);
    let best = null, bestD = Infinity;
    for (const f of blitz.foes) {
      if (f.state !== 'zombie') continue;
      const dx = f.x - runner.x, dz = f.z - runner.z, d = Math.hypot(dx, dz);
      if (d < 0.05 || d > BLITZ.gunRange) continue;
      if (Math.acos(clamp((dx * fx + dz * fz) / d, -1, 1)) > AIM_ASSIST) continue;
      if (d < bestD) { best = { x: dx / d, z: dz / d }; bestD = d; }
    }
    return { aim: best || { x: fx, z: fz }, dist: best ? bestD : BLITZ.gunRange };
  }

  function soak() {
    const usingGun = blitz.ammo.gun > 0;
    const { aim, dist } = aimVector();
    const res = blitz.soak(runner, aim);
    if (res === 'dry') return res;
    const heading = Math.atan2(aim.x, aim.z);
    if (usingGun) {
      beam.rotation.y = heading;
      beam.position.set(runner.x, 1.3, runner.z);
      beam.userData.set(Math.max(1.5, Math.min(dist, BLITZ.gunRange)), animT);
      beam.visible = true;
      beamT = BEAM_SECONDS;
    } else {
      balloonFrom = { x: runner.x, z: runner.z };
      balloonTo = { x: runner.x + aim.x * BLITZ.balloonRange, z: runner.z + aim.z * BLITZ.balloonRange };
      balloonT = BALLOON_SECONDS;
      balloon.visible = true;
    }
    audio?.sfx('boing');
    return res;
  }

  function moveRunner(dt, raw) {
    const dx = raw.moveX, dz = -raw.moveZ;
    const len = Math.hypot(dx, dz);
    const moving = len > 0.1;
    const sprintHeld = raw.jump && moving;
    const speed = moves.speed(sprintHeld) * Math.min(1, len);
    runner.vx = moving ? (dx / len) * speed : 0;
    runner.vz = moving ? (dz / len) * speed : 0;
    if (moving) runner.facing = Math.atan2(dx, dz);
    if (raw.tiptoe && !prevTiptoe) {
      const before = runner.x;
      moves.tryJuke(runner, [], dx !== 0 ? Math.sign(dx) : -1);
      if (runner.x !== before) {
        jukeSlide += before - runner.x;
        audio?.sfx('boing');
        for (const f of blitz.foes) {
          if (f.state !== 'zombie') continue;
          const ox = f.x - runner.x, oz = f.z - runner.z, d = Math.hypot(ox, oz);
          if (d > TUNE.jukeRange || d < 1e-6) continue;
          f.x += (ox / d) * JUKE_SHOVE;
          f.z += (oz / d) * JUKE_SHOVE;
        }
      }
    }
    if (raw.throwPressed && soakCd <= 0) {
      soakCd = SOAK_COOLDOWN;
      if (soak() === 'dry' && dryToastCd <= 0) {
        dryToastCd = 2;
        toast('Out of water! Run to the cooler!', 1600);
      }
    }
    moves.update(dt, sprintHeld);
    runner.x = clamp(runner.x + runner.vx * dt, FIELD.minX + 0.5, FIELD.maxX - 0.5);
    runner.z = clamp(runner.z + runner.vz * dt, FIELD.goalZ - 6, FIELD.backZ);
    return { moving, sprinting: sprintHeld && moves.sprintLeft() > 0 };
  }

  function handleEvents(events) {
    for (const e of events) {
      if (e === 'cured') { curedWave += 1; audio?.sfx('bone'); }
      else if (e === 'infected') toast('Oh no! A teammate turned into a zombie. Soak them!', 1800);
      else if (e === 'hurt') { audio?.sfx('boing'); toast('Ouch! A zombie got you!', 1100); }
      else if (e === 'wave') {
        curedBase += curedWave;
        curedWave = 0;
        spawnPickups();
        toast(blitz.wave() === 4 ? 'The giant zombie! Soak him again and again!' : `Wave ${blitz.wave()} of 4!`, 2200);
      } else if (e === 'roundRestart') {
        curedWave = 0;
        resetPlayer();
        spawnPickups();
        toast('The zombies got you! Try this wave again.', 2200);
      } else if (e === 'won') win();
    }
  }

  function collectPickups() {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      if (Math.hypot(p.x - runner.x, p.z - runner.z) > PICKUP_RADIUS) continue;
      blitz.pickup(p.kind);
      pickupGroup.remove(p.mesh);
      disposeObject(p.mesh);
      pickups.splice(i, 1);
      audio?.sfx('bone');
      toast(p.kind === 'gun' ? 'Water gun filled up!' : `${BLITZ.balloonPerPickup} water balloons!`, 1100);
    }
    if (blitz.ammo.gun < BLITZ.gunMax && blitz.refillAtCooler(runner)) {
      audio?.sfx('bone');
      toast('Water gun refilled at the cooler!', 1100);
    }
  }

  function updateViews(dt) {
    for (const f of blitz.foes) {
      const v = views.get(f.id);
      if (!v) continue;
      const m = v.mesh;
      const toPlayer = Math.atan2(runner.x - f.x, runner.z - f.z);
      if (f.state === 'zombie') {
        setZombie(m, true);
        m.visible = true;
        m.position.set(f.x, 0, f.z);
        m.rotation.y = toPlayer;
        animateFootball(m, animT, { moving: true });
      } else if (f.state === 'helper') {
        setZombie(m, false);
        v.curedT += dt;
        const near = Math.hypot(runner.x - f.x, runner.z - f.z) < 1.9;
        m.position.set(f.x, 0, f.z);
        m.rotation.y = toPlayer;
        animateFootball(m, animT, { moving: !near, sprint: false, griddy: v.curedT < CHEER_SECONDS });
      } else if (f.state === 'cured') {
        setZombie(m, false);
        v.curedT += dt;
        if (v.curedT < CHEER_SECONDS) {
          m.rotation.y = 0;
          animateFootball(m, animT, { griddy: true });
        } else if (Math.abs(f.x) < SIDELINE_X) {
          f.x += (f.x < 0 ? -1 : 1) * 5 * dt;
          m.rotation.y = f.x < 0 ? -Math.PI / 2 : Math.PI / 2;
          animateFootball(m, animT, { moving: true });
        } else {
          m.visible = false;
        }
        if (m.visible) m.position.set(f.x, 0, f.z);
      } else {
        m.position.set(f.x, 0, f.z);
        m.rotation.y = toPlayer;
        animateFootball(m, animT, { moving: false });
      }
    }
  }

  function update(dt) {
    animT += dt;
    soakCd = Math.max(0, soakCd - dt);
    dryToastCd = Math.max(0, dryToastCd - dt);
    const raw = input.read();
    let gait = { moving: false, sprinting: false };

    if (phase === 'play') {
      time += dt;
      gait = moveRunner(dt, raw);
      collectPickups();
      handleEvents(blitz.step(dt, runner));
      if (blitz.isWon()) win();
      syncViews();
    } else {
      prevTiptoe = false;
    }
    if (phase === 'play') prevTiptoe = raw.tiptoe;

    jukeSlide *= Math.exp(-dt * 12);
    if (beamT > 0) {
      beamT -= dt;
      beam.visible = beamT > 0;
    }
    if (balloonT > 0) {
      balloonT -= dt;
      const k = clamp(1 - balloonT / BALLOON_SECONDS, 0, 1);
      balloon.position.set(
        balloonFrom.x + (balloonTo.x - balloonFrom.x) * k,
        1.4 + Math.sin(k * Math.PI) * 1.6 - k * 1.2,
        balloonFrom.z + (balloonTo.z - balloonFrom.z) * k,
      );
      balloon.visible = balloonT > 0;
    }

    player.position.set(runner.x + jukeSlide, 0, runner.z);
    player.rotation.y = runner.facing;
    player.visible = blitz.knockdownLeft() <= 0 || Math.floor(animT * 12) % 2 === 0;
    animateFootball(player, animT, { moving: gait.moving, sprint: gait.sprinting, griddy: phase === 'won' });

    updateViews(dt);
    for (const p of pickups) {
      const item = p.mesh.userData.item;
      item.position.y = 0.9 + Math.sin(animT * 3 + p.x) * 0.12;
      item.rotation.y += dt * 1.5;
    }

    cam.x += (runner.x * CAM_FOLLOW_X - cam.x) * Math.min(1, dt * 6);
    cam.z += (runner.z + CAM_BACK - cam.z) * Math.min(1, dt * 8);
    pushHud(false);
  }

  function frame() {
    camera.position.set(cam.x, CAM_UP, Math.min(cam.z, CAM_MAX_Z));
    camera.lookAt(runner.x * 0.75, 1, runner.z - 7);
  }

  function state() {
    const giant = blitz.foes.find((f) => f.kind === 'giant');
    return {
      level: 'blitz',
      player: { x: f2(runner.x), y: 0, z: f2(runner.z) },
      phase,
      wave: blitz.wave(),
      hearts: blitz.hearts(),
      ammo: { gun: blitz.ammo.gun, balloon: blitz.ammo.balloon },
      zombies: blitz.foes.filter((f) => f.state === 'zombie').length,
      helpers: blitz.foes.filter((f) => f.state === 'helper').length,
      giantHp: giant ? giant.hp : 0,
      knockdown: f2(blitz.knockdownLeft()),
      won: blitz.isWon(),
      foes: blitz.foes.map((f) => ({ id: f.id, kind: f.kind, x: f2(f.x), z: f2(f.z), state: f.state, hp: f.hp })),
      pickups: pickups.map((p) => ({ kind: p.kind, x: p.x, z: p.z })),
      finished,
      result: lastResult,
      time: f2(time),
      camera: { x: f2(camera.position.x), y: f2(camera.position.y), z: f2(camera.position.z) },
      scary: !gentle,
    };
  }

  function curedAll() {
    const saved = { gun: blitz.ammo.gun, balloon: blitz.ammo.balloon };
    blitz.ammo.gun = 999;
    let guard = 0;
    for (let z = blitz.foes.find((f) => f.state === 'zombie'); z && guard < 200; z = blitz.foes.find((f) => f.state === 'zombie')) {
      z.x = runner.x;
      z.z = runner.z - 1;
      blitz.soak(runner, { x: 0, z: -1 }, 'gun');
      guard += 1;
    }
    blitz.ammo.gun = saved.gun;
    blitz.ammo.balloon = saved.balloon;
    if (blitz.isWon()) win();
  }

  function dispose() {
    clearPickups();
    for (const id of [...views.keys()]) removeView(id);
    scene.remove(world);
    scene.background = prevBackground;
    disposeObject(world);
  }

  const noop = () => {};
  reset();
  return {
    update, frame, state, dispose,
    teleport: (x, y, z) => { runner.x = x; runner.z = z; },
    placeSeeker: noop, collectAllCards: noop, setDisguise: noop,
    blitzSoak: () => soak(),
    setFoe: (i, x, z) => { const f = blitz.foes[i]; if (f) { f.x = x; f.z = z; } },
    setAmmo: (gun, balloonCount) => { blitz.ammo.gun = gun; blitz.ammo.balloon = balloonCount; },
    setFacing: (a) => { runner.facing = a; },
    curedAll,
    restart: reset,
    isFinished: () => finished,
  };
}
