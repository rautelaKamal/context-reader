'use client';

import Image from 'next/image';
import { useState } from 'react';
import poster from '../../../public/media/film-poster.jpg';

/**
 * A poster and a play button until someone asks for the film. A bare <video>
 * with a poster shows the browser's loading spinner over it, and fetches the
 * poster up front; this loads nothing until it scrolls near, and the film only
 * on click.
 */
export function Film() {
  const [playing, setPlaying] = useState(false);
  if (playing) {
    return (
      <video className="film" controls autoPlay playsInline width={1280} height={720}
        aria-label="ContextReader product film, 35 seconds. It shows ContextReader explaining a newspaper editorial.">
        <source src="/media/film-16x9.mp4" type="video/mp4" />
      </video>
    );
  }
  return (
    <button type="button" className="film film-poster" onClick={() => setPlaying(true)}
      aria-label="Play the 35-second film">
      <Image src={poster} alt="" sizes="(max-width: 1160px) 92vw, 1112px" />
      <span className="play" aria-hidden="true" />
    </button>
  );
}
