import { separateDefenders } from './football-ai.js';

export const BLITZ = {
  gunMax: 8, balloonPerPickup: 3, gunRange: 9, gunHalfAngle: 0.35, balloonRange: 7, balloonRadius: 2.6,
  zombieSpeed: 3.6, touchRadius: 1.0, knockdown: 1.5, heartsGentle: 5, heartsNormal: 3, helperSpeed: 6,
  coolerRadius: 2.5, COOLER: { x: 12, z: 10 }, giantHp: { gentle: 6, normal: 10 }, gentleSpeedScale: 0.75,
};

const SHOVE = 2.5;
const FOLLOW_GAP = 1.5;

export function waveSpec(wave, gentle) {
  const steelers = [4, 5, 6, 2][wave - 1];
  return { steelers, giant: wave === 4, speedScale: gentle ? BLITZ.gentleSpeedScale : 1 };
}

function mateHome(i) {
  return { x: i % 2 ? 11.5 : -11.5, z: 26 - 6 * Math.floor(i / 2) };
}

export function createBlitz({ gentle = false, mates = 6 } = {}) {
  const maxHearts = gentle ? BLITZ.heartsGentle : BLITZ.heartsNormal;
  const foes = [];
  const ammo = { gun: BLITZ.gunMax, balloon: 0 };
  const pending = [];
  let wave = 1;
  let hearts = maxHearts;
  let knockdown = 0;
  let won = false;

  const zombieList = () => foes.filter((f) => f.state === 'zombie');

  function spawnMates() {
    for (let i = 0; i < mates; i++) {
      const h = mateHome(i);
      const m = foes.find((f) => f.id === `m${i}`);
      if (m) Object.assign(m, { x: h.x, z: h.z, hp: 0, state: 'normal' });
      else foes.push({ id: `m${i}`, kind: 'mate', x: h.x, z: h.z, hp: 0, state: 'normal' });
    }
  }

  function spawnWave() {
    for (let i = foes.length - 1; i >= 0; i--) if (foes[i].kind !== 'mate') foes.splice(i, 1);
    const spec = waveSpec(wave, gentle);
    for (let i = 0; i < spec.steelers; i++) {
      const x = spec.steelers === 1 ? 0 : -9 + (18 * i) / (spec.steelers - 1);
      foes.push({ id: `s${wave}_${i}`, kind: 'steeler', x, z: -20 - (i % 2) * 3, hp: 1, state: 'zombie' });
    }
    if (spec.giant) {
      foes.push({ id: 'giant', kind: 'giant', x: 0, z: -27, hp: gentle ? BLITZ.giantHp.gentle : BLITZ.giantHp.normal, state: 'zombie' });
    }
  }

  function restartWave() {
    hearts = maxHearts;
    knockdown = 0;
    ammo.gun = BLITZ.gunMax;
    ammo.balloon = 0;
    spawnMates();
    spawnWave();
  }

  function cure(f) {
    f.hp = 0;
    f.state = f.kind === 'mate' ? 'helper' : 'cured';
    pending.push('cured');
    if (f.kind === 'giant') {
      won = true;
      pending.push('won');
    }
  }

  function hurtFoe(f) {
    f.hp -= 1;
    if (f.hp <= 0) cure(f);
  }

  function reset() {
    wave = 1;
    won = false;
    pending.length = 0;
    foes.length = 0;
    restartWave();
  }

  function step(dt, player) {
    const events = pending.splice(0);
    const scale = waveSpec(wave, gentle).speedScale;
    knockdown = Math.max(0, knockdown - dt);
    const zs = zombieList();
    for (const z of zs) {
      const dx = player.x - z.x, dz = player.z - z.z, d = Math.hypot(dx, dz);
      if (d > 1e-6) {
        const s = Math.min(d, BLITZ.zombieSpeed * scale * dt);
        z.x += (dx / d) * s;
        z.z += (dz / d) * s;
      }
    }
    separateDefenders(zs, 0.9);
    for (const f of foes) {
      if (f.state !== 'helper') continue;
      const dx = player.x - f.x, dz = player.z - f.z, d = Math.hypot(dx, dz);
      if (d > FOLLOW_GAP) {
        const s = Math.min(d - FOLLOW_GAP, BLITZ.helperSpeed * dt);
        f.x += (dx / d) * s;
        f.z += (dz / d) * s;
      }
    }
    for (const z of zs) {
      for (const m of foes) {
        if (m.kind !== 'mate' || m.state !== 'normal') continue;
        if (Math.hypot(m.x - z.x, m.z - z.z) <= BLITZ.touchRadius) {
          m.state = 'zombie';
          m.hp = 1;
          events.push('infected');
        }
      }
    }
    if (knockdown <= 0 && !won) {
      const touching = zs.filter((z) => z.state === 'zombie' && Math.hypot(player.x - z.x, player.z - z.z) <= BLITZ.touchRadius);
      if (touching.length) {
        hearts -= 1;
        knockdown = BLITZ.knockdown;
        events.push('hurt');
        for (const z of touching) {
          const dx = z.x - player.x, dz = z.z - player.z, d = Math.hypot(dx, dz);
          const nx = d > 1e-6 ? dx / d : 0, nz = d > 1e-6 ? dz / d : -1;
          z.x += nx * SHOVE;
          z.z += nz * SHOVE;
        }
        if (hearts <= 0) {
          events.push('roundRestart');
          restartWave();
        }
      }
    }
    if (!won && wave < 4 && zombieList().length === 0) {
      wave += 1;
      spawnWave();
      events.push('wave');
    }
    return events;
  }

  function soak(player, aim, weapon) {
    const kind = weapon || (ammo.gun > 0 ? 'gun' : 'balloon');
    if (ammo[kind] <= 0) return 'dry';
    ammo[kind] -= 1;
    const len = Math.hypot(aim.x, aim.z);
    if (len < 1e-6) return 'miss';
    const ax = aim.x / len, az = aim.z / len;
    const zs = zombieList();
    if (kind === 'gun') {
      const cosMin = Math.cos(BLITZ.gunHalfAngle);
      let best = null, bestD = Infinity;
      for (const z of zs) {
        const dx = z.x - player.x, dz = z.z - player.z, d = Math.hypot(dx, dz);
        if (d > BLITZ.gunRange) continue;
        if (d > 0.05 && (dx * ax + dz * az) / d < cosMin) continue;
        if (d < bestD) { best = z; bestD = d; }
      }
      if (!best) return 'miss';
      hurtFoe(best);
      return 'hit';
    }
    const lx = player.x + ax * BLITZ.balloonRange, lz = player.z + az * BLITZ.balloonRange;
    let hit = false;
    for (const z of zs) {
      if (Math.hypot(z.x - lx, z.z - lz) <= BLITZ.balloonRadius) { hurtFoe(z); hit = true; }
    }
    return hit ? 'hit' : 'miss';
  }

  function pickup(kind) {
    if (kind === 'gun') ammo.gun = BLITZ.gunMax;
    else if (kind === 'balloon') ammo.balloon += BLITZ.balloonPerPickup;
  }

  function refillAtCooler(player) {
    if (Math.hypot(player.x - BLITZ.COOLER.x, player.z - BLITZ.COOLER.z) > BLITZ.coolerRadius) return false;
    ammo.gun = BLITZ.gunMax;
    return true;
  }

  reset();

  return {
    foes, ammo,
    hearts: () => hearts,
    wave: () => wave,
    step, soak, pickup, refillAtCooler, reset,
    isWon: () => won,
    isRoundOver: () => zombieList().length === 0,
    knockdownLeft: () => knockdown,
  };
}
