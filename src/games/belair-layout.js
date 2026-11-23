import { recordRun } from '../rules.js';
import { createNav } from './hide-nav.js';
import { STANCE_SPEED, stanceFor } from './hide-layout.js';

export { STANCE_SPEED, stanceFor };

export const ROOM = { minX: -25, maxX: 25, minZ: -9, maxZ: 30 };
export const START = { x: -22, y: 0, z: -4 };
export const EXIT = { x: 22.8, z: -4, radius: 1.9 };
export const CARD_RADIUS = 1.25;
export const SEEKER = { patrol: 2, chase: 4.2, scaryScale: 1.25 };
export const WALL_H = 5.5;

const solid = (id, x0, z0, x1, z1, h) => ({ id, min: { x: x0, y: 0, z: z0 }, max: { x: x1, y: h, z: z1 } });

export const ROOMS = [
  { id: 'hall', name: 'Main Hallway', minX: -25, maxX: 25, minZ: -9, maxZ: 0.5 },
  { id: 'class', name: 'Classroom', minX: -25, maxX: -1, minZ: 0.5, maxZ: 16 },
  { id: 'cafe', name: 'Cafeteria', minX: -1, maxX: 11.5, minZ: 0.5, maxZ: 16 },
  { id: 'gym', name: 'Gym', minX: 11.5, maxX: 25, minZ: 0.5, maxZ: 16 },
  { id: 'library', name: 'Library', minX: -25, maxX: 11.5, minZ: 16, maxZ: 30 },
  { id: 'office', name: "Principal's Office", minX: 11.5, maxX: 25, minZ: 16, maxZ: 30 },
];

export const DOOR = { id: 'dClass', rooms: ['class', 'hall'], x: -7, z: 0.5, width: 4 };
export const DOOR_CAFE = { id: 'dCafe', rooms: ['cafe', 'hall'], x: 5, z: 0.5, width: 4 };
export const DOOR_GYM = { id: 'dGym', rooms: ['gym', 'hall'], x: 18, z: 0.5, width: 4 };
export const DOOR_CAFE_GYM = { id: 'dCafeGym', rooms: ['cafe', 'gym'], x: 11.5, z: 9, width: 3 };
export const DOOR_CLASS_LIB = { id: 'dClassLib', rooms: ['class', 'library'], x: -21.75, z: 15.5, width: 3.5 };
export const DOOR_CAFE_LIB = { id: 'dCafeLib', rooms: ['cafe', 'library'], x: 1.7, z: 15.5, width: 3 };
export const DOOR_GYM_OFFICE = { id: 'dGymOffice', rooms: ['gym', 'office'], x: 22.5, z: 15.5, width: 3 };
export const DOOR_LIB_OFFICE = { id: 'dLibOffice', rooms: ['library', 'office'], x: 11.5, z: 22.5, width: 3 };
export const DOORS = [DOOR, DOOR_CAFE, DOOR_GYM, DOOR_CAFE_GYM, DOOR_CLASS_LIB, DOOR_CAFE_LIB, DOOR_GYM_OFFICE, DOOR_LIB_OFFICE];
export const NAV = createNav(ROOMS, DOORS);
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
export const CAFE_GAP = [3, 7];
export const GYM_GAP = [16, 20];
export const CAFE_GYM_GAP = [7.5, 10.5];
export const CLASS_LIB_GAP = [-23.5, -20];
export const CAFE_LIB_GAP = [0.2, 3.2];
export const GYM_OFFICE_GAP = [21, 24];
export const LIB_OFFICE_GAP = [21, 24];

export const WALLS = [
  ...wallRun('wallN', 'x', [-9, -8], -24, 24),
  ...wallRun('wallE', 'z', [24, 25], -9, 30),
  ...wallRun('wallW', 'z', [-25, -24], -9, 30),
  ...wallRun('wallHS', 'x', [0, 1], -24, 24, [DOOR_GAP, CAFE_GAP, GYM_GAP]),
  ...wallRun('wallCE', 'z', [-2, -1], 1, 16),
  ...wallRun('wallCS', 'x', [15, 16], -24, 24, [CLASS_LIB_GAP, CAFE_LIB_GAP, GYM_OFFICE_GAP]),
  ...wallRun('wallCG', 'z', [11, 12], 1, 15, [CAFE_GYM_GAP]),
  ...wallRun('wallS', 'x', [29, 30], -24, 24),
  ...wallRun('wallLO', 'z', [11, 12], 16, 29, [LIB_OFFICE_GAP]),
];

const LOCKER_H = 3.2;
const STUDENT_DESKS = [];
for (const z of [4, 8]) for (const x of [-21, -17, -13]) STUDENT_DESKS.push(solid(`desk_${x}_${z}`, x - 0.7, z - 0.45, x + 0.7, z + 0.45, 0.9));
export { STUDENT_DESKS };

