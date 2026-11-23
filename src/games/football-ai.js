import { FIELD } from './football-layout.js';

export const TUNE = {
  walk: 7,
  sprint: 10.5,
  sprintSeconds: 2.5,
  sprintRegen: 0.5,
  defenderSpeed: 5.0,
  reach: 1.0,
  jukeRange: 4.5,
  jukeFool: 1.0,
  jukeSlide: 2.2,
  jukeCooldown: 1.5,
  spinSeconds: 0.6,
  spinCooldown: 3,
  slipFool: 0.8,
};

export function createMoves() {
  let sprint = TUNE.sprintSeconds, jukeCd = 0, spinCd = 0, spinT = 0, absorbed = false;
  return {
    update(dt, sprintHeld) {
      if (!(dt > 0)) return;
      jukeCd = Math.max(0, jukeCd - dt);
      spinCd = Math.max(0, spinCd - dt);
      spinT = Math.max(0, spinT - dt);
      if (sprintHeld && sprint > 0) sprint = Math.max(0, sprint - dt);
      else if (!sprintHeld) sprint = Math.min(TUNE.sprintSeconds, sprint + TUNE.sprintRegen * dt);
    },
    speed: (sprintHeld) => (sprintHeld && sprint > 0 ? TUNE.sprint : TUNE.walk),
    tryJuke(runner, defenders, side) {
      if (jukeCd > 0) return 0;
      jukeCd = TUNE.jukeCooldown;
      runner.x = Math.min(FIELD.maxX, Math.max(FIELD.minX, runner.x + TUNE.jukeSlide * (side < 0 ? -1 : 1)));
      let fooled = 0;
      for (const d of defenders) {
        if (d.z >= runner.z) continue;
        if (Math.hypot(d.x - runner.x, d.z - runner.z) > TUNE.jukeRange) continue;
        d.state = 'fooled';
        d.fooledT = TUNE.jukeFool;
        fooled += 1;
      }
      return fooled;
    },
    trySpin() {
      if (spinCd > 0) return false;
      spinCd = TUNE.spinCooldown;
      spinT = TUNE.spinSeconds;
      absorbed = false;
      return true;
    },
    isSpinning: () => spinT > 0,
    absorbSpin() {
      if (spinT <= 0 || absorbed) return false;
      absorbed = true;
      return true;
    },
    sprintLeft: () => sprint,
    jukeReady: () => jukeCd <= 0,
    spinReady: () => spinCd <= 0,
  };
}

export function createDefender(id, x, z) {
  return { id, x, z, facing: 0, state: 'set', fooledT: 0 };
}

export function stepDefender(d, runner, dt, ctx) {
  if (d.state === 'set') return null;
  if (d.state === 'fooled') {
    d.fooledT -= dt;
    if (d.fooledT <= 0) d.state = 'chase';
    return null;
  }
  const dist = Math.hypot(runner.x - d.x, runner.z - d.z);
  const lead = Math.min(0.5, dist / TUNE.defenderSpeed);
  const tx = runner.x + runner.vx * lead, tz = runner.z + runner.vz * lead;
  const dx = tx - d.x, dz = tz - d.z, len = Math.hypot(dx, dz);
  if (len > 1e-6) {
    const step = Math.min(len, TUNE.defenderSpeed * ctx.speedScale * dt);
    d.x += (dx / len) * step;
    d.z += (dz / len) * step;
    d.facing = Math.atan2(dx, dz);
  }
  if (Math.hypot(runner.x - d.x, runner.z - d.z) <= TUNE.reach) {
    if (ctx.moves.isSpinning() && ctx.moves.absorbSpin()) {
      d.state = 'fooled';
      d.fooledT = TUNE.slipFool;
      return 'slipped';
    }
    return 'pulled';
  }
  return null;
}

export function separateDefenders(defenders, minDist = 0.9) {
  for (let i = 0; i < defenders.length; i++) {
    for (let j = i + 1; j < defenders.length; j++) {
      const a = defenders[i], b = defenders[j];
      const dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz);
      if (dist >= minDist) continue;
      const push = (minDist - dist) / 2 + 1e-6;
      const nx = dist > 1e-6 ? dx / dist : 1, nz = dist > 1e-6 ? dz / dist : 0;
      a.x -= nx * push; a.z -= nz * push;
      b.x += nx * push; b.z += nz * push;
    }
  }
}
