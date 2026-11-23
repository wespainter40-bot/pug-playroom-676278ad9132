import { recordRun, grantUnlock } from '../rules.js';

export const FIELD = { minX: -13, maxX: 13, backZ: 34, goalZ: -30, endZ: -38 };
export const DOWNS = 4;
export const TOUCHDOWNS_TO_WIN = 3;
export const SHOT_CLOCK = 14;
export const DRIVE_START_Z = 22;
export const BACKFIELD = 6;

const ROW_ONE = [-9, -3, 3, 9];
const ROW_TWO = [-6, 0, 6];

export function defenderSpawns(scrimZ) {
  const shift = ((Math.round(scrimZ) % 3) + 3) % 3 - 1;
  const clampZ = (z) => Math.max(FIELD.goalZ + 0.5, z);
  return [
    ...ROW_ONE.map((x) => ({ x: x + shift, z: clampZ(scrimZ - 8) })),
    ...ROW_TWO.map((x) => ({ x: x + shift, z: clampZ(scrimZ - 13) })),
  ];
}

export function inBounds(x, z) {
  return x >= FIELD.minX && x <= FIELD.maxX && z >= FIELD.endZ && z <= FIELD.backZ;
}

export function createFootballRun() {
  let time = 0, down = 1, tds = 0, scrim = DRIVE_START_Z, finished = false;
  return {
    tick(dt) { if (!finished && dt > 0) time += dt; },
    time: () => time,
    down: () => down,
    touchdowns: () => tds,
    scrimZ: () => scrim,
    endDown(reason, z) {
      if (Number.isFinite(z)) scrim = Math.min(scrim, z);
      down += 1;
      if (down > DOWNS) {
        down = 1;
        scrim = DRIVE_START_Z;
        return { next: 'turnover' };
      }
      return { next: 'down' };
    },
    touchdown() {
      tds += 1;
      down = 1;
      scrim = DRIVE_START_Z;
      return { won: tds >= TOUCHDOWNS_TO_WIN };
    },
    win(store, devMode) {
      finished = true;
      const { isBest, best } = recordRun(store, 'football', time, devMode);
      grantUnlock(store, 'blitz');
      return { time, isBest, best, summary: `Touchdowns: ${tds} of ${TOUCHDOWNS_TO_WIN}` };
    },
    isFinished: () => finished,
  };
}
