import { recordRun, addBones, boneTotal } from '../rules.js';

export const JUMP_SPEED = 9;
export const GRAVITY = 28;
export const WALK_SPEED = 6;
export const LAVA_Y = -0.6;
export const KILL_Y = -1.0;

// kind picks the Christmas theme; the list order is the walking path.
export const PLATFORMS = [
  { id: 'start', x: 0, z: 0, w: 6, d: 6, top: 0, kind: 'start' },
  { id: 'a', x: 0, z: -7, w: 3.2, d: 3.2, top: 0.5, kind: 'present' },
  { id: 'b', x: 3, z: -12, w: 3, d: 3, top: 1.0, kind: 'candy' },
  { id: 'c', x: 6.5, z: -16.5, w: 3, d: 3, top: 1.5, kind: 'gingerbread' },
  { id: 'd', x: 3.5, z: -21, w: 3, d: 3, top: 2.0, kind: 'present' },
  { id: 'e', x: -0.5, z: -24.5, w: 3, d: 3, top: 2.5, kind: 'candy' },
  { id: 'f', x: -6, z: -28, w: 6, d: 2.6, top: 2.0, kind: 'bone' },
  { id: 'g', x: -6, z: -33, w: 3, d: 3, top: 2.5, kind: 'present' },
  { id: 'h', x: -2, z: -36.5, w: 3, d: 3, top: 3.0, kind: 'gingerbread' },
  { id: 'i', x: 2, z: -40, w: 3, d: 3, top: 3.5, kind: 'candy' },
  { id: 'j', x: 6, z: -43.5, w: 3, d: 3, top: 3.0, kind: 'present' },
  { id: 'k', x: 6, z: -48.5, w: 3, d: 3, top: 3.5, kind: 'gingerbread' },
  { id: 'goal', x: 6, z: -54, w: 5, d: 5, top: 4.0, kind: 'goal' },
];

export const START = { x: 0, y: 0, z: 2 };
export const GOAL = { x: 6, y: 4.9, z: -54, radius: 1.1 };

// Moving things. Slow near the start, faster further along.
export const OBSTACLES = [
  { id: 'slider1', kind: 'slider', cx: 11, cy: -0.75, cz: -16.5, w: 2.4, h: 4.5, d: 2.4, axis: 'x', amp: 1.6, period: 6, phase: 0 },
  { id: 'log1', kind: 'log', cx: -6, cy: 2.5, cz: -28, w: 0.8, h: 1.0, d: 2.0, axis: 'x', amp: 1.8, period: 4.5, phase: 0 },
  { id: 'wall1', kind: 'wall', cx: -2, cy: 3.5, cz: -36.5, w: 0.6, h: 1.0, d: 2.6, axis: 'x', amp: 0.9, period: 3.6, phase: 1.2 },
  { id: 'log2', kind: 'log', cx: 2, cy: 4.0, cz: -40, w: 0.8, h: 1.0, d: 2.2, axis: 'x', amp: 0.7, period: 3.0, phase: 0 },
];

const bonePlatforms = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];
export const BONES = [
  ...bonePlatforms.map((pid, i) => {
    const p = PLATFORMS.find((q) => q.id === pid);
    return { id: `b${i + 1}`, x: p.x, y: p.top + 1.0, z: p.z };
  }),
  { id: 'b12', x: 11, y: 2.5, z: -16.5 },
];

export function platformBox(p) {
  return {
    id: p.id,
    min: { x: p.x - p.w / 2, y: -3, z: p.z - p.d / 2 },
    max: { x: p.x + p.w / 2, y: p.top, z: p.z + p.d / 2 },
  };
}

export function moveObstacles(defs, t) {
  return defs.map((o) => {
    const w = (2 * Math.PI) / o.period;
    const off = o.amp * Math.sin(w * t + o.phase);
    const vel = o.amp * w * Math.cos(w * t + o.phase);
    const cx = o.cx + (o.axis === 'x' ? off : 0);
    const cz = o.cz + (o.axis === 'z' ? off : 0);
    return {
      id: o.id,
      kind: o.kind,
      solidTop: o.kind === 'slider',
      min: { x: cx - o.w / 2, y: o.cy - o.h / 2, z: cz - o.d / 2 },
      max: { x: cx + o.w / 2, y: o.cy + o.h / 2, z: cz + o.d / 2 },
      velocity: { x: o.axis === 'x' ? vel : 0, y: 0, z: o.axis === 'z' ? vel : 0 },
    };
  });
}

// Farthest flat-ground gap a jump can clear when the landing is `rise` higher.
export function gapMax(rise, jumpSpeed = JUMP_SPEED, gravity = GRAVITY, speed = WALK_SPEED) {
  const peak = (jumpSpeed * jumpSpeed) / (2 * gravity);
  if (rise > peak) return 0;
  const t = jumpSpeed / gravity + Math.sqrt((2 * (peak - rise)) / gravity);
  return speed * t;
}

export function createRun() {
  let time = 0;
  let deaths = 0;
  let finished = false;
  let bones = new Set();
  return {
    tick(dt) { if (!finished && dt > 0) time += dt; },
    collect(id) { if (!finished) bones.add(id); },
    die() { bones = new Set(); time = 0; deaths += 1; },
    win(store, devMode) {
      finished = true;
      const banked = bones.size;
      addBones(store, banked);
      const { isBest, best } = recordRun(store, 'lava', time, devMode);
      return { time, isBest, best, bonesBanked: banked, total: boneTotal(store) };
    },
    time: () => time,
    deaths: () => deaths,
    bonesCount: () => bones.size,
    hasBone: (id) => bones.has(id),
    isFinished: () => finished,
  };
}
