import React, { useLayoutEffect, useRef, useState } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, SANS, SERIF } from '../theme';
import { COPY, Lang } from '../copy';
import { out, section } from '../data';
import { Browser, Caption, Card, Cursor, IconTile, Mark, Pill, Serif, useSp, lerp } from '../components/ui';

export type Props = { v: boolean; lang: Lang };

/* ---------- the editorial, taken apart from the saved request, never retyped ---------- */
const ED = out('editorial');
const [BEFORE, REST] = ED.request.markedParagraph!.split('«');
const [SELECTION, AFTER] = REST.split('»');
const Q1 = 'would not be unfair to say';
const Q2 = 'an apology written in advance';
const PULSES = [Q1, Q2];

/** The selected sentence, with the two quoted phrases addressable for the pulse. */
const Selection: React.FC<{ progress: number; pale?: boolean; pulse?: number; edge: number }> = ({ progress, pale, pulse = 0, edge }) => {
  const parts = SELECTION.split(new RegExp(`(${Q1}|${Q2})`));
  return (
    <Mark progress={progress} pale={pale} edge={edge}>
      {parts.map((p, i) => PULSES.includes(p) && pulse > 0
        ? <Mark key={i} progress={1} pulse={pulse} edge={edge}>{p}</Mark>
        : <React.Fragment key={i}>{p}</React.Fragment>)}
    </Mark>
  );
};

/* ---------- the page ---------- */
/**
 * Sizes are in output pixels so phone legibility is set directly: passage text
 * stays at 36px or more at 1080p, card body text at 30px or more.
 */
const PAD = (v: boolean) => (v ? 46 : 54);
type Pt = { x: number; y: number };
/** Offset of `el` inside `root`, summed through offset parents (transforms don't affect it). */
const offsetIn = (el: HTMLElement | null, root: HTMLElement | null): Pt => {
  let x = 0, y = 0, n: HTMLElement | null = el;
  while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent as HTMLElement | null; }
  return { x, y };
};

/**
 * The article page inside the browser. Pill and card overlay it below the selection,
 * as in the product. The cursor lives in the page too, placed from measured text
 * positions: `cursorAt` 0 is the selection start, 1 its end, 2 the pill.
 */
