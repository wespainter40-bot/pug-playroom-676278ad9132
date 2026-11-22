export const STANCE_NOISE = { still: 0, tiptoe: 0, walk: 5, run: 10 };

const SIGHT_RANGE = 9, SIGHT_HALF_ANGLE = 0.6, TICKLE_DIST = 1.3, TICKLE_HOLD = 1.5;
const LOSE_AFTER = 2, INVESTIGATE_WAIT = 2, INVESTIGATE_MAX = 6, TURN_RATE = 6;
// How much of a step has to survive pushOut to count as going somewhere: under a fifth is wedged
// rather than sliding, and once he is rounding a prop it takes nine tenths to aim straight again.
// PROBE_* is the dry run that picks which way round a prop to go.
const WEDGED = 0.2, RESUME = 0.9, PROBE_DIST = 3, PROBE_STEP = 0.3;

// Is the straight line from A to B inside any box (grown by pad)? Boxes are checked in the xz plane.
export function segmentBlocked(ax, az, bx, bz, boxes, pad = 0) {
  const o = [ax, az], d = [bx - ax, bz - az];
  for (const b of boxes) {
    const lo = [b.min.x - pad, b.min.z - pad], hi = [b.max.x + pad, b.max.z + pad];
    let t0 = 0, t1 = 1, hit = true;
    for (let i = 0; i < 2 && hit; i++) {
      if (Math.abs(d[i]) < 1e-9) {
        if (o[i] < lo[i] || o[i] > hi[i]) hit = false;
      } else {
        let ta = (lo[i] - o[i]) / d[i], tb = (hi[i] - o[i]) / d[i];
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 > t1) hit = false;
      }
    }
    if (hit) return true;
  }
  return false;
}

const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function canSee(seeker, target, boxes, opts = {}) {
  const range = opts.range ?? SIGHT_RANGE, half = opts.halfAngle ?? SIGHT_HALF_ANGLE;
  const dx = target.x - seeker.x, dz = target.z - seeker.z;
  const dist = Math.hypot(dx, dz);
  if (dist > range) return false;
  if (dist > 0.01 && Math.abs(angleDiff(Math.atan2(dx, dz), seeker.facing)) > half) return false;
  return !segmentBlocked(seeker.x, seeker.z, target.x, target.z, boxes);
}

// Push a circle out of any box it overlaps (xz plane).
function pushOut(pos, radius, boxes) {
  for (const b of boxes) {
    const cx = Math.max(b.min.x, Math.min(pos.x, b.max.x));
    const cz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d = Math.hypot(dx, dz);
    if (d >= radius) continue;
    if (d > 1e-6) {
      pos.x = cx + (dx / d) * radius;
      pos.z = cz + (dz / d) * radius;
    } else {
      const opts = [
        [pos.x - b.min.x, -1, 0], [b.max.x - pos.x, 1, 0], [pos.z - b.min.z, 0, -1], [b.max.z - pos.z, 0, 1],
      ].sort((p, q) => p[0] - q[0])[0];
      pos.x += opts[1] * (opts[0] + radius);
      pos.z += opts[2] * (opts[0] + radius);
    }
  }
}

