import React, { useLayoutEffect, useRef, useState } from 'react';
import { Img, spring, staticFile, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { C, SANS, SERIF, SERIF_ITALIC } from '../theme';

/** Spring from 0 to 1 starting at frame `at`. Nothing in the film moves linearly. */
export const useSp = (at: number, damping = 200, mass = 1) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame < at ? 0 : spring({ frame: frame - at, fps, config: { damping, mass } });
};

/** Lines that arrive one after another, never all at once. */
export const Caption: React.FC<{
  lines: string[]; at: number[]; size: number; color?: string;
  align?: 'left' | 'center'; style?: React.CSSProperties;
}> = ({ lines, at, size, color = C.ink, align = 'center', style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start', gap: size * 0.18, ...style }}>
      {lines.map((line, i) => {
        const p = frame < at[i] ? 0 : spring({ frame: frame - at[i], fps, config: { damping: 18, mass: 0.7 } });
        return (
          <div key={line} style={{
            fontFamily: SANS, fontWeight: 800, fontSize: size, letterSpacing: '-0.035em',
            lineHeight: 1.05, color, textAlign: align,
            opacity: Math.min(1, p * 1.4),
            transform: `translateY(${(1 - p) * size * 0.45}px)`,
          }}>{line}</div>
        );
      })}
    </div>
  );
};

/**
 * The highlighter. A yellow fill plus a thin gold edge along the bottom, both
 * sweeping together, so it reads as a shape (3.53:1) and not only as a tint.
 */
export const Mark: React.FC<{
  progress: number; pale?: boolean; pulse?: number; edge: number; children: React.ReactNode;
}> = ({ progress, pale, pulse = 0, edge, children }) => {
  const w = `${Math.max(0, Math.min(1, progress)) * 100}%`;
  const fill = pale ? C.yellowPale : C.yellow;
  return (
    <span style={{
      backgroundImage: `linear-gradient(${C.gold}, ${C.gold}), linear-gradient(${fill}, ${fill})`,
      backgroundSize: `${w} ${edge}px, ${w} 100%`,
      backgroundPosition: 'left bottom, left top',
      backgroundRepeat: 'no-repeat',
      padding: '0.04em 0.06em', margin: '0 -0.06em', borderRadius: 3,
      boxShadow: pulse ? `0 0 0 ${pulse * edge * 2.2}px rgba(255,216,77,${0.55 * pulse})` : undefined,
      WebkitBoxDecorationBreak: 'clone', boxDecorationBreak: 'clone',
    }}>{children}</span>
  );
};

/** A calm browser window. Grey dots only: no red anywhere. */
export const Browser: React.FC<{ w: number; h: number; url: string; s: number; children: React.ReactNode; style?: React.CSSProperties }> =
  ({ w, h, url, s, children, style }) => (
    <div style={{
      width: w, height: h, background: C.card, borderRadius: 18 * s, overflow: 'visible', position: 'relative',
      boxShadow: `0 ${40 * s}px ${110 * s}px rgba(20,33,61,0.16), 0 ${10 * s}px ${28 * s}px rgba(20,33,61,0.07)`,
      ...style,
    }}>
      <div style={{
        height: 44 * s, borderBottom: `1px solid ${C.rule}`, display: 'flex', alignItems: 'center',
        gap: 8 * s, padding: `0 ${18 * s}px`, borderRadius: `${18 * s}px ${18 * s}px 0 0`, background: '#F6F4EE',
      }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ width: 11 * s, height: 11 * s, borderRadius: 99, background: '#CFCBBF' }} />)}
        <div style={{
          marginLeft: 16 * s, flex: 1, maxWidth: w * 0.55, height: 26 * s, borderRadius: 99, background: C.card,
          border: `1px solid ${C.rule}`, display: 'flex', alignItems: 'center', padding: `0 ${14 * s}px`,
          fontFamily: SANS, fontSize: 12.5 * s, color: C.inkSoft,
        }}>{url}</div>
      </div>
      <div style={{ position: 'relative', height: h - 44 * s }}>{children}</div>
    </div>
  );

