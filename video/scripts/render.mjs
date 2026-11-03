/** Renders every deliverable into out/. Run `npm run music` first so the soundtrack exists. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';

if (!existsSync('public/music/track-108.wav')) throw new Error('No soundtrack. Run `npm run music` first.');
mkdirSync('out/final', { recursive: true }); mkdirSync('out/exports', { recursive: true });
const run = (...a) => { console.log('>', a.slice(0, 3).join(' ')); execFileSync('npx', ['remotion', ...a, '--log=error'], { stdio: 'inherit' }); };
const R = 'src/index.ts';

for (const [comp, file] of [['Film', 'film-16x9'], ['Vertical', 'film-9x16'], ['FilmHinglish', 'film-16x9-hinglish']])
  run('render', R, comp, `out/final/${file}.mp4`, '--codec=h264', '--crf=18', '--audio-bitrate=192k');

run('render', R, 'Loop', 'out/exports/loop-6s.webm', '--codec=vp9', '--crf=30');
run('render', R, 'Loop', 'out/exports/loop-6s.gif', '--codec=gif', '--every-nth-frame=2', '--scale=0.5', '--number-of-gif-loops=0');

['1-select', '2-meaning', '3-poem', '4-jargon', '5-legal'].forEach((name, i) =>
  run('still', R, 'StoreShot', `out/exports/screenshot-${name}-1280x800.png`, `--props={"n":${i + 1}}`));
run('still', R, 'PromoMarquee', 'out/exports/promo-marquee-1400x560.png');
run('still', R, 'PromoSmall', 'out/exports/promo-small-440x280.png');
run('still', R, 'Film', 'out/exports/thumb-16x9-1280x720.png', '--frame=362', '--scale=0.6667');
run('still', R, 'FilmHinglish', 'out/exports/thumb-16x9-hinglish-1280x720.png', '--frame=362', '--scale=0.6667');
run('still', R, 'Vertical', 'out/exports/thumb-9x16-1080x1920.png', '--frame=262');
