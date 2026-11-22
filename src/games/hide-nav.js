// Pure room graph + door routing for the pizzeria. No Three.js, no DOM.
// rooms = [{ id, minX, maxX, minZ, maxZ }], doors = [{ id, rooms: [idA, idB], x, z }] (x, z = door center).

const DROP_NEAR = 0.6;

export function createNav(rooms, doors) {
  const index = new Map(rooms.map((r, i) => [r.id, i]));
  // Adjacency built once, in door order, so BFS tie-breaks are deterministic.
  const adj = rooms.map(() => []);
  for (const d of doors) {
    const a = index.get(d.rooms[0]), b = index.get(d.rooms[1]);
    if (a === undefined || b === undefined) continue;
    adj[a].push({ to: b, door: d });
    adj[b].push({ to: a, door: d });
  }

  function roomIndexAt(x, z) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      const dx = x < r.minX ? r.minX - x : x > r.maxX ? x - r.maxX : 0;
      const dz = z < r.minZ ? r.minZ - z : z > r.maxZ ? z - r.maxZ : 0;
      if (dx === 0 && dz === 0) return i;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD) { bestD = d2; best = i; }
    }
    return best;
  }

  const roomAt = (x, z) => rooms[roomIndexAt(x, z)].id;

  function route(from, to) {
    const start = roomIndexAt(from.x, from.z), goal = roomIndexAt(to.x, to.z);
    if (start === goal) return [to];
    // BFS over rooms; prev[i] = the edge we arrived by.
    const prev = new Array(rooms.length).fill(null);
    const seen = new Uint8Array(rooms.length);
    seen[start] = 1;
    const queue = [start];
    for (let h = 0; h < queue.length && !seen[goal]; h++) {
      const cur = queue[h];
      for (const e of adj[cur]) {
        if (seen[e.to]) continue;
        seen[e.to] = 1;
        prev[e.to] = { from: cur, door: e.door };
        queue.push(e.to);
      }
    }
    if (!seen[goal]) return [to];
    const points = [to];
    for (let at = goal; at !== start; at = prev[at].from) {
      const d = prev[at].door;
      points.push({ x: d.x, z: d.z });
    }
    points.reverse();
    // Already standing in the doorway: skip leading door points.
    let skip = 0;
    while (skip < points.length - 1 && Math.hypot(points[skip].x - from.x, points[skip].z - from.z) < DROP_NEAR) skip++;
    return skip ? points.slice(skip) : points;
  }

  function routeLength(from, to) {
    let len = 0, px = from.x, pz = from.z;
    for (const p of route(from, to)) {
      len += Math.hypot(p.x - px, p.z - pz);
      px = p.x; pz = p.z;
    }
    return len;
  }

  return { roomAt, route, routeLength };
}