/** The real pill: "Explain" plus the Windows shortcut hint, exactly as content.js renders it. */
export const Pill: React.FC<{ s: number; press?: number }> = ({ s, press = 0 }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 6 * s, padding: `${6 * s}px ${10 * s}px`,
    borderRadius: 999, background: C.ink, color: '#FFFFFF', fontFamily: SANS, fontWeight: 500,
    fontSize: 12 * s, lineHeight: 1, transform: `scale(${1 - press * 0.08})`,
    boxShadow: `0 ${2 * s}px ${12 * s}px rgba(20,33,61,0.28)`,
  }}>
    Explain
    <span style={{
      fontFamily: SANS, fontSize: 10 * s, opacity: 0.72, border: '1px solid rgba(255,255,255,0.35)',
      borderRadius: 3 * s, padding: `${2 * s}px ${4 * s}px`,
    }}>Ctrl⇧E</span>
  </div>
);

export const Cursor: React.FC<{ x: number; y: number; s: number; press?: number }> = ({ x, y, s, press = 0 }) => (
  <svg width={26 * s} height={36 * s} viewBox="0 0 26 36" style={{
    position: 'absolute', left: x, top: y, transform: `scale(${1 - press * 0.12})`, transformOrigin: 'top left',
    filter: 'drop-shadow(0 3px 5px rgba(20,33,61,0.3))', zIndex: 20,
  }}>
    <path d="M2 2 L2 28 L9 21.5 L13.5 32 L18 30 L13.6 19.8 L23 19.5 Z" fill={C.ink} stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

const CHIPS: [string, string][] = [
  ['plain', 'Plain meaning'], ['point', "What's the point?"], ['lines', 'Line by line'],
  ['craft', 'How it works'], ['jargon', 'The jargon'],
];

/** Wraps each occurrence of the given phrases in a pulsing mark, without changing the text. */
const withPulses = (text: string, phrases: string[], pulse: number, edge: number) => {
  if (!phrases.length) return text;
  const re = new RegExp(`(${phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return text.split(re).map((part, i) =>
    phrases.includes(part)
      ? <Mark key={i} progress={1} pulse={pulse} edge={edge}>{part}</Mark>
      : <React.Fragment key={i}>{part}</React.Fragment>);
};

/**
 * The real explanation card: chips, summary, labelled sections, footer with
 * the allowance, Go deeper and Close. Measurements are content.js's, scaled
 * by `s`; only the colours change.
 */
export const Card: React.FC<{
  s: number; mode: string; verse?: boolean; loading?: boolean;
  summary?: string; sections?: { label: string; body: string }[];
  reveal?: number[]; pulses?: string[]; pulse?: number; left?: string; width?: number;
  /** content.js caps the card's height and scrolls its middle; chips and footer stay pinned. */
  maxH?: number;
  /** Which block to scroll to the top of the body: 0 summary, 1 first section, fractional while moving. */
  scrollTo?: number;
}> = ({ s, mode, verse, loading, summary, sections = [], reveal = [], pulses = [], pulse = 0, left = 'ContextReader', width, maxH, scrollTo = 0 }) => {
  const chips = CHIPS.filter(([id]) => !(verse && id === 'jargon'));
  const blocks = useRef<(HTMLElement | null)[]>([]);
  const view = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [tops, setTops] = useState<number[]>([]);
  const [maxScroll, setMaxScroll] = useState(0);
  useLayoutEffect(() => {
    const t = blocks.current.map((b) => b?.offsetTop ?? 0);
    if (t.join() !== tops.join()) setTops(t);
    // A real scroll stops when the end of the content reaches the bottom.
    const m = Math.max(0, (inner.current?.offsetHeight ?? 0) - (view.current?.clientHeight ?? 0));
    if (m !== maxScroll) setMaxScroll(m);
  });
  const a = Math.floor(scrollTo), b = Math.min(a + 1, tops.length - 1);
  const want = tops.length ? (tops[a] ?? 0) + ((tops[b] ?? 0) - (tops[a] ?? 0)) * (scrollTo - a) - (tops[0] ?? 0) : 0;
  const offset = Math.min(want, maxScroll);
  const showIn = (p: number) => ({ opacity: Math.min(1, p * 1.3), transform: `translateY(${(1 - p) * 14 * s}px)` });
  return (
    <div style={{
      width: width ?? 420 * s, background: C.card, color: C.ink, borderRadius: 12 * s,
      border: `1px solid ${C.rule}`, fontFamily: SANS, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', maxHeight: maxH,
      boxShadow: `0 ${18 * s}px ${60 * s}px rgba(20,33,61,0.20), 0 ${4 * s}px ${14 * s}px rgba(20,33,61,0.08)`,
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 * s, padding: `${10 * s}px ${12 * s}px`, borderBottom: `1px solid ${C.rule}` }}>
        {chips.map(([id, label]) => (
          <div key={id} style={{
            fontWeight: 500, fontSize: 11.5 * s, lineHeight: 1, padding: `${5 * s}px ${9 * s}px`, borderRadius: 999,
            border: `1px solid ${id === mode ? C.blue : C.rule}`, background: id === mode ? C.blue : C.chip,
            color: id === mode ? '#FFFFFF' : C.inkSoft, opacity: loading ? 0.45 : 1,
          }}>{label}</div>
        ))}
      </div>
      <div ref={view} style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
      <div ref={inner} style={{ padding: `${12 * s}px ${14 * s}px ${4 * s}px`, transform: `translateY(${-offset}px)`, position: 'relative' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 * s, padding: `${4 * s}px 0 ${12 * s}px`, color: C.inkSoft, fontSize: 14 * s }}>
            <div style={{ width: 14 * s, height: 14 * s, borderRadius: 99, border: `${2 * s}px solid ${C.inkSoft}`, borderRightColor: 'transparent' }} />
            Reading the passage…
          </div>
        ) : (
          <>
            {summary && <p ref={(el) => { blocks.current[0] = el; }} style={{ margin: `0 0 ${14 * s}px`, fontSize: 14.5 * s, lineHeight: 1.55, ...showIn(reveal[0] ?? 1) }}>{withPulses(summary, pulses, pulse, 3 * s)}</p>}
            {sections.map((sec, i) => (
              <div key={sec.label} ref={(el) => { blocks.current[i + 1] = el; }} style={{ margin: `0 0 ${12 * s}px`, ...showIn(reveal[i + 1] ?? 1) }}>
                <p style={verse ? {
                  margin: `0 0 ${3 * s}px`, fontFamily: SERIF_ITALIC, fontStyle: 'italic', fontSize: 13 * s, color: C.blue,
                } : {
                  margin: `0 0 ${3 * s}px`, fontSize: 11 * s, fontWeight: 600, letterSpacing: '0.04em',
                  textTransform: 'uppercase', color: C.blue,
                }}>{sec.label}</p>
                <p style={{ margin: 0, fontSize: 14 * s, lineHeight: 1.55 }}>{withPulses(sec.body, pulses, pulse, 3 * s)}</p>
              </div>
            ))}
          </>
        )}
      </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12 * s, padding: `${8 * s}px ${14 * s}px`,
        borderTop: `1px solid ${C.rule}`, fontSize: 11.5 * s, color: C.inkSoft,
      }}>
        <span>{left}</span><span style={{ flex: 1 }} />
        <span style={{ textDecoration: 'underline' }}>Go deeper</span>
        <span style={{ textDecoration: 'underline' }}>Close</span>
      </div>
    </div>
  );
};

export const Serif: React.FC<{ size: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ size, children, style }) => (
  <div style={{ fontFamily: SERIF, fontSize: size, lineHeight: 1.62, color: C.ink, ...style }}>{children}</div>
);

export const lerp = interpolate;

/** The icon's own superellipse (store-assets/_squircle.txt), so a tile around it keeps an even border. */
const SQUIRCLE = 'M128.0 64.0 L127.98 80.72 L127.94 86.06 L127.86 89.93 L127.75 93.08 L127.61 95.77 L127.44 98.15 L127.23 100.28 L127.0 102.22 L126.73 104.01 L126.43 105.67 L126.09 107.21 L125.73 108.66 L125.33 110.02 L124.89 111.3 L124.42 112.5 L123.92 113.64 L123.38 114.72 L122.8 115.74 L122.18 116.71 L121.53 117.63 L120.83 118.5 L120.1 119.32 L119.32 120.1 L118.5 120.83 L117.63 121.53 L116.71 122.18 L115.74 122.8 L114.72 123.38 L113.64 123.92 L112.5 124.42 L111.3 124.89 L110.02 125.33 L108.66 125.73 L107.21 126.09 L105.67 126.43 L104.01 126.73 L102.22 127.0 L100.28 127.23 L98.15 127.44 L95.77 127.61 L93.08 127.75 L89.93 127.86 L86.06 127.94 L80.72 127.98 L64.0 128.0 L47.28 127.98 L41.94 127.94 L38.07 127.86 L34.92 127.75 L32.23 127.61 L29.85 127.44 L27.72 127.23 L25.78 127.0 L23.99 126.73 L22.33 126.43 L20.79 126.09 L19.34 125.73 L17.98 125.33 L16.7 124.89 L15.5 124.42 L14.36 123.92 L13.28 123.38 L12.26 122.8 L11.29 122.18 L10.37 121.53 L9.5 120.83 L8.68 120.1 L7.9 119.32 L7.17 118.5 L6.47 117.63 L5.82 116.71 L5.2 115.74 L4.62 114.72 L4.08 113.64 L3.58 112.5 L3.11 111.3 L2.67 110.02 L2.27 108.66 L1.91 107.21 L1.57 105.67 L1.27 104.01 L1.0 102.22 L0.77 100.28 L0.56 98.15 L0.39 95.77 L0.25 93.08 L0.14 89.93 L0.06 86.06 L0.02 80.72 L0.0 64.0 L0.02 47.28 L0.06 41.94 L0.14 38.07 L0.25 34.92 L0.39 32.23 L0.56 29.85 L0.77 27.72 L1.0 25.78 L1.27 23.99 L1.57 22.33 L1.91 20.79 L2.27 19.34 L2.67 17.98 L3.11 16.7 L3.58 15.5 L4.08 14.36 L4.62 13.28 L5.2 12.26 L5.82 11.29 L6.47 10.37 L7.17 9.5 L7.9 8.68 L8.68 7.9 L9.5 7.17 L10.37 6.47 L11.29 5.82 L12.26 5.2 L13.28 4.62 L14.36 4.08 L15.5 3.58 L16.7 3.11 L17.98 2.67 L19.34 2.27 L20.79 1.91 L22.33 1.57 L23.99 1.27 L25.78 1.0 L27.72 0.77 L29.85 0.56 L32.23 0.39 L34.92 0.25 L38.07 0.14 L41.94 0.06 L47.28 0.02 L64.0 0.0 L80.72 0.02 L86.06 0.06 L89.93 0.14 L93.08 0.25 L95.77 0.39 L98.15 0.56 L100.28 0.77 L102.22 1.0 L104.01 1.27 L105.67 1.57 L107.21 1.91 L108.66 2.27 L110.02 2.67 L111.3 3.11 L112.5 3.58 L113.64 4.08 L114.72 4.62 L115.74 5.2 L116.71 5.82 L117.63 6.47 L118.5 7.17 L119.32 7.9 L120.1 8.68 L120.83 9.5 L121.53 10.37 L122.18 11.29 L122.8 12.26 L123.38 13.28 L123.92 14.36 L124.42 15.5 L124.89 16.7 L125.33 17.98 L125.73 19.34 L126.09 20.79 L126.43 22.33 L126.73 23.99 L127.0 25.78 L127.23 27.72 L127.44 29.85 L127.61 32.23 L127.75 34.92 L127.86 38.07 L127.94 41.94 L127.98 47.28 L128.0 64.0 Z';

/** The real store icon on a plain white tile of the same shape. */
export const IconTile: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => {
  const inset = size * 0.075;
  return (
    <div style={{ position: 'relative', width: size, height: size, ...style }}>
      <svg viewBox="0 0 128 128" width={size} height={size} style={{ position: 'absolute', inset: 0, overflow: 'visible', filter: `drop-shadow(0 ${size * 0.07}px ${size * 0.16}px rgba(20,33,61,0.13)) drop-shadow(0 1px 2px rgba(20,33,61,0.08))` }}>
        <path d={SQUIRCLE} fill={C.card} />
      </svg>
      <Img src={staticFile('icon.png')} style={{ position: 'absolute', left: inset, top: inset, width: size - 2 * inset, height: size - 2 * inset }} />
    </div>
  );
};
