'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A text button that opens the film in a modal <dialog>. showModal() makes the
 * rest of the page inert, so focus stays inside, and Esc closes it natively.
 * The video is only added on first open, pauses on close, and focus goes back
 * to the button. On a phone held upright it plays the vertical cut.
 */
export function WatchFilm() {
  const [opened, setOpened] = useState(false);
  // A phone held upright gets the vertical cut; everything else the 16:9 film.
  const [tall, setTall] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  const open = () => {
    if (!opened) setTall(window.matchMedia('(hover: none) and (pointer: coarse) and (orientation: portrait)').matches);
    setOpened(true);
    dialog.current?.showModal();
    video.current?.play().catch(() => {});
  };
  const close = () => dialog.current?.close();

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onClose = () => {
      video.current?.pause();
      button.current?.focus();
    };
    d.addEventListener('close', onClose);
    return () => d.removeEventListener('close', onClose);
  }, []);

  return (
    <>
      <button ref={button} type="button" className="watch" onClick={open} aria-haspopup="dialog">
        <span aria-hidden="true">▶</span> Watch the 35-second film
      </button>
      <dialog ref={dialog} className={tall ? 'film-dialog tall' : 'film-dialog'} aria-label="ContextReader film, 35 seconds"
        onClick={(e) => { if (e.target === dialog.current) close(); }}>
        <button type="button" className="film-close" onClick={close}>Close</button>
        {opened && (
          <video ref={video} className="film" controls autoPlay playsInline width={tall ? 1080 : 1280} height={tall ? 1920 : 720}
            aria-label="ContextReader product film. It shows ContextReader explaining a newspaper editorial.">
            <source src={tall ? '/media/film-9x16.mp4' : '/media/film-16x9.mp4'} type="video/mp4" />
          </video>
        )}
      </dialog>
    </>
  );
}
