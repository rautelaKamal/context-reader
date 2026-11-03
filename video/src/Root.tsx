import React from 'react';
import { AbsoluteFill, Composition, Html5Audio, Sequence, interpolate, staticFile } from 'remotion';
import { C, FPS } from './theme';
import { Lang } from './copy';
import { Answer, AnyReading, Aha, End, Hook, Struggle, Trust } from './scenes/scenes';
import { ExportCompositions } from './Exports';

/** Scene starts in frames. At 108 BPM a bar is 66.67 frames; every cut sits on a beat. */
export const CUTS_16x9 = { hook: 0, struggle: 100, aha: 200, answer: 300, any: 533, trust: 733, end: 900, total: 1065 };
export const CUTS_9x16 = { hook: 0, aha: 100, answer: 200, trust: 400, end: 483, total: 617 };

/** Drums enter at frame 533 of the stretched track, which is the 16:9 cut into the montage. */
const DROP = 533;

/** Music, trimmed so the drop lands on `dropAt`, with a short fade in and a 1.5s fade out. */
const Soundtrack: React.FC<{ dropAt: number; total: number }> = ({ dropAt, total }) => (
  <Html5Audio src={staticFile('music/track-108.wav')} trimBefore={DROP - dropAt}
    volume={(f) => interpolate(f, [0, 6, total - 45, total - 1], [0, 0.9, 0.9, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
);

export const Wide: React.FC<{ lang: Lang; music?: boolean }> = ({ lang, music = true }) => {
  const c = CUTS_16x9; const p = { v: false, lang };
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      {music && <Soundtrack dropAt={c.any} total={c.total} />}
      <Sequence durationInFrames={c.struggle}><Hook {...p} /></Sequence>
      <Sequence from={c.struggle} durationInFrames={c.aha - c.struggle}><Struggle {...p} /></Sequence>
      <Sequence from={c.aha} durationInFrames={c.answer - c.aha}><Aha {...p} /></Sequence>
      <Sequence from={c.answer} durationInFrames={c.any - c.answer}><Answer {...p} /></Sequence>
      <Sequence from={c.any} durationInFrames={c.trust - c.any}><AnyReading {...p} /></Sequence>
      <Sequence from={c.trust} durationInFrames={c.end - c.trust}><Trust {...p} /></Sequence>
      <Sequence from={c.end}><End {...p} /></Sequence>
    </AbsoluteFill>
  );
};

const Tall: React.FC = () => {
  const c = CUTS_9x16; const p = { v: true, lang: 'en' as Lang };
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Soundtrack dropAt={c.end} total={c.total} />
      <Sequence durationInFrames={c.aha}><Hook {...p} /></Sequence>
      <Sequence from={c.aha} durationInFrames={c.answer - c.aha}><Aha {...p} /></Sequence>
      <Sequence from={c.answer} durationInFrames={c.trust - c.answer}><Answer {...p} sectionsShown={2} /></Sequence>
      <Sequence from={c.trust} durationInFrames={c.end - c.trust}><Trust {...p} gap={22} /></Sequence>
      <Sequence from={c.end}><End {...p} /></Sequence>
    </AbsoluteFill>
  );
};

export const Root: React.FC = () => (
  <>
    <Composition id="Film" component={Wide} defaultProps={{ lang: 'en' as Lang }} durationInFrames={CUTS_16x9.total} fps={FPS} width={1920} height={1080} />
    <Composition id="FilmHinglish" component={Wide} defaultProps={{ lang: 'hi' as Lang }} durationInFrames={CUTS_16x9.total} fps={FPS} width={1920} height={1080} />
    <Composition id="Vertical" component={Tall} durationInFrames={CUTS_9x16.total} fps={FPS} width={1080} height={1920} />
    <ExportCompositions />
  </>
);
