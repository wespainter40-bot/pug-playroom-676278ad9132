import { startLava } from './lava.js';
import { startHide } from './hide.js';
import { startBelAir } from './belair.js';

export const GAMES = [
  {
    id: 'lava',
    title: 'The Floor Is Lava',
    blurb: 'Hop across the Christmas platforms. Do not touch the lava!',
    start: startLava,
  },
  {
    id: 'hide',
    title: 'Run and Hide',
    blurb: 'Sneak past silly Bolt the Party Bear, grab all the bones, then run for the door!',
    start: startHide,
    input: { jumpLabel: 'RUN', extras: true },
    music: 'hide',
  },
  {
    id: 'belair',
    title: "DJ Marshmallow's Bel Air Escape",
    blurb: 'Find three Bee Key Cards and sneak past the Grinch. Watch out, he might be dressed as a bee!',
    start: startBelAir,
    input: { jumpLabel: 'RUN', extras: true, throwLabel: 'DANCE' },
    music: 'game',
  },
];
