import { noteFreq, TUNES, buildEvents } from './music.js';

// Synthesized sound effects and background music (Web Audio, no files).
export function createAudio({ store, AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
  let muted = store.load('sound', true) === false;
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  let tuneName = null, timer = 0, evIdx = 0, loopStart = 0, built = null;
  const played = {};

  function ensure() {
    if (ctx || !AudioCtx) return ctx;
    try {
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.6;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.8;
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.16;
      musicBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(bus, freq, dur, { wave = 'square', vol = 0.3, to = null, at = 0 } = {}) {
    const t0 = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noise(dur, { vol = 0.4, from = 2400, to = 300, at = 0 } = {}) {
    const t0 = ctx.currentTime + at;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(from, t0);
    f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f);
    f.connect(g);
    g.connect(sfxBus);
    s.start(t0);
    s.stop(t0 + dur + 0.05);
  }

  const SFX = {
    click: () => tone(sfxBus, 620, 0.06, { wave: 'square', vol: 0.18 }),
    jump: () => tone(sfxBus, 300, 0.16, { wave: 'square', vol: 0.2, to: 720 }),
    land: () => tone(sfxBus, 140, 0.1, { wave: 'sine', vol: 0.4, to: 60 }),
    bone: () => { tone(sfxBus, 988, 0.09, { wave: 'triangle', vol: 0.35 }); tone(sfxBus, 1319, 0.22, { wave: 'triangle', vol: 0.35, at: 0.08 }); },
    splash: () => { noise(0.55, { vol: 0.5 }); tone(sfxBus, 260, 0.45, { wave: 'sawtooth', vol: 0.16, to: 70 }); noise(0.4, { vol: 0.12, from: 6000, to: 2500, at: 0.25 }); },
    win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(sfxBus, f, i === 5 ? 0.5 : 0.16, { wave: 'square', vol: 0.22, at: i * 0.13 })),
    glide: () => noise(0.3, { vol: 0.08, from: 1800, to: 900 }),
    throw: () => noise(0.22, { vol: 0.22, from: 3200, to: 700 }),
    thud: () => { tone(sfxBus, 110, 0.14, { wave: 'sine', vol: 0.45, to: 55 }); noise(0.08, { vol: 0.15, from: 900, to: 200 }); },
    boing: () => { tone(sfxBus, 220, 0.18, { wave: 'sine', vol: 0.35, to: 880 }); tone(sfxBus, 880, 0.22, { wave: 'sine', vol: 0.3, to: 330, at: 0.17 }); },
    tickle: () => [660, 740, 830, 990].forEach((f, i) => tone(sfxBus, f, 0.07, { wave: 'square', vol: 0.16, at: i * 0.07 })),
    footstep: () => { tone(sfxBus, 78, 0.2, { wave: 'sine', vol: 0.6, to: 38 }); noise(0.1, { vol: 0.2, from: 500, to: 120 }); },
    honk: () => { tone(sfxBus, 330, 0.28, { wave: 'sawtooth', vol: 0.4, to: 190 }); tone(sfxBus, 240, 0.34, { wave: 'square', vol: 0.3, to: 400, at: 0.2 }); noise(0.18, { vol: 0.25, from: 4000, to: 800 }); },
    door: () => { tone(sfxBus, 523, 0.18, { wave: 'triangle', vol: 0.35 }); tone(sfxBus, 784, 0.4, { wave: 'triangle', vol: 0.35, at: 0.16 }); },
  };

  function sfx(name) {
    if (muted || !SFX[name] || !ctx) return;
    played[name] = (played[name] || 0) + 1;
    try { SFX[name](); } catch { /* audio must never break the game */ }
  }

  function playEvent(e, t) {
    const tune = TUNES[tuneName];
    const spb = 60 / tune.bpm;
    const wave = e.voice === 'bass' ? tune.bassWave : tune.melodyWave;
    const vol = (e.voice === 'bass' ? 0.5 : 0.32) * tune.volume;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.value = noteFreq(e.midi);
    const len = e.dur * spb;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g);
    g.connect(musicBus);
    o.start(t);
    o.stop(t + len + 0.05);
  }

  function pump() {
    if (!ctx || !tuneName || ctx.state !== 'running') return;
    const spb = 60 / TUNES[tuneName].bpm;
    while (true) {
      const e = built.events[evIdx];
      const t = loopStart + e.beat * spb;
      if (t > ctx.currentTime + 0.4) break;
      if (t >= ctx.currentTime - 0.05) playEvent(e, Math.max(t, ctx.currentTime));
      evIdx += 1;
      if (evIdx >= built.events.length) { evIdx = 0; loopStart += built.loopBeats * spb; }
    }
  }

  function startLoop() {
    clearInterval(timer);
    timer = 0;
    if (!ctx || !tuneName) return;
    built = buildEvents(TUNES[tuneName]);
    evIdx = 0;
    loopStart = ctx.currentTime + 0.1;
    timer = setInterval(pump, 100);
    pump();
  }

  // The browser only allows sound after a tap or key press, so nothing is created until unlock().
  function music(name) {
    if (name === tuneName) return;
    tuneName = name;
    startLoop();
  }

  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().then(startLoop, () => {});
    else if (!timer) startLoop();
  }

  function setMuted(v) {
    muted = !!v;
    store.save('sound', !muted);
    if (master) master.gain.value = muted ? 0 : 0.6;
  }

  return {
    sfx, music, unlock, setMuted,
    isMuted: () => muted,
    stats: () => ({ muted, tune: tuneName, played: { ...played }, running: !!ctx && ctx.state === 'running' }),
  };
}
