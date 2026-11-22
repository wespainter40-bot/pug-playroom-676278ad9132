import { recordRun, addBones, boneTotal } from '../rules.js';
import { createNav } from './hide-nav.js';

export const ROOM = { minX: -32, maxX: 32, minZ: -36, maxZ: 8 };
export const START = { x: -13, y: 0, z: 5 };
export const EXIT = { x: 13.5, z: -34.5, radius: 1.8 };

const solid = (id, x0, z0, x1, z1, h) => ({ id, min: { x: x0, y: 0, z: z0 }, max: { x: x1, y: h, z: z1 } });

// Six rooms. `x0..x1, z0..z1` is the walkable interior (floors, props, tests); `border` runs out to
// the wall centre lines, which is what roomAt uses so a doorway belongs to a room instead of a crack.
const room = (id, name, x0, z0, x1, z1, bx0, bz0, bx1, bz1) => ({
  id, name, x0, z0, x1, z1, border: { minX: bx0, maxX: bx1, minZ: bz0, maxZ: bz1 },
});

export const ROOMS = [
  room('dining', 'Dining Room', -16, -22, 16, 8, -16.5, -22.5, 16.5, 8.5),
  room('kitchen', 'Kitchen', -16, -36, 16, -23, -16.5, -37, 16.5, -22.5),
  room('arcade', 'Arcade', -32, -22, -17, -4.5, -33, -22.5, -16.5, -4),
  room('storage', 'Storage Room', -32, -3.5, -17, 8, -33, -4, -16.5, 9),
  room('party', 'Party Room', 17, -22, 32, -4.5, 16.5, -22.5, 33, -4),
  room('restrooms', 'Restrooms', 17, -3.5, 32, 8, 16.5, -4, 33, 9),
];

// Permanent open doorways. `wall.axis` is the axis the wall runs along, `wall.line` its thickness
// span on the other axis, `wall.gap` the hole cut in it — the same numbers wallRun() cuts with.
const door = (id, rooms, x, z, axis, line, gap) => ({
  id, rooms, x, z, width: gap[1] - gap[0], wall: { axis, line, gap },
});

export const DOORS = [
  door('dKitchen', ['kitchen', 'dining'], 10.5, -22.5, 'x', [-23, -22], [8, 13]),
  door('dArcade', ['arcade', 'dining'], -16.5, -18, 'z', [-17, -16], [-20, -16]),
  door('dStorage', ['storage', 'dining'], -16.5, 4, 'z', [-17, -16], [2, 6]),
  door('dParty', ['party', 'dining'], 16.5, -7, 'z', [16, 17], [-9, -5]),
  door('dRestrooms', ['restrooms', 'dining'], 16.5, 4, 'z', [16, 17], [2, 6]),
  door('dArcStore', ['arcade', 'storage'], -25, -4, 'x', [-4.5, -3.5], [-27, -23]),
  door('dPartyRest', ['party', 'restrooms'], 25, -4, 'x', [-4.5, -3.5], [23, 27]),
];

export const NAV = createNav(ROOMS.map((r) => ({ id: r.id, ...r.border })), DOORS);
export const roomIdAt = NAV.roomAt;

const WALL_H = 6;

// One wall line, chopped into slabs so the doorway gaps stay empty.
// axis: the axis the wall runs along; line: its 1-unit thickness span on the other axis.
function wallRun(prefix, axis, line, from, to, gaps = []) {
  const spans = [];
  let at = from;
  const mine = gaps.filter(([a, b]) => b > from && a < to).sort((p, q) => p[0] - q[0]);
  for (const [a, b] of mine) {
    if (a > at) spans.push([at, a]);
    at = Math.max(at, b);
  }
  if (to > at) spans.push([at, to]);
  return spans.map(([a, b], i) => (axis === 'x'
    ? solid(`${prefix}${i + 1}`, a, line[0], b, line[1], WALL_H)
    : solid(`${prefix}${i + 1}`, line[0], a, line[1], b, WALL_H)));
}

const gapsIn = (axis, line) => DOORS
  .filter((d) => d.wall.axis === axis && d.wall.line[0] === line[0] && d.wall.line[1] === line[1])
  .map((d) => d.wall.gap);

