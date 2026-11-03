import React from 'react';
import { AbsoluteFill, Composition, Sequence, interpolate, useCurrentFrame } from 'remotion';
import { useSp } from './components/ui';
import { C, FPS, SANS } from './theme';
import { CUTS_16x9, Wide } from './Root';
import { Card, IconTile, Mark, Pill, Serif } from './components/ui';
import { ANY, Page } from './scenes/scenes';
import { section } from './data';
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


/**
 * Store screenshots, drawn natively at 1280x800: one plain caption, the real
 * page, pill and card filling the rest. Sized so body text stays readable when
 * the store shows the image at about 640px wide.
 */
const SHOT_CAPTIONS = [
  'Select any sentence. Click Explain.',
  'Get what the writer actually means.',
  'Poems, line by line.',
  'Jargon in plain words.',
  'Legal text in plain English.',
];
const ShotCaption: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: 'absolute', left: 64, top: 40, fontFamily: SANS, fontWeight: 800, fontSize: 50, letterSpacing: '-0.03em', color: C.ink, lineHeight: 1 }}>{text}</div>
);
const StoreShot: React.FC<{ n: number }> = ({ n }) => {
  const r = ED.response;
  let body: React.ReactNode;
  if (n === 1) {
    body = <Page v={false} fs={34} bw={1152} bh={630} x={64} y={124} select={1} tilt={0} zoom={1} origin="50% 50%" pad={48}
      overlay={<Pill s={2.3} />} />;
  } else if (n === 2) {
    const card = <Card s={1.75} width={1080} mode={r.mode} summary={r.summary} sections={r.sections} fitBlocks={2} left="29 left today" />;
    body = <Page v={false} fs={28} bw={1152} bh={720} x={64} y={104} select={1} tilt={0} zoom={1} origin="50% 50%" pad={26}
      scrollToMarked overlay={card} />;
  } else {
    const item = ANY[n - 3], o = out(item.id);
    const sec = item.label ? section(item.id, item.label) : null;
    body = (
      <div style={{ position: 'absolute', left: 64, right: 64, top: 112, bottom: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 28, color: C.inkSoft, marginBottom: 10 }}>{item.kind}</div>
        <Serif size={38} style={{ marginBottom: 28 }}><Mark progress={1} pale edge={4}>{item.source}</Mark></Serif>
        <Card s={2.25} width={1152} mode={o.response.mode} verse={item.verse}
          summary={sec ? undefined : o.response.summary} sections={sec ? [sec] : []} left="29 left today" />
      </div>
    );
  }
  return <AbsoluteFill style={{ background: C.paper, overflow: 'hidden' }}><ShotCaption text={SHOT_CAPTIONS[n - 1]} />{body}</AbsoluteFill>;
};

/** Promo tiles: brand first, little text, saturated ink ground, per the store's promo image advice. */
const ED = out('editorial');
const BENEFIT = 'Understand any hard sentence you read online.';
const Benefit: React.FC<{ size: number }> = ({ size }) => (
  <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: size, color: '#D5D9E2', lineHeight: 1.3, letterSpacing: '-0.01em', textWrap: 'balance' }}>{BENEFIT}</div>
);
const Promo: React.FC<{ w: number; h: number }> = ({ w, h }) => w / h > 2 ? (
  <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', left: 96, top: 110, width: 640 }}>
      <IconTile size={132} />
      <div style={{ marginTop: 34, fontFamily: SANS, fontWeight: 800, fontSize: 78, letterSpacing: '-0.035em', color: C.paper, lineHeight: 1 }}>ContextReader</div>
      <div style={{ marginTop: 22 }}><Benefit size={34} /></div>
    </div>
    <div style={{ position: 'absolute', right: 90, top: 92, transform: 'rotate(-2deg)' }}>
      <Card s={1.3} width={540} mode={ED.response.mode} summary={ED.response.summary} sections={[]} left="29 left today" />
    </div>
  </AbsoluteFill>
) : (
  <AbsoluteFill style={{ background: C.ink, padding: '36px 34px' }}>
    <IconTile size={64} />
    <div style={{ marginTop: 18, fontFamily: SANS, fontWeight: 800, fontSize: 40, letterSpacing: '-0.035em', color: C.paper, lineHeight: 1 }}>ContextReader</div>
    <div style={{ marginTop: 12 }}><Benefit size={23} /></div>
  </AbsoluteFill>
);

