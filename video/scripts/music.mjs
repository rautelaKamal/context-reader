/**
 * Prepares the soundtrack. The track is under the Pixabay Content Licence, which
 * doesn't allow redistributing the file on its own, so it stays out of git:
 * this downloads it, stretches it to the film's 108 BPM, and writes public/music/track-108.wav.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';

const SRC = 'https://cdn.pixabay.com/download/audio/2026/09/01/audio_3cc4031836.mp3?filename=alexrockbeat-minimal-corporate-inspiration-595636.mp3';
const SOURCE_BPM = 101; // measured from onsets; checked by re-measuring the stretched file at 108.00
const FIRST_BEAT = 0.116; // seconds into the stretched file; trimmed so beat 1 lands on frame 0
const dir = 'public/music', raw = `${dir}/source.mp3`, out = `${dir}/track-108.wav`;

mkdirSync(dir, { recursive: true });
if (!existsSync(raw)) execFileSync('curl', ['-sSfL', '-e', 'https://pixabay.com/', '-o', raw, SRC], { stdio: 'inherit' });
execFileSync('npx', ['remotion', 'ffmpeg', '-y', '-v', 'error', '-i', raw, '-af',
  `atempo=${(108 / SOURCE_BPM).toFixed(6)},atrim=start=${FIRST_BEAT},asetpts=PTS-STARTPTS,loudnorm=I=-16:TP=-1.5:LRA=11`,
  '-ar', '48000', out], { stdio: 'inherit' });
console.log(`wrote ${out}`);
