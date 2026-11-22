const PREFIX = 'pug.';

export function createStorage(backend) {
  return {
    load(key, fallback) {
      try {
        const raw = backend.getItem(PREFIX + key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    save(key, value) {
      try {
        backend.setItem(PREFIX + key, JSON.stringify(value));
      } catch {
        // storage blocked or full: the game keeps running without saving
      }
    },
  };
}
