import { recordRun } from '../rules.js';
import { createNav } from './hide-nav.js';
import { STANCE_SPEED, stanceFor } from './hide-layout.js';

export { STANCE_SPEED, stanceFor };

export const ROOM = { minX: -25, maxX: 25, minZ: -9, maxZ: 16 };
export const START = { x: -22, y: 0, z: -4 };
export const EXIT = { x: 22.8, z: -4, radius: 1.9 };
export const CARD_RADIUS = 1.25;
export const SEEKER = { patrol: 2, chase: 4.2, scaryScale: 1.25 };
export const WALL_H = 5.5;

const solid = (id, x0, z0, x1, z1, h) => ({ id, min: { x: x0, y: 0, z: z0 }, max: { x: x1, y: h, z: z1 } });

export const ROOMS = [
  { id: 'hall', name: 'Main Hallway', minX: -25, maxX: 25, minZ: -9, maxZ: 0.5 },
  { id: 'class', name: 'Classroom', minX: -25, maxX: -1, minZ: 0.5, maxZ: 16 },
];

export const DOOR = { id: 'dClass', rooms: ['class', 'hall'], x: -7, z: 0.5, width: 4 };
export const NAV = createNav(ROOMS, [DOOR]);
export const roomIdAt = NAV.roomAt;

function wallRun(prefix, axis, line, from, to, gaps = []) {
  const spans = [];
  let at = from;
  for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (a > at) spans.push([at, a]);
    at = Math.max(at, b);
  }
  if (to > at) spans.push([at, to]);
  return spans.map(([a, b], i) => (axis === 'x'
    ? solid(`${prefix}${i + 1}`, a, line[0], b, line[1], WALL_H)
    : solid(`${prefix}${i + 1}`, line[0], a, line[1], b, WALL_H)));
}

export const DOOR_GAP = [-9, -5];

export const WALLS = [
  ...wallRun('wallN', 'x', [-9, -8], -24, 24),
  ...wallRun('wallE', 'z', [24, 25], -9, 1),
  ...wallRun('wallW', 'z', [-25, -24], -9, 16),
  ...wallRun('wallHS', 'x', [0, 1], -24, 24, [DOOR_GAP]),
  ...wallRun('wallCE', 'z', [-2, -1], 1, 16),
  ...wallRun('wallCS', 'x', [15, 16], -24, -2),
];

const LOCKER_H = 3.2;
const STUDENT_DESKS = [];
for (const z of [4, 8]) for (const x of [-21, -17, -13]) STUDENT_DESKS.push(solid(`desk_${x}_${z}`, x - 0.7, z - 0.45, x + 0.7, z + 0.45, 0.9));
export { STUDENT_DESKS };

export const SOLIDS = [
  { id: 'floor', min: { x: -26, y: -3, z: -10 }, max: { x: 26, y: 0, z: 17 } },
  ...WALLS,
  // Hallway lockers along the north wall, with a coat cubby between two partitions.
  solid('lockersA', -22, -8, -12, -7.1, LOCKER_H),
  solid('lockersB', -3, -8, 4, -7.1, LOCKER_H),
  solid('cubbyL', 4, -8, 5, -5.5, LOCKER_H),
  solid('cubbyR', 7, -8, 8, -5.5, LOCKER_H),
  solid('lockersC', 8, -8, 14, -7.1, LOCKER_H),
  solid('lockersD', 17, -8, 22, -7.1, LOCKER_H),
  solid('bench', -2, -1.8, 2, -0.3, 0.7),
  solid('trashCan', 13.2, -2.4, 14.2, -1.4, 1),
  // Classroom.
  solid('teacherDesk', -14, 13, -8, 14.6, 1.1),
  solid('bookshelf', -24, 3, -22.8, 8.5, 2.4),
  solid('beanbag', -3.6, 13.4, -2.1, 14.9, 0.7),
  ...STUDENT_DESKS,
];

const furniture = SOLIDS.filter((s) => s.id !== 'floor' && !s.id.startsWith('wall'));
export const movers = [...furniture, ...WALLS];
export const sighters = movers.filter((s) => s.max.y >= 1.5);

export const SPOTS = [
  { id: 'cubby', kind: 'nook', x0: 5.15, x1: 6.85, z0: -7.9, z1: -6.2 },
  { id: 'storyTable', kind: 'table', x0: -7.9, x1: -4.1, z0: 10.1, z1: 12.9 },
];

export const CARDS = [
  { id: 'k1', x: -11, y: 1.5, z: 13.4, where: 'the teacher\'s desk' },
  { id: 'k2', x: 6, y: 1.2, z: -7.2, where: 'the coat cubby' },
  { id: 'k3', x: 20, y: 1.2, z: -2.2, where: 'by the exit' },
];

export const WAYPOINTS = [
  { x: -18, z: -4 }, { x: -7, z: -4 },
  { x: -7, z: 4 }, { x: -10, z: 10.8 }, { x: -19, z: 11 }, { x: -19, z: 6 }, { x: -12, z: 6 }, { x: -7, z: 3 },
  { x: -7, z: -4 }, { x: 8, z: -4 }, { x: 20, z: -3.5 }, { x: 12, z: -4.5 },
];

export function isHidden(x, z) {
  return SPOTS.some((s) => x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1);
}

export function createBelRun() {
  let time = 0, caught = 0, finished = false;
  const cards = new Set();
  return {
    tick(dt) { if (!finished && dt > 0) time += dt; },
    collect(id) {
      if (finished || cards.has(id)) return false;
      cards.add(id);
      return true;
    },
    caught() { caught += 1; },
    canExit: () => cards.size >= CARDS.length,
    win(store, devMode) {
      finished = true;
      const { isBest, best } = recordRun(store, 'belair', time, devMode);
      return { time, isBest, best, summary: `Bee Key Cards: ${cards.size} of ${CARDS.length}` };
    },
    time: () => time,
    caughtCount: () => caught,
    cardCount: () => cards.size,
    hasCard: (id) => cards.has(id),
    isFinished: () => finished,
  };
}
