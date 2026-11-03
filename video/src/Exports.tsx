import React from 'react';
import { AbsoluteFill, Composition, Sequence, interpolate, useCurrentFrame } from 'remotion';
import { C, FPS, SANS, SERIF } from './theme';
import { CUTS_16x9, Wide } from './Root';
import { Card, IconTile, Mark } from './components/ui';
import { out } from './data';

/** The 16:9 film, silent, starting at film frame `from`, scaled into a smaller canvas (letterboxed in paper). */
const FilmAt: React.FC<{ from: number; w: number; h: number }> = ({ from, w, h }) => {
  const k = w / 1920;
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <div style={{ position: 'absolute', left: 0, top: (h - 1080 * k) / 2, width: 1920, height: 1080, transform: `scale(${k})`, transformOrigin: 'top left' }}>
        <Sequence from={-from}><Wide lang="en" music={false} /></Sequence>
      </div>
    </AbsoluteFill>
  );
};

/** Six seconds from selection to answer (Root imports this file, so read its cuts at render time), dipping to paper at the seam so it loops cleanly. */
const LOOP_LEN = 180;
const Loop: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 6, LOOP_LEN - 8, LOOP_LEN - 1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ background: C.paper }}><AbsoluteFill style={{ opacity: o }}><FilmAt from={CUTS_16x9.aha} w={1280} h={720} /></AbsoluteFill></AbsoluteFill>;
};

/** Store screenshots are frames of the film: the real pill and card, restyled only in colour. Frames are listed in scripts/render.mjs. */
const Shot: React.FC<{ frame: number }> = ({ frame }) => <FilmAt from={frame} w={1280} h={800} />;

/** Promo tiles: brand first, little text, saturated ink ground, per the store's promo image advice. */
const ED = out('editorial');
const PHRASE = 'an apology written in advance';
const Phrase: React.FC<{ size: number }> = ({ size }) => (
  <div style={{ fontFamily: SERIF, fontSize: size, color: '#C9CED8', lineHeight: 1.35 }}>
    …less a strategy than <span style={{ color: C.ink }}><Mark progress={1} edge={Math.max(2, size * 0.12)}>{PHRASE}.</Mark></span>
  </div>
);
const Promo: React.FC<{ w: number; h: number }> = ({ w, h }) => w / h > 2 ? (
  <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', left: 96, top: 110, width: 640 }}>
      <IconTile size={132} />
      <div style={{ marginTop: 34, fontFamily: SANS, fontWeight: 800, fontSize: 78, letterSpacing: '-0.035em', color: C.paper, lineHeight: 1 }}>ContextReader</div>
      <div style={{ marginTop: 22 }}><Phrase size={30} /></div>
    </div>
    <div style={{ position: 'absolute', right: 90, top: 92, transform: 'rotate(-2deg)' }}>
      <Card s={1.3} width={540} mode={ED.response.mode} summary={ED.response.summary} sections={[]} left="29 left today" />
    </div>
  </AbsoluteFill>
) : (
  <AbsoluteFill style={{ background: C.ink, padding: '36px 34px' }}>
    <IconTile size={64} />
    <div style={{ marginTop: 18, fontFamily: SANS, fontWeight: 800, fontSize: 40, letterSpacing: '-0.035em', color: C.paper, lineHeight: 1 }}>ContextReader</div>
    <div style={{ marginTop: 12 }}><Phrase size={20} /></div>
  </AbsoluteFill>
);

export const ExportCompositions: React.FC = () => (
  <>
    <Composition id="Loop" component={Loop} durationInFrames={LOOP_LEN} fps={FPS} width={1280} height={720} />
    <Composition id="Shot" component={Shot} defaultProps={{ frame: 268 }} durationInFrames={1} fps={FPS} width={1280} height={800} />
    <Composition id="PromoSmall" component={Promo} defaultProps={{ w: 440, h: 280 }} durationInFrames={1} fps={FPS} width={440} height={280} />
    <Composition id="PromoMarquee" component={Promo} defaultProps={{ w: 1400, h: 560 }} durationInFrames={1} fps={FPS} width={1400} height={560} />
  </>
);
