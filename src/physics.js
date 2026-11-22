const EPS = 1e-6;
const DEFAULT_SIZE = { w: 0.8, h: 1.2, d: 0.8 };

function overlaps(pos, size, box) {
  const hw = size.w / 2, hd = size.d / 2;
  return pos.x + hw > box.min.x + EPS && pos.x - hw < box.max.x - EPS
    && pos.y + size.h > box.min.y + EPS && pos.y < box.max.y - EPS
    && pos.z + hd > box.min.z + EPS && pos.z - hd < box.max.z - EPS;
}

function pushOut(pos, axis, half, boxes, size) {
  for (const box of boxes) {
    if (!overlaps(pos, size, box)) continue;
    const center = (box.min[axis] + box.max[axis]) / 2;
    pos[axis] = pos[axis] < center ? box.min[axis] - half : box.max[axis] + half;
  }
}

// Boxes are already at this step's position; `velocity` (units per second) says how far they just moved.
export function stepBody(body, boxes, input, dt, opts = {}) {
  const speed = opts.speed ?? 6;
  const jumpSpeed = opts.jumpSpeed ?? 9;
  const gravity = opts.gravity ?? 28;
  const size = opts.size ?? DEFAULT_SIZE;
  const { pos, vel } = body;

  if (body.ridingId != null) {
    const ride = boxes.find((b) => b.id === body.ridingId);
    if (ride && ride.velocity) {
      pos.x += ride.velocity.x * dt;
      pos.y += (ride.velocity.y || 0) * dt;
      pos.z += ride.velocity.z * dt;
    }
  }

  vel.x = (input.moveX || 0) * speed;
  vel.z = (input.moveZ || 0) * speed;
  if (input.jump && body.onGround) {
    vel.y = jumpSpeed;
    body.onGround = false;
    body.ridingId = null;
  }
  vel.y -= gravity * dt;

  pos.x += vel.x * dt;
  pushOut(pos, 'x', size.w / 2, boxes, size);
  pos.z += vel.z * dt;
  pushOut(pos, 'z', size.d / 2, boxes, size);

  pos.y += vel.y * dt;
  body.onGround = false;
  body.ridingId = null;
  for (const box of boxes) {
    if (!overlaps(pos, size, box)) continue;
    const boxMid = (box.min.y + box.max.y) / 2;
    if (pos.y + size.h / 2 > boxMid) {
      pos.y = box.max.y;
      if (vel.y < 0) vel.y = 0;
      body.onGround = true;
      body.ridingId = box.id;
    } else {
      pos.y = box.min.y - size.h;
      if (vel.y > 0) vel.y = 0;
    }
  }
  return body;
}

const ABILITIES = {
  glide: { seconds: 1.2, fallSpeed: -2.2 },
  hover: { seconds: 0.7, fallSpeed: 0 },
};

export function createAbilityState() {
  return { left: null };
}

// Call before stepBody each frame. Holding jump while falling slows the fall for a short time; landing refills it.
export function applyAbility(body, special, jumpHeld, state, dt) {
  const spec = ABILITIES[special];
  if (!spec) return;
  if (body.onGround) { state.left = spec.seconds; return; }
  if (state.left === null) state.left = spec.seconds;
  if (!jumpHeld || state.left <= 0 || body.vel.y >= 0) return;
  body.vel.y = Math.max(body.vel.y, spec.fallSpeed);
  state.left -= dt;
}
