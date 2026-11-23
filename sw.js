// Offline cache: saves every game file on the first visit, then serves from the phone and refreshes quietly when online.
const CACHE = 'pug-playroom-v5';
const FILES = [
  './', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './lib/three.module.js', './lib/three.core.js',
  './src/audio.js', './src/bel-characters.js', './src/buddy.js', './src/characters.js', './src/football-characters.js', './src/input.js', './src/main.js',
  './src/music.js', './src/physics.js', './src/rules.js', './src/storage.js', './src/ui.js',
  './src/games/belair-layout.js', './src/games/belair-scene.js', './src/games/belair.js', './src/games/blitz-logic.js', './src/games/football-ai.js', './src/games/football-blitz.js', './src/games/football-layout.js', './src/games/football-scene.js', './src/games/football.js', './src/games/hide-layout.js', './src/games/hide-nav.js', './src/games/hide-scare.js',
  './src/games/hide-scene.js', './src/games/hide.js', './src/games/lava.js',
  './src/games/layout.js', './src/games/registry.js', './src/games/seeker.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const fresh = fetch(e.request).then((res) => {
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
