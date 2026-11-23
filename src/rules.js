const MAX_TICK = 5;

function localDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function createPlayClock({ now = () => new Date(), store, limitSeconds = 3600, enabled = true }) {
  let on = store.load('limitEnabled', enabled) !== false;
  const saved = store.load('playclock', null);
  let state = saved && typeof saved.date === 'string' && Number.isFinite(saved.seconds) && saved.seconds >= 0
    ? { date: saved.date, seconds: saved.seconds }
    : { date: localDate(now()), seconds: 0 };

  function roll() {
    const today = localDate(now());
    if (today > state.date) {
      state = { date: today, seconds: 0 };
      store.save('playclock', state);
    }
  }

  return {
    tick(dt, playing) {
      if (!on || !playing || !Number.isFinite(dt) || dt <= 0) return;
      roll();
      state.seconds = Math.min(limitSeconds, state.seconds + Math.min(dt, MAX_TICK));
      store.save('playclock', state);
    },
    secondsToday() { roll(); return state.seconds; },
    remaining() { roll(); return on ? Math.max(0, limitSeconds - state.seconds) : Infinity; },
    isLocked() { roll(); return on && state.seconds >= limitSeconds; },
    isEnabled() { return on; },
    setEnabled(value) { on = !!value; store.save('limitEnabled', on); },
  };
}

export function recordRun(store, levelId, seconds, devMode) {
  const times = store.load('bestTimes', {});
  const best = times && typeof times === 'object' ? times : {};
  if (devMode || !Number.isFinite(seconds) || seconds <= 0) return { isBest: false, best: best[levelId] ?? null };
  const prev = best[levelId];
  const isBest = !Number.isFinite(prev) || seconds < prev;
  if (isBest) {
    best[levelId] = seconds;
    store.save('bestTimes', best);
  }
  return { isBest, best: best[levelId] };
}

export function addBones(store, n) {
  if (!Number.isFinite(n) || n <= 0) return boneTotal(store);
  const total = boneTotal(store) + Math.floor(n);
  store.save('bones', total);
  return total;
}

export function boneTotal(store) {
  const v = store.load('bones', 0);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

export function isUnlocked(store, key, devMode = false) {
  if (devMode) return true;
  const u = store.load('unlocks', {});
  return !!(u && typeof u === 'object' && u[key] === true);
}

export function grantUnlock(store, key) {
  const u = store.load('unlocks', {});
  const next = u && typeof u === 'object' && !Array.isArray(u) ? u : {};
  next[key] = true;
  store.save('unlocks', next);
}