// wallOuter* is the outside of the building, wallIn* has a room on both sides (Task 5 lowers only
// the wallIn* slabs for the lifted corner camera).
// Every line stops where the perpendicular line that owns the corner begins, so no two slabs
// share any area (they only ever touch on an edge) and Task 5 never renders two boxes in one
// corner. The lines that own a corner are the ones running the full span: NW/NE/SW/S/SE on
// z -23..-22 and z 8..9, and KN on z -37..-36.
const WALLS = [
  ...wallRun('wallOuterW', 'z', [-33, -32], -22, 8),
  ...wallRun('wallOuterE', 'z', [32, 33], -22, 8),
  ...wallRun('wallOuterNW', 'x', [-23, -22], -33, -17),
  ...wallRun('wallOuterNE', 'x', [-23, -22], 17, 33),
  ...wallRun('wallOuterSW', 'x', [8, 9], -33, -17),
  ...wallRun('wallOuterS', 'x', [8, 9], -17, 17),
  ...wallRun('wallOuterSE', 'x', [8, 9], 17, 33),
  ...wallRun('wallOuterKN', 'x', [-37, -36], -17, 17),
  ...wallRun('wallOuterKW', 'z', [-17, -16], -36, -23),
  ...wallRun('wallOuterKE', 'z', [16, 17], -36, -23),
  // Dining's old west, east and north slabs, now interior walls with the doorways cut out.
  ...wallRun('wallInW', 'z', [-17, -16], -22, 8, gapsIn('z', [-17, -16])),
  ...wallRun('wallInE', 'z', [16, 17], -22, 8, gapsIn('z', [16, 17])),
  ...wallRun('wallInN', 'x', [-23, -22], -17, 17, gapsIn('x', [-23, -22])),
  ...wallRun('wallInAS', 'x', [-4.5, -3.5], -32, -17, gapsIn('x', [-4.5, -3.5])),
  ...wallRun('wallInPR', 'x', [-4.5, -3.5], 17, 32, gapsIn('x', [-4.5, -3.5])),
];

export const SOLIDS = [
  { id: 'floor', min: { x: -33, y: -3, z: -37 }, max: { x: 33, y: 0, z: 9 } },
  ...WALLS,
  // Dining Room — unchanged.
  solid('stage', -7, -22, 7, -18.5, 1.2),
  solid('pillarA', -4.8, -10.8, -3.2, -9.2, 4),
  solid('pillarB', 3.2, -9.8, 4.8, -8.2, 4),
  solid('counter', 11, -17, 16, -11, 1.6),
  // Kitchen.
  solid('kitchenIsland', -6, -31, 6, -28.5, 1.6),
  solid('kitchenShelf', -15, -35, -13, -28, 2.6),
  // Arcade — the two old dining cabinets moved here, plus a third.
  solid('cabinet1', -31.5, -20, -29.5, -17.5, 3),
  solid('cabinet2', -31.5, -14, -29.5, -11.5, 3),
  solid('cabinet3', -24, -21, -22, -18.5, 3),
  // Storage Room.
  solid('crateStackA', -23, -2.5, -20.5, 0, 2.4),
  solid('crateStackB', -31, 4.5, -28.5, 7, 1.8),
  // Party Room.
  solid('partyTable', 19, -21, 27, -19, 1.6),
  solid('cakeStand', 28.5, -12, 30.5, -10, 1.8),
  // Restrooms.
  solid('stallWall1', 26.5, 1, 27.1, 6, 2.4),
  solid('stallWall2', 29.5, 1, 30.1, 6, 2.4),
];

const furniture = SOLIDS.filter((s) => s.id !== 'floor' && !s.id.startsWith('wall'));
export const movers = [...furniture, ...WALLS];
export const sighters = movers.filter((s) => s.max.y >= 1.5);

