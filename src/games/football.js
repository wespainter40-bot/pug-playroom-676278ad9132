import * as THREE from 'three';
import { buildFootballPlayer, buildPearson8, buildFootball, animateFootball, setFlags, disposeObject } from '../football-characters.js';
import { buildField } from './football-scene.js';
import {
  FIELD, DOWNS, TOUCHDOWNS_TO_WIN, SHOT_CLOCK, BACKFIELD, defenderSpawns, createFootballRun,
} from './football-layout.js';
import { startBlitz } from './football-blitz.js';
import { TUNE, createMoves, createDefender, stepDefender, separateDefenders } from './football-ai.js';

const HANDOFF_SECONDS = 0.8;
const DEAD_SECONDS = 1.3;
const SCORE_SECONDS = 1.8;
const CAM_UP = 9, CAM_BACK = 11, CAM_FOLLOW_X = 0.6, CAM_MAX_Z = 42;
const SKY = 0x74b9f0;
const STEELER_NUMBERS = [52, 90, 34, 58, 21, 77, 43];
const END_TEXT = { flag: 'Flag pulled!', out: 'Out of bounds!', timeout: 'Time is up!' };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const f2 = (n) => Number(n.toFixed(2));

export function startFootball(ctx, mode) {
  if (mode === 'blitz') return startBlitz(ctx);
  const { scene, camera, input, store, ui, audio } = ctx;
  const world = new THREE.Group();
  scene.add(world);

  const prevBackground = scene.background;
  scene.background = new THREE.Color(SKY);
  world.add(new THREE.HemisphereLight(0xffffff, 0x446644, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 0.95);
  sun.position.set(6, 14, 8);
  world.add(sun);

  world.add(buildField().group);

  const player = buildPearson8();
  const qb = buildFootballPlayer({ team: 'bengals', number: 9, variant: 3, lod: true });
  const handBall = buildFootball();
  world.add(player, qb, handBall);

  const defenders = defenderSpawns(0).map((_, i) => createDefender(i, 0, 0));
  const meshes = defenders.map((_, i) => buildFootballPlayer({ team: 'steelers', number: STEELER_NUMBERS[i], variant: i + 1, lod: true }));
  meshes.forEach((m) => world.add(m));

  let run = createFootballRun();
  let moves = createMoves();
  const runner = { x: 0, z: 0, vx: 0, vz: 0, facing: Math.PI };
  let phase = 'handoff', phaseT = 0, downT = 0, lastEnd = null;
  let animT = 0, hudT = 0, finished = false, lastResult = null;
  let prevTiptoe = false, jukeSlide = 0, spinVis = 0;
  let flagsOn = 2, qbZ = 0;
  let cam = { x: 0, z: 0 };

  const setPhase = (p, t = 0) => { phase = p; phaseT = t; };

  function startDown() {
    const scrim = run.scrimZ();
    runner.x = 0;
    runner.z = scrim + BACKFIELD;
    runner.vx = runner.vz = 0;
    runner.facing = Math.PI;
    moves = createMoves();
    spinVis = 0;
    jukeSlide = 0;
    downT = 0;
    flagsOn = 2;
    setFlags(player, flagsOn);
    defenderSpawns(scrim).forEach((p, i) => Object.assign(defenders[i], { x: p.x, z: p.z, facing: 0, state: 'set', fooledT: 0 }));
    qbZ = runner.z + 1.7;
    qb.position.set(0, 0, qbZ);
    qb.rotation.y = Math.PI;
    setPhase('handoff', HANDOFF_SECONDS);
    ui.clearToast();
  }

  function snap() {
    if (phase !== 'handoff') return;
    for (const d of defenders) d.state = 'chase';
    setPhase('live');
  }

  function endDown(reason) {
    if (phase !== 'live') return;
    lastEnd = reason;
    const res = run.endDown(reason, runner.z);
    if (reason === 'flag') {
      flagsOn = Math.max(0, flagsOn - 1);
      setFlags(player, flagsOn);
      audio?.sfx('boing');
    }
    runner.vx = runner.vz = 0;
    ui.toast(res.next === 'turnover' ? `${END_TEXT[reason]} Steelers ball! New drive.` : END_TEXT[reason], 1400);
    setPhase('dead', DEAD_SECONDS);
  }

  function score() {
    lastEnd = 'touchdown';
    runner.vx = runner.vz = 0;
    const { won } = run.touchdown();
    audio?.sfx('bone');
    if (won) {
      finished = true;
      lastResult = run.win(store, ctx.getDev());
      audio?.sfx('win');
      setPhase('won');
      ctx.onWin(lastResult);
    } else {
      ui.toast(`Touchdown! ${run.touchdowns()} of ${TOUCHDOWNS_TO_WIN}`, 1600);
      setPhase('scored', SCORE_SECONDS);
    }
  }

  function reset() {
    run = createFootballRun();
    finished = false;
    lastResult = null;
    lastEnd = null;
    cam = { x: 0, z: 0 };
    startDown();
    cam.x = runner.x * CAM_FOLLOW_X;
    cam.z = runner.z + CAM_BACK;
    pushHud(true);
  }

  function pushHud(force) {
    hudT -= 1;
    if (!force && hudT > 0) return;
    hudT = 6;
    ctx.setHud({
      time: run.time(), bonesRun: run.touchdowns(), bonesMax: TOUCHDOWNS_TO_WIN, itemLabel: 'TOUCHDOWNS',
      down: `DOWN ${run.down()} of ${DOWNS}`,
    });
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
      moves.tryJuke(runner, defenders, dx !== 0 ? Math.sign(dx) : -1);
      if (runner.x !== before) { jukeSlide += before - runner.x; audio?.sfx('boing'); }
    }
    if (raw.throwPressed && moves.trySpin()) spinVis = TUNE.spinSeconds;
    moves.update(dt, sprintHeld);
    runner.x += runner.vx * dt;
    runner.z = Math.min(FIELD.backZ, runner.z + runner.vz * dt);
    return { moving, sprinting: sprintHeld && moves.sprintLeft() > 0 };
  }

  function update(dt) {
    animT += dt;
    const raw = input.read();
    const live = phase === 'live';
    let gait = { moving: false, sprinting: false };

    if (phase === 'handoff') {
      phaseT -= dt;
      if (phaseT <= 0) snap();
    } else if (phase === 'dead' || phase === 'scored') {
      phaseT -= dt;
      if (phaseT <= 0) startDown();
    }
    if (!finished && phase !== 'won') run.tick(dt);

    if (live) {
      gait = moveRunner(dt, raw);
      downT += dt;
      if (runner.z < FIELD.goalZ) {
        runner.x = clamp(runner.x, FIELD.minX, FIELD.maxX);
        score();
      } else if (runner.x < FIELD.minX || runner.x > FIELD.maxX) {
        runner.x = clamp(runner.x, FIELD.minX, FIELD.maxX);
        endDown('out');
      } else {
        for (const d of defenders) {
          const r = stepDefender(d, runner, dt, { moves, speedScale: 1 });
          if (r === 'pulled') { endDown('flag'); break; }
          if (r === 'slipped') ui.toast('Spin move! You slipped away!', 900);
        }
        separateDefenders(defenders);
        if (phase === 'live' && downT >= SHOT_CLOCK) endDown('timeout');
      }
    } else {
      raw.tiptoe = false;
    }
    prevTiptoe = raw.tiptoe;

    jukeSlide *= Math.exp(-dt * 12);
    if (spinVis > 0) spinVis = Math.max(0, spinVis - dt);

    const celebrate = phase === 'won' || phase === 'scored';
    const spin = spinVis > 0 ? (1 - spinVis / TUNE.spinSeconds) * Math.PI * 2 : 0;
    player.position.set(runner.x + jukeSlide, 0, runner.z);
    player.rotation.y = runner.facing + spin;
    animateFootball(player, animT, {
      moving: gait.moving, sprint: gait.sprinting, griddy: celebrate, noBall: phase === 'handoff' && phaseT > HANDOFF_SECONDS * 0.5,
    });

    animateFootball(qb, animT, { moving: false, griddy: celebrate });
    const hand = phase === 'handoff' ? 1 - phaseT / HANDOFF_SECONDS : 1;
    handBall.visible = phase === 'handoff' && phaseT > HANDOFF_SECONDS / 2;
    handBall.position.set(0, 1.05, qbZ + (runner.z - qbZ) * clamp(hand * 2, 0, 1));

    defenders.forEach((d, i) => {
      const m = meshes[i];
      m.position.set(d.x, 0, d.z);
      m.rotation.y = d.facing;
      const chasing = d.state === 'chase' && phase === 'live';
      animateFootball(m, animT + i, { moving: chasing, sprint: chasing, griddy: finished && i % 2 === 0 });
      if (d.state === 'fooled') m.rotation.x = -0.3;
    });

    cam.x += (runner.x * CAM_FOLLOW_X - cam.x) * Math.min(1, dt * 6);
    cam.z += (runner.z + CAM_BACK - cam.z) * Math.min(1, dt * 8);

    pushHud(false);
  }

  function frame() {
    camera.position.set(cam.x, CAM_UP, Math.min(cam.z, CAM_MAX_Z));
    camera.lookAt(runner.x * 0.75, 1, runner.z - 7);
  }

  function state() {
    return {
      level: 'football',
      player: { x: f2(runner.x), y: 0, z: f2(runner.z) },
      phase,
      lastEnd,
      down: run.down(),
      touchdowns: run.touchdowns(),
      scrimZ: f2(run.scrimZ()),
      defenders: defenders.map((d) => ({ x: f2(d.x), z: f2(d.z), state: d.state })),
      sprintLeft: f2(moves.sprintLeft()),
      jukeReady: moves.jukeReady(),
      spinReady: moves.spinReady(),
      flagsOn,
      shotClock: f2(Math.max(0, SHOT_CLOCK - downT)),
      finished,
      result: lastResult,
      time: f2(run.time()),
      camera: { x: f2(camera.position.x), y: f2(camera.position.y), z: f2(camera.position.z) },
      scary: !!ctx.getScary(),
    };
  }

  function teleport(x, y, z) {
    runner.x = x;
    runner.z = z;
  }

  function dispose() {
    scene.remove(world);
    scene.background = prevBackground;
    disposeObject(world);
  }

  const noop = () => {};
  reset();
  return {
    update, frame, state, teleport, dispose,
    placeSeeker: noop, collectAllCards: noop, setDisguise: noop,
    snap,
    setDefender: (i, x, z) => { if (defenders[i]) { defenders[i].x = x; defenders[i].z = z; } },
    forceFlag: () => endDown('flag'),
    restart: reset,
    isFinished: () => finished,
  };
}
