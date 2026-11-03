'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import poster from '../../../public/media/hero-poster.jpg';

const ALT = 'A sentence in an article is highlighted, the Explain button appears, and a card opens with what the writer means.';
/** The poster is frame 150 of the loop, so playback starts there and the swap is invisible. */
const POSTER_AT = 5;

/**
 * The poster renders first and is the page's largest image. The loop replaces
 * it once the page is idle, already sought to the poster's frame, with no
 * crossfade: layering the two would show both passages at once. It never loads
 * when the reader has asked for less motion.
 */
export function HeroLoop() {
  const [play, setPlay] = useState(false);
  const [ready, setReady] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Wait until the page has loaded and the browser is idle, so the loop never
    // competes with the poster and the text for the first paint.
    const start = () => ('requestIdleCallback' in window ? requestIdleCallback(() => setPlay(true)) : setTimeout(() => setPlay(true), 200));
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => window.removeEventListener('load', start);
  }, []);
  const onSeeked = () => {
    if (ready) return;
    video.current?.play().then(() => setReady(true)).catch(() => {});
  };
  return (
    <div className="hero-visual">
      <Image src={poster} alt={ALT} priority sizes="(max-width: 900px) 92vw, 540px" className={ready ? 'gone' : ''} />
      {play && (
        <video ref={video} className={ready ? 'loop ready' : 'loop'} muted loop playsInline preload="auto" aria-hidden="true"
          onLoadedMetadata={(e) => { e.currentTarget.currentTime = POSTER_AT; }} onSeeked={onSeeked}>
          <source src="/media/hero-loop.webm" type="video/webm" />
          <source src="/media/hero-loop.mp4" type="video/mp4" />
        </video>
      )}
    </div>
  );
}