const Page: React.FC<{
  v: boolean; fs: number; bw: number; bh: number; x?: number; y: number;
  select: number; reread?: number; pale?: boolean; pulse?: number;
  overlay?: React.ReactNode; tilt: number; zoom: number; origin: string;
  scrollToMarked?: boolean; cursorAt?: number; press?: number;
}> = ({ v, fs, bw, bh, x, y, select, reread = -1, pale, pulse, overlay, tilt, zoom, origin, scrollToMarked, cursorAt, press = 0 }) => {
  const W = v ? 1080 : 1920, pad = PAD(v);
  const root = useRef<HTMLDivElement>(null), a = useRef<HTMLSpanElement>(null), b = useRef<HTMLSpanElement>(null);
  const marked = useRef<HTMLDivElement>(null), anchor = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<{ a: Pt; b: Pt; pill: Pt; top: number } | null>(null);
  useLayoutEffect(() => {
    const next = { a: offsetIn(a.current, root.current), b: offsetIn(b.current, root.current), pill: offsetIn(anchor.current, root.current), top: offsetIn(marked.current, root.current).y };
    if (JSON.stringify(next) !== JSON.stringify(m)) setM(next);
  });
  const scroll = scrollToMarked && m ? m.top - pad : 0;
  let cur: Pt | null = null;
  if (cursorAt !== undefined && m) {
    const pill = { x: m.pill.x + fs * 1.1, y: m.pill.y + fs * 0.75 };
    const [p, q, t] = cursorAt <= 1 ? [m.a, m.b, cursorAt] : [m.b, pill, cursorAt - 1];
    // While dragging, the pointer sits on the text line, not above it.
    const lift = cursorAt <= 1 ? fs * 0.55 : 0;
    cur = { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t + lift * (1 - Math.max(0, cursorAt - 1)) };
  }
  return (
    <div style={{ position: 'absolute', left: x ?? (W - bw) / 2, top: y, perspective: 2400, transform: `scale(${zoom})`, transformOrigin: origin }}>
      <div style={{ transform: `rotateX(${tilt * 7}deg) rotateY(${tilt * -9}deg) rotateZ(${tilt * 0.6}deg)`, transformStyle: 'preserve-3d' }}>
        <Browser w={bw} h={bh} s={1.1} url="example.org/opinion/a-plan-for-last-summer">
          {/* A scrolled page clips at the browser edge, like a real tab. */}
          <div style={{ height: '100%', overflow: scrollToMarked ? 'hidden' : 'visible' }}>
            <div ref={root} style={{ position: 'relative', padding: `${pad}px`, transform: `translateY(${-scroll}px)` }}>
              <Serif size={fs} style={{ color: C.inkSoft, marginBottom: fs * 0.9, opacity: scrollToMarked ? 0 : 1 }}>{ED.request.precedingParagraph}</Serif>
              <Serif size={fs}>
                <div ref={marked} style={{ position: 'relative' }}>
                  {/* Rereading: a soft band sweeps across the paragraph. */}
                  {reread >= 0 && <div style={{
                    position: 'absolute', inset: '-0.1em -0.25em', borderRadius: 8, pointerEvents: 'none',
                    background: `linear-gradient(90deg, rgba(20,33,61,0) ${reread * 100 - 16}%, rgba(20,33,61,0.075) ${reread * 100}%, rgba(20,33,61,0) ${reread * 100 + 16}%)`,
                  }} />}
                  {BEFORE}
                  <span ref={a} />
                  <Selection progress={select} pale={pale} pulse={pulse} edge={Math.max(3, fs * 0.11)} />
                  <span ref={b} />
                </div>
              </Serif>
              <div style={{ position: 'relative', height: 0, zIndex: 10 }}>
                <div ref={anchor} style={{ position: 'absolute', top: fs * 0.3, left: 0 }}>{overlay}</div>
              </div>
              <Serif size={fs} style={{ marginTop: fs * 0.9, color: C.inkSoft }}>{AFTER.trim()}</Serif>
              {cur && <Cursor x={cur.x} y={cur.y} s={fs / 22} press={press} />}
            </div>
          </div>
        </Browser>
      </div>
    </div>
  );
};

