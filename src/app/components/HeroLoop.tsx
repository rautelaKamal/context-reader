'use client';

import { getImageProps } from 'next/image';
import { useEffect, useRef, useState } from 'react';
import square from '../../../public/media/hero-poster.jpg';
import tall from '../../../public/media/hero-poster-tall.jpg';

const ALT = 'A sentence in an article is highlighted, the Explain button appears, and a card opens with what the writer means.';
/** Both posters are frame 150 of their loop, so playback starts there and the swap is invisible. */
const POSTER_AT = 5;
/** Small screens get a 4:5 crop, so the highlight and the card show larger. */
export const SMALL = '(max-width: 600px)';

/**
 * The poster renders first and is the page's largest image. The loop replaces
 * it once the page is idle, already sought to the poster's frame, with no
 * crossfade: layering the two would show both passages at once. It never loads
 * when the reader has asked for less motion, and if the browser refuses to
 * play (iOS Low Power Mode, for one) the poster simply stays.
 */
export function HeroLoop() {
  const [play, setPlay] = useState(false);
  const [ready, setReady] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Wait until the page has loaded and the browser is idle, so the loop never
    // competes with the poster and the text for the first paint.
    const start = () => ('requestIdleCallback' in window ? requestIdleCallback(() => setPlay(true)) : setTimeout(() => setPlay(true), 200));
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => window.removeEventListener('load', start);
  }, []);

  // React sets muted as a property but doesn't write the attribute, and iOS
  // checks for it before allowing inline autoplay. Set both before loading.
  const attach = (el: HTMLVideoElement | null) => {
    video.current = el;
    if (!el) return;
    el.muted = true;
    el.defaultMuted = true;
    el.setAttribute('muted', '');
  };
  // WebKit can refuse the first play() if it arrives as the seek lands and
  // accept it once the element reports it can play, so try at both moments.
  // If every attempt is refused, the poster simply stays.
  const tryPlay = () => {
    const v = video.current;
    if (ready || !v || v.seeking) return;
    v.play().then(() => setReady(true)).catch(() => {});
  };

  const common = { alt: ALT, priority: true };
  const small = getImageProps({ ...common, src: tall, sizes: '92vw' }).props;
  const { props: large } = getImageProps({ ...common, src: square, sizes: '(max-width: 900px) 92vw, 540px' });
  return (
    <div className="hero-visual">
      <picture className={ready ? 'gone' : ''}>
        <source media={SMALL} srcSet={small.srcSet} sizes={small.sizes} width={small.width} height={small.height} />
        <img {...large} alt={ALT} />
      </picture>
      {play && (
        <video ref={attach} className="loop" autoPlay muted loop playsInline preload="auto"
          aria-hidden="true" onLoadedMetadata={(e) => { e.currentTarget.currentTime = POSTER_AT; }} onSeeked={tryPlay} onCanPlay={tryPlay}>
          {/* H.264 first: iOS Safari can answer "maybe" for WebM and then fail without falling back. */}
          <source media={SMALL} src="/media/hero-loop-tall.mp4" type="video/mp4" />
          <source media={SMALL} src="/media/hero-loop-tall.webm" type="video/webm" />
          <source src="/media/hero-loop.mp4" type="video/mp4" />
          <source src="/media/hero-loop.webm" type="video/webm" />
        </video>
      )}
    </div>
  );
}
