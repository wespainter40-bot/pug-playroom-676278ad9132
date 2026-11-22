export const JOKES = [
  'Why did the pug cross the lava? To get to the other slide!',
  'What do you call a pug in a Santa hat? Santa Paws!',
  'Why was the floor so hot? It was feeling a little lava-ly.',
  'What do snowmen eat for breakfast? Snowflakes!',
  'Why did the robot go on vacation? To recharge its batteries!',
  'What do you call a dog magician? A labracadabrador!',
  'Why do bones never go to parties? They have no body to go with!',
  'What is a pug’s favorite kind of music? Anything with a good howl-ing beat!',
  'How does a gingerbread man stay safe? He wears a cookie-proof vest!',
  'What did the lava say to the volcano? I lava you a lot!',
];

export function createJokeTeller(rng = Math.random) {
  let last = -1;
  return {
    next() {
      const r = Number(rng());
      let i = Number.isFinite(r) ? Math.min(JOKES.length - 1, Math.max(0, Math.floor(r * JOKES.length))) : 0;
      if (i === last) i = (i + 1) % JOKES.length;
      last = i;
      return JOKES[i];
    },
  };
}

// Nearest moving hazard (not the ridable platform) within `range`, measured on the ground plane.
export function nearestHazard(player, obstacles, range) {
  let best = null;
  for (const o of obstacles) {
    if (o.kind === 'slider') continue;
    const cx = (o.min.x + o.max.x) / 2, cz = (o.min.z + o.max.z) / 2;
    const distance = Math.hypot(cx - player.x, cz - player.z);
    if (distance <= range && (!best || distance < best.distance)) best = { id: o.id, kind: o.kind, distance };
  }
  return best;
}