/* ---------- 1. hook ---------- */
export const Hook: React.FC<Props> = ({ v, lang }) => {
  const f = useCurrentFrame();
  const drift = lerp(f, [0, 100], [0, -30]);
  // The faded sentence sits above the headline, never behind it.
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <div style={{
        position: 'absolute', left: v ? 80 : 150, right: v ? 80 : 150, top: v ? 300 : 70,
        fontFamily: SERIF, color: C.ink, opacity: 0.08, fontSize: v ? 52 : 58, lineHeight: 1.35, transform: `translateY(${drift}px)`,
      }}>{SELECTION.trim()}</div>
      <AbsoluteFill style={{ justifyContent: 'center', padding: v ? '360px 70px 0' : '220px 0 0' }}>
        <Caption lines={COPY[lang].hook} at={[8, 42]} size={v ? 112 : 124} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------- 2. struggle (16:9 only) ---------- */
export const Struggle: React.FC<Props> = ({ v, lang }) => {
  const f = useCurrentFrame();
  const enter = useSp(0, 16, 0.9);
  // Reread: across, back, across again.
  const reread = f < 30 ? -1 : f < 58 ? lerp(f, [30, 58], [0, 1]) : f < 78 ? lerp(f, [58, 78], [1, 0]) : lerp(f, [78, 100], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Page v={v} fs={41} bw={1580} bh={630} y={262 + (1 - enter) * 220} select={0} reread={reread}
        tilt={1 - enter * 0.4} zoom={0.92 + enter * 0.06} origin="50% 30%" />
      <Caption lines={COPY[lang].struggle} at={[22, 56]} size={78}
        style={{ position: 'absolute', left: 0, right: 0, top: 34 }} />
    </AbsoluteFill>
  );
};

/* ---------- 3. aha ---------- */
export const Aha: React.FC<Props> = ({ v, lang }) => {
  const f = useCurrentFrame();
  const drag = useSp(6, 26);
  const pill = useSp(40, 11, 0.6);
  const press = f >= 64 && f < 74 ? Math.sin(((f - 64) / 10) * Math.PI) : 0;
  const push = useSp(70, 22);
  const fs = v ? 38 : 40;
  const cursorAt = f < 40 ? drag : 1 + lerp(f, [40, 62], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Page v={v} fs={fs} bw={v ? 960 : 1580} bh={v ? 820 : 640} y={v ? 330 : 168} select={drag}
        tilt={0.6 - push * 0.45} zoom={0.94 + push * (v ? 0.1 : 0.14)} origin={v ? '30% 55%' : '28% 60%'}
        cursorAt={cursorAt} press={press}
        overlay={pill > 0.01 ? <div style={{ opacity: Math.min(1, pill * 1.5), transform: `translateY(${(1 - pill) * 10}px) scale(${0.85 + pill * 0.15})`, transformOrigin: 'left top' }}><Pill s={fs / 15} press={press} /></div> : null} />
      <Caption lines={COPY[lang].aha} at={[18]} size={v ? 92 : 88}
        style={{ position: 'absolute', left: 0, right: 0, top: v ? 1340 : 36 }} />
    </AbsoluteFill>
  );
};

/* ---------- 4. the answer ---------- */
export const Answer: React.FC<Props & { sectionsShown?: number }> = ({ v, lang, sectionsShown = 3 }) => {
  const f = useCurrentFrame();
  const r = ED.response;
  const sections = r.sections.slice(0, sectionsShown);
  const rise = useSp(0, 18);
  const loaded = f >= 16;
  const reveals = [useSp(20), useSp(44), useSp(v ? 70 : 74), useSp(v ? 96 : 104)];
  // Scroll the body the way the real card does once its content outgrows it.
  const scroll = useSp(v ? 64 : 66, 26) * 1 + useSp(v ? 92 : 98, 26) * (sectionsShown - 1);
  const pulseAt = v ? 128 : 150;
  const pulse = f < pulseAt ? 0 : 0.5 + 0.5 * Math.sin(((f - pulseAt) / 22) * Math.PI * 2 - Math.PI / 2);
  const s = 2.2; // card body 14 x 2.2 = 30.8px
  const card = (
    <div style={{ opacity: Math.min(1, rise * 1.4), transform: `translateY(${(1 - rise) * 40}px)` }}>
      <Card s={s} width={v ? 884 : 940} maxH={v ? 650 : 610} scrollTo={scroll} mode={r.mode} loading={!loaded}
        summary={r.summary} sections={sections} reveal={reveals} pulses={PULSES} pulse={pulse} left="29 left today" />
    </div>
  );
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      {v ? (
        <>
          <Page v fs={37} bw={960} bh={1130} y={470} select={1} pale={f >= pulseAt - 8} pulse={pulse}
            tilt={0.1} zoom={1} origin="30% 30%" scrollToMarked overlay={card} />
          <Caption lines={COPY[lang].answer} at={[28]} size={80}
            style={{ position: 'absolute', left: 60, right: 60, top: 292 }} />
        </>
      ) : (
        <>
          <Page v={false} fs={38} bw={1160} bh={1060} x={56} y={60} select={1} pale={f >= pulseAt - 8} pulse={pulse}
            tilt={0.1} zoom={1} origin="20% 30%" scrollToMarked overlay={card} />
          <Caption lines={COPY[lang].answer} at={[28]} size={84} align="left"
            style={{ position: 'absolute', left: 1290, width: 580, top: 330 }} />
        </>
      )}
    </AbsoluteFill>
  );
};