export function createSeeker({ waypoints, boxes, sightBoxes = boxes, patrolSpeed = 2, chaseSpeed = 4.2, radius = 0.6, nav = null }) {
  const me = {
    x: waypoints[0].x, z: waypoints[0].z, facing: 0, state: 'patrol',
  };
  let wp = waypoints.length > 1 ? 1 : 0;
  let scale = 1, asleep = 0, loseT = 0, tickleT = 0, invT = 0, waitT = 0;
  let sideStep = 0; // 0 = walking straight at the target, +1/-1 = rounding a prop on that side
  let target = { x: me.x, z: me.z }, lastSeen = { x: me.x, z: me.z };
  let pending = [];

  // Walking distance when there is a room graph, straight line otherwise.
  const distTo = (x, z) => (nav ? nav.routeLength(me, { x, z }) : Math.hypot(x - me.x, z - me.z));

  const nearestWp = () => {
    let best = 0, bd = Infinity;
    waypoints.forEach((w, i) => { const d = distTo(w.x, w.z); if (d < bd) { bd = d; best = i; } });
    return best;
  };

  function faceToward(tx, tz, dt) {
    const want = Math.atan2(tx - me.x, tz - me.z);
    const diff = angleDiff(want, me.facing);
    const step = TURN_RATE * dt;
    me.facing += Math.max(-step, Math.min(step, diff));
  }

  // One step of `step` units heading (vx, vz), with `got` = how much of it survived pushOut.
  // Sliding along a face keeps most of it; a corner keeps almost none.
  function tryStep(vx, vz, step) {
    const pos = { x: me.x + vx * step, z: me.z + vz * step };
    pushOut(pos, radius, boxes);
    return { pos, got: (pos.x - me.x) * vx + (pos.z - me.z) * vz };
  }

  // How far a slide heading (vx, vz) would get before a prop stops it, up to PROBE_DIST.
  function probe(vx, vz) {
    const at = { x: me.x, z: me.z };
    let gone = 0;
    for (let i = 0; i < Math.round(PROBE_DIST / PROBE_STEP); i++) {
      const pos = { x: at.x + vx * PROBE_STEP, z: at.z + vz * PROBE_STEP };
      pushOut(pos, radius, boxes);
      const got = (pos.x - at.x) * vx + (pos.z - at.z) * vz;
      at.x = pos.x;
      at.z = pos.z;
      if (got <= PROBE_STEP * WEDGED) break;
      gone += got;
    }
    return gone;
  }

  function moveToward(tx, tz, speed, dt) {
    const dx = tx - me.x, dz = tz - me.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) return 0;
    faceToward(tx, tz, dt);
    const step = Math.min(d, speed * scale * dt);
    const ux = dx / d, uz = dz / d;
    const straight = tryStep(ux, uz, step);
    // Walking straight is fine as long as it gets somewhere — nothing in the way, or a face he can
    // slide along. Once he is rounding a prop though, it takes a properly clear line to go back to
    // it: a trickle of progress along the prop is exactly what wedged him in the first place.
    if (straight.got > step * (sideStep ? RESUME : WEDGED)) {
      sideStep = 0;
      me.x = straight.pos.x;
      me.z = straight.pos.z;
      return d;
    }
    // Wedged: a prop flush against a wall leaves no gap to squeeze through, so walk along it
    // instead. The side is chosen once (whichever way slides further) and kept until that way jams
    // too, so he rounds the prop instead of dithering in the corner.
    if (sideStep === 0) sideStep = probe(uz, -ux) >= probe(-uz, ux) ? 1 : -1;
    let out = tryStep(sideStep * uz, sideStep * -ux, step);
    if (out.got <= step * WEDGED) {
      sideStep = -sideStep;
      out = tryStep(sideStep * uz, sideStep * -ux, step);
      if (out.got <= step * WEDGED) sideStep = 0; // boxed in on all three: re-choose next tick
    }
    me.x = out.pos.x;
    me.z = out.pos.z;
    return d;
  }

  // Like moveToward, but heads for the next doorway on the way to the target. The distance it
  // returns is Infinity until the doorways are behind us, so arrival checks cannot fire at a door.
  function moveAlong(tx, tz, speed, dt) {
    if (!nav) return moveToward(tx, tz, speed, dt);
    const hop = nav.route({ x: me.x, z: me.z }, { x: tx, z: tz })[0];
    const d = moveToward(hop.x, hop.z, speed, dt);
    return hop.x === tx && hop.z === tz ? d : Infinity;
  }

  function investigate(x, z) {
    me.state = 'investigate';
    target = { x, z };
    invT = 0;
    waitT = 0;
  }

  function hearNoise(x, z, r) {
    if (asleep > 0 || me.state === 'chase' || me.state === 'tickle') return;
    if (distTo(x, z) > r) return;
    if (me.state === 'patrol') pending.push('heard');
    investigate(x, z);
  }

  function reset(index, sleepSeconds) {
    const w = waypoints[index];
    me.x = w.x;
    me.z = w.z;
    wp = (index + 1) % waypoints.length;
    me.state = 'patrol';
    me.facing = Math.atan2(waypoints[wp].x - me.x, waypoints[wp].z - me.z);
    asleep = sleepSeconds;
    loseT = tickleT = invT = waitT = sideStep = 0;
    pending = [];
  }

  function step(dt, world) {
    const events = pending;
    pending = [];
    const p = world.player;

    if (asleep > 0) { asleep -= dt; return events; }

    if (me.state === 'tickle') {
      tickleT -= dt;
      if (tickleT <= 0) me.state = 'patrol';
      return events;
    }

    const sees = !world.hidden && canSee(me, p, sightBoxes);
    const dist = Math.hypot(p.x - me.x, p.z - me.z);

    if (me.state !== 'chase') {
      if (sees) {
        me.state = 'chase';
        loseT = 0;
        lastSeen = { x: p.x, z: p.z };
        events.push('spotted');
      } else {
        const r = STANCE_NOISE[world.stance] ?? 0;
        if (r > 0 && (nav ? distTo(p.x, p.z) : dist) <= r) {
          if (me.state === 'patrol') events.push('heard');
          investigate(p.x, p.z);
        }
      }
    }

    if (me.state === 'chase') {
      if (sees) {
        loseT = 0;
        lastSeen = { x: p.x, z: p.z };
        if (dist < TICKLE_DIST) {
          me.state = 'tickle';
          tickleT = TICKLE_HOLD;
          events.push('tickle');
          return events;
        }
      } else {
        loseT += dt;
        if (loseT >= LOSE_AFTER) {
          events.push('lost');
          investigate(lastSeen.x, lastSeen.z);
        }
      }
      if (me.state === 'chase') moveAlong(lastSeen.x, lastSeen.z, chaseSpeed, dt);
    } else if (me.state === 'investigate') {
      invT += dt;
      const d = moveAlong(target.x, target.z, patrolSpeed * 1.4, dt);
      if (d < 0.5) waitT += dt;
      if (waitT >= INVESTIGATE_WAIT || invT >= INVESTIGATE_MAX) {
        me.state = 'patrol';
        wp = nearestWp();
      }
    } else {
      const w = waypoints[wp];
      if (moveAlong(w.x, w.z, patrolSpeed, dt) < 0.3) wp = (wp + 1) % waypoints.length;
    }
    return events;
  }

  return Object.assign(me, {
    step, hearNoise, reset,
    setSpeedScale(k) { scale = k; },
  });
}