export const SPOTS = [
  // Dining Room — unchanged.
  { id: 'table1', kind: 'table', x0: -10, x1: -6, z0: -4.3, z1: -1.3 },
  { id: 'table2', kind: 'table', x0: 7, x1: 11, z0: -5.3, z1: -2.7 },
  { id: 'box', kind: 'box', x0: 10.8, x1: 13.2, z0: 2.8, z1: 5.2 },
  { id: 'nook', kind: 'nook', x0: -15.9, x1: -13.5, z0: -12.4, z1: -8.6 },
  // Kitchen.
  { id: 'oven', kind: 'oven', x0: 2, x1: 5, z0: -35.5, z1: -33 },
  { id: 'prepTable', kind: 'table', x0: -4, x1: 0, z0: -27, z1: -24.5 },
  { id: 'doughShelf', kind: 'nook', x0: -12.4, x1: -10, z0: -33, z1: -30 },
  // Arcade.
  { id: 'cabinetGap', kind: 'nook', x0: -31.4, x1: -29.6, z0: -17.2, z1: -14.3 },
  { id: 'prizeBin', kind: 'box', x0: -22, x1: -19.5, z0: -8, z1: -5.5 },
  // Party Room.
  { id: 'longTable', kind: 'table', x0: 20, x1: 26, z0: -11, z1: -8 },
  { id: 'giftPile', kind: 'box', x0: 28, x1: 30.4, z0: -17, z1: -14.6 },
  // Storage Room.
  { id: 'crateStack', kind: 'box', x0: -27, x1: -24.6, z0: 3, z1: 5.4 },
  { id: 'mopCloset', kind: 'nook', x0: -19.5, x1: -17.6, z0: 5.5, z1: 7.4 },
  // Restrooms.
  { id: 'stall1', kind: 'nook', x0: 27.3, x1: 29.3, z0: 2, z1: 5.5 },
  { id: 'stall2', kind: 'nook', x0: 30.3, x1: 31.6, z0: 2, z1: 5.5 },
];

// Dining 4 (b1 where it always was), Kitchen 2, Arcade 2, Party 2, Storage 1, Restrooms 1.
const BONE_SPOTS = [
  [-13, -1], [-2, -6], [6, -14], [-9, -20],
  [-4, -26], [8, -32],
  [-27, -20], [-21, -12],
  [22, -15], [30, -20],
  [-26, -1],
  [19, -1],
];
export const BONES = BONE_SPOTS.map(([x, z], i) => ({ id: `b${i + 1}`, x, y: 1, z }));
export const TOY_PICKUPS = [{ id: 't1', x: -13, z: -5 }, { id: 't2', x: 20, z: -14 }];

// Bolt's beat: dining -> kitchen -> dining -> arcade -> storage -> dining -> restrooms -> party -> dining.
// Each doorway is crossed between a pair of waypoints standing on its normal, so he walks straight through.
export const WAYPOINTS = [
  { x: 10.5, z: -20 },
  { x: 10.5, z: -25.5 }, { x: -10, z: -25.5 }, { x: -9, z: -33 }, { x: 10.5, z: -33 },
  { x: 7, z: -15 }, { x: -14, z: -18 },
  { x: -19, z: -18 }, { x: -27, z: -14 }, { x: -25, z: -7 },
  { x: -25, z: -1 }, { x: -29, z: 1 }, { x: -19, z: 4 },
  { x: -14, z: 4 }, { x: 14, z: 4 },
  { x: 19, z: 4 }, { x: 24, z: 7 }, { x: 25, z: -1 },
  { x: 25, z: -7 }, { x: 29, z: -18 }, { x: 19, z: -7 },
  { x: 14, z: -7 }, { x: 8, z: -8 },
];

export const STANCE_SPEED = { tiptoe: 2, walk: 3.8, run: 6 };
export const SEEKER = { patrol: 2, chase: 4.2, scaryScale: 1.25 };

export function isHidden(x, z) {
  return SPOTS.some((s) => x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1);
}

export function stanceFor({ moveX, moveZ, jump, tiptoe }) {
  if (Math.hypot(moveX || 0, moveZ || 0) < 0.1) return 'still';
  if (tiptoe) return 'tiptoe';
  return jump ? 'run' : 'walk';
}

export function createHideRun() {
  let time = 0, caught = 0, finished = false;
  const bones = new Set();
  return {
    tick(dt) { if (!finished && dt > 0) time += dt; },
    collect(id) {
      if (finished || bones.has(id)) return false;
      bones.add(id);
      return true;
    },
    caught() { caught += 1; },
    canExit: () => bones.size >= BONES.length,
    win(store, devMode) {
      finished = true;
      const banked = bones.size;
      addBones(store, banked);
      const { isBest, best } = recordRun(store, 'hide', time, devMode);
      return { time, isBest, best, bonesBanked: banked, total: boneTotal(store) };
    },
    time: () => time,
    caughtCount: () => caught,
    bonesCount: () => bones.size,
    hasBone: (id) => bones.has(id),
    isFinished: () => finished,
  };
}