/**
 * The website's hero loop: the product alone, no film captions, framed close on
 * the page and card. Select, pill, click, answer, then a dip to paper at the seam.
 */
const HERO_LEN = 180;
const HeroLoop: React.FC = () => {
  const f = useCurrentFrame();
  const r = ED.response;
  const drag = useSp(8, 26);
  const pill = useSp(40, 11, 0.6);
  const press = f >= 64 && f < 74 ? Math.sin(((f - 64) / 10) * Math.PI) : 0;
  const open = f >= 74;
  const scroll = useSp(76, 24);
  const rise = useSp(76, 18);
  const reveals = [useSp(94), useSp(112)];
  const fade = interpolate(f, [0, 6, HERO_LEN - 8, HERO_LEN - 1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const overlay = open ? (
    <div style={{ opacity: Math.min(1, rise * 1.4), transform: `translateY(${(1 - rise) * 30}px)` }}>
      <Card s={1.9} width={912} fitBlocks={2} mode={r.mode} loading={f < 92} summary={r.summary} sections={r.sections}
        reveal={[...reveals, 0, 0]} left="29 left today" />
    </div>
  ) : pill > 0.01 ? (
    <div style={{ opacity: Math.min(1, pill * 1.5), transform: `translateY(${(1 - pill) * 10}px) scale(${0.85 + pill * 0.15})`, transformOrigin: 'left top' }}>
      <Pill s={2.3} press={press} />
    </div>
  ) : null;
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <AbsoluteFill style={{ opacity: fade }}>
        <Page v={false} fs={34} bw={1000} bh={1040} x={40} y={40} pad={44} select={drag} tilt={0} zoom={1} origin="50% 50%"
          scrollToMarked scrollMix={scroll} overlay={overlay}
          cursorAt={open ? undefined : f < 40 ? drag : 1 + interpolate(f, [40, 62], [0, 1], { extrapolateRight: 'clamp' })} press={press} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Open Graph image, in the film's end-card style. */
const OgImage: React.FC = () => (
  <AbsoluteFill style={{ background: C.paper, alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
      <IconTile size={132} />
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 88, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1 }}>ContextReader</div>
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 38, letterSpacing: '-0.02em', color: C.inkSoft }}>Understand any hard sentence you read online.</div>
      <div style={{ marginTop: 8, fontFamily: SANS, fontWeight: 800, fontSize: 40, letterSpacing: '-0.025em', color: C.ink }}>
        <Mark progress={1} edge={5}>A free Chrome add-on</Mark>
      </div>
    </div>
  </AbsoluteFill>
);

export const ExportCompositions: React.FC = () => (
  <>
    <Composition id="Loop" component={Loop} durationInFrames={LOOP_LEN} fps={FPS} width={1280} height={720} />
    <Composition id="HeroLoop" component={HeroLoop} durationInFrames={HERO_LEN} fps={FPS} width={1080} height={1080} />
    <Composition id="OgImage" component={OgImage} durationInFrames={1} fps={FPS} width={1200} height={630} />
    <Composition id="StoreShot" component={StoreShot} defaultProps={{ n: 1 }} durationInFrames={1} fps={FPS} width={1280} height={800} />
    <Composition id="PromoSmall" component={Promo} defaultProps={{ w: 440, h: 280 }} durationInFrames={1} fps={FPS} width={440} height={280} />
    <Composition id="PromoMarquee" component={Promo} defaultProps={{ w: 1400, h: 560 }} durationInFrames={1} fps={FPS} width={1400} height={560} />
  </>
);
