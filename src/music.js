export const noteFreq = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Jingle Bells chorus (public domain). Each note is [midi, beats].
const MELODY = [
  [64, 1], [64, 1], [64, 2], [64, 1], [64, 1], [64, 2],
  [64, 1], [67, 1], [60, 1.5], [62, 0.5], [64, 4],
  [65, 1], [65, 1], [65, 1.5], [65, 0.5],
  [65, 1], [64, 1], [64, 1], [64, 0.5], [64, 0.5],
  [64, 1], [62, 1], [62, 1], [64, 1],
  [62, 2], [67, 2],
];
const BASS_ROOTS = [48, 48, 48, 48, 53, 53, 48, 43];

// Original tiptoe tune in D minor for the hide game.
const HIDE_MELODY = [
  [62, 1], [65, 0.5], [62, 0.5], [69, 1], [65, 1],
  [64, 1], [67, 0.5], [64, 0.5], [70, 1], [67, 1],
  [65, 1], [69, 0.5], [65, 0.5], [72, 1], [69, 1],
  [62, 1], [64, 0.5], [65, 0.5], [64, 1], [62, 1],
  [62, 1], [65, 0.5], [62, 0.5], [69, 1], [65, 1],
  [70, 1], [69, 0.5], [67, 0.5], [65, 1], [64, 1],
  [65, 0.5], [67, 0.5], [69, 0.5], [70, 0.5], [72, 1], [69, 1],
  [62, 2], [62, 0.5], [64, 0.5], [62, 1],
];
const HIDE_BASS = [50, 52, 53, 50, 50, 46, 53, 45];

export const TUNES = {
  menu: { bpm: 96, volume: 0.5, melodyWave: 'triangle', bassWave: 'sine', melody: MELODY, bassRoots: BASS_ROOTS },
  game: { bpm: 140, volume: 0.7, melodyWave: 'square', bassWave: 'triangle', melody: MELODY, bassRoots: BASS_ROOTS },
  hide: { bpm: 104, volume: 0.55, melodyWave: 'triangle', bassWave: 'sine', melody: HIDE_MELODY, bassRoots: HIDE_BASS },
};

export function buildEvents(tune) {
  const events = [];
  let beat = 0;
  for (const [midi, dur] of tune.melody) {
    events.push({ beat, midi, dur: dur * 0.92, voice: 'melody' });
    beat += dur;
  }
  const loopBeats = beat;
  tune.bassRoots.forEach((root, bar) => {
    events.push({ beat: bar * 4, midi: root, dur: 1.6, voice: 'bass' });
    events.push({ beat: bar * 4 + 2, midi: root + 7, dur: 1.6, voice: 'bass' });
  });
  events.sort((a, b) => a.beat - b.beat);
  return { events, loopBeats };
}