/* ---------- 5. any hard reading (16:9 only) ---------- */
const ANY = [
  { id: 'poem', verse: true, source: "Bare ruin’d choirs, where late the sweet birds sang.", label: "Bare ruin'd choirs, where late the sweet birds sang.", kind: 'Shakespeare, Sonnet 73' },
  { id: 'research', verse: false, source: 'It may be said that natural selection is daily and hourly scrutinising, throughout the world, every variation…', label: 'natural selection', kind: 'Darwin, On the Origin of Species' },
  { id: 'legal', verse: false, source: '…the court must determine which of these conflicting rules governs the case.', label: null, kind: 'Marbury v. Madison, 1803' },
];
const SLOT = 66;
export const AnyReading: React.FC<Props> = ({ lang }) => {
  const f = useCurrentFrame();
  const slot = Math.min(2, Math.floor(f / SLOT));
  const item = ANY[slot];
  const o = out(item.id);
  const p = useSp(slot * SLOT, 20);
  const sec = item.label ? section(item.id, item.label) : null;
  // Two columns: the reading on the left, the label in its own column on the right.
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <div style={{
        position: 'absolute', left: 96, width: 1150, top: 150,
        opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 40}px) scale(${0.97 + p * 0.03})`, transformOrigin: 'left top',
      }}>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 32, color: C.inkSoft, marginBottom: 14 }}>{item.kind}</div>
        <Serif size={42} style={{ marginBottom: 30 }}><Mark progress={1} pale edge={5}>{item.source}</Mark></Serif>
        <Card s={2.2} width={1150} mode={o.response.mode} verse={item.verse}
          summary={sec ? undefined : o.response.summary} sections={sec ? [sec] : []} left="ContextReader" />
      </div>
      <Caption lines={COPY[lang].any.slice(0, slot + 1 + (f > 180 ? 1 : 0))}
        at={[6, 72, 138, 182]} size={84} align="left"
        style={{ position: 'absolute', left: 1360, top: 300 }} />
    </AbsoluteFill>
  );
};

/* ---------- 6. trust ---------- */
export const Trust: React.FC<Props & { gap?: number }> = ({ v, lang, gap = 33 }) => (
  <AbsoluteFill style={{ background: C.paper, justifyContent: 'center' }}>
    <Caption lines={COPY[lang].trust} at={[8, 8 + gap, 8 + gap * 2]} size={v ? 104 : 104} color={C.blue}
      style={{ padding: v ? '0 70px' : 0 }} />
  </AbsoluteFill>
);

/* ---------- 7. end ---------- */
export const End: React.FC<Props> = ({ v, lang }) => {
  const icon = useSp(4, 14, 0.7);
  const sweep = useSp(52, 26);
  const t = COPY[lang];
  return (
    <AbsoluteFill style={{ background: C.paper, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: v ? 34 : 26, padding: v ? '0 70px' : 0 }}>
        {/* The real store icon, unchanged, on a white tile of its own shape so its colours sit apart from the film's palette. */}
        <IconTile size={v ? 236 : 184} style={{ transform: `scale(${0.6 + icon * 0.4})`, opacity: Math.min(1, icon * 1.5) }} />
        <Caption lines={['ContextReader']} at={[14]} size={v ? 104 : 92} />
        <Caption lines={[t.addOn]} at={[26]} size={v ? 48 : 46} color={C.inkSoft} style={{ fontWeight: 500 }} />
        <div style={{ height: v ? 40 : 22 }} />
        <div style={{ fontFamily: SANS, fontWeight: 800, letterSpacing: '-0.03em', fontSize: v ? 76 : 72, color: C.ink, textAlign: 'center', lineHeight: 1.2 }}>
          <Mark progress={sweep} edge={6}>{t.cta}</Mark>
        </div>
        <Caption lines={[t.search]} at={[70]} size={v ? 40 : 40} color={C.inkSoft} />
      </div>
    </AbsoluteFill>
  );
};
