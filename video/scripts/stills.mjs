/** Renders review stills at the busiest moment of each scene that matters. */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const STILLS = [
  ['Film', 268, '16x9-1-aha'], ['Film', 461, '16x9-2-answer'], ['Film', 573, '16x9-3-any'], ['Film', 1040, '16x9-4-end'],
  ['Vertical', 80, '9x16-1-hook'], ['Vertical', 168, '9x16-2-aha'], ['Vertical', 361, '9x16-3-answer'], ['Vertical', 607, '9x16-4-end'],
  ['FilmHinglish', 85, 'hinglish-1-hook'], ['FilmHinglish', 461, 'hinglish-2-answer'], ['FilmHinglish', 823, 'hinglish-3-trust'], ['FilmHinglish', 1040, 'hinglish-4-end'],
];
const only = process.argv[2];
mkdirSync('out/stills', { recursive: true });
for (const [comp, frame, name] of STILLS) {
  if (only && !name.startsWith(only)) continue;
  execFileSync('npx', ['remotion', 'still', 'src/index.ts', comp, `out/stills/${name}.png`, `--frame=${frame}`, '--log=error'], { stdio: 'inherit' });
  console.log(`  ${name}.png  (${comp} @ frame ${frame})`);
}