export const SOLIDS = [
  { id: 'floor', min: { x: -26, y: -3, z: -10 }, max: { x: 26, y: 0, z: 31 } },
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
  // Cafeteria.
  solid('cafeTable1', 2, 3.6, 8, 6, 0.85),
  solid('cafeTable2', 2, 7.6, 8, 10, 0.85),
  solid('lunchCounter', 3, 11.8, 11, 13, 1.2),
  // Gym.
  solid('bleachers', 20.6, 3.5, 22.4, 11.5, 2.2),
  solid('ballCart', 15, 6, 16.4, 7.2, 1.1),
  solid('crates', 13, 11, 14.4, 12.4, 1.4),
  solid('vaultBox', 17, 9.5, 18.6, 10.6, 1.1),
  // Library.
  solid('libA1', -20, 19.5, -12, 20.6, 3.4),
  solid('libA2', -8.5, 19.5, 0, 20.6, 3.4),
  solid('libB1', -20, 24, -12, 25.1, 3.4),
  solid('libB2', -8.5, 24, 0, 25.1, 3.4),
  solid('libB3', 3, 22, 4.1, 28, 3.4),
  solid('libC', 7.5, 24.5, 8.6, 29, 3.4),
  solid('readTable', -6, 21.4, -2.5, 23.2, 0.85),
  solid('libCounter', 5, 17.5, 9, 18.7, 1.1),
  // Principal's office.
  solid('principalDesk', 16, 22, 21, 24, 1.1),
  solid('filing', 23, 17.4, 24, 22.4, 1.8),
  solid('couch', 22.6, 25.4, 24, 28.2, 0.9),
  solid('plant', 12.3, 27.6, 13.5, 28.8, 1.8),
];

const furniture = SOLIDS.filter((s) => s.id !== 'floor' && !s.id.startsWith('wall'));
export const movers = [...furniture, ...WALLS];
export const sighters = movers.filter((s) => s.max.y >= 1.5);

export const SPOTS = [
  { id: 'cubby', kind: 'nook', x0: 5.15, x1: 6.85, z0: -7.9, z1: -6.2 },
  { id: 'storyTable', kind: 'table', x0: -7.9, x1: -4.1, z0: 10.1, z1: 12.9 },
  { id: 'lunchNook', kind: 'nook', x0: 3.6, x1: 10.4, z0: 13.4, z1: 14.6 },
  { id: 'bleacherNook', kind: 'nook', x0: 22.8, x1: 23.8, z0: 4, z1: 11 },
  { id: 'libNook', kind: 'nook', x0: 9, x1: 10.6, z0: 25.5, z1: 28.5 },
  { id: 'meetingTable', kind: 'table', x0: 13.4, x1: 16.8, z0: 25, z1: 27 },
];

export const CARDS = [
  { id: 'k1', x: -11, y: 1.5, z: 13.4, where: 'the teacher\'s desk' },
  { id: 'k2', x: 6, y: 1.2, z: -7.2, where: 'the coat cubby' },
  { id: 'k3', x: 14, y: 1.3, z: 13.8, where: 'the gym corner' },
  { id: 'k4', x: 6.5, y: 1.3, z: 9.7, where: 'the lunch table' },
  { id: 'k5', x: -16, y: 1.3, z: 27, where: 'the library reading corner' },
  { id: 'k6', x: 18.5, y: 1.5, z: 22.6, where: "the principal's desk" },
];

export const WAYPOINTS = [
  { x: -18, z: -4 }, { x: -7, z: -4 },
  { x: -7, z: 4 }, { x: -10, z: 10.8 }, { x: -19, z: 11 }, { x: -19, z: 6 }, { x: -12, z: 6 }, { x: -7, z: 3 },
  { x: -7, z: -4 }, { x: 8, z: -4 },
  { x: 5, z: 2.4 }, { x: 0.8, z: 3 }, { x: 0.8, z: 6.8 }, { x: 9.8, z: 6.8 }, { x: 9.8, z: 10.9 }, { x: 1.5, z: 11 }, { x: 1.5, z: 14.2 },
  { x: 1.7, z: 18.2 }, { x: -10.5, z: 18.2 }, { x: -10.5, z: 22.3 }, { x: -22, z: 22.3 }, { x: -22, z: 27 }, { x: -10.5, z: 27 }, { x: 1.5, z: 27.2 }, { x: 1.5, z: 21.2 }, { x: 9.5, z: 21.2 },
  { x: 13.5, z: 20.5 }, { x: 13.5, z: 27 }, { x: 21, z: 27.2 }, { x: 21.9, z: 25 }, { x: 21.9, z: 19.5 }, { x: 21.9, z: 16.8 },
  { x: 19.5, z: 13.3 }, { x: 15.5, z: 13.3 }, { x: 15.6, z: 9.2 }, { x: 14, z: 9 }, { x: 14, z: 3.2 }, { x: 19.5, z: 3.2 },
  { x: 20, z: -3.5 }, { x: 12, z: -4.5 },
];

export const SPEED_PER_CARD = 0.05, SPEED_CAP = 1.35;

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
