'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A text button that opens the film in a modal <dialog>. showModal() makes the
 * rest of the page inert, so focus stays inside, and Esc closes it natively.
 * The video is only added on first open, pauses on close, and focus goes back
 * to the button.
 */
export function WatchFilm() {
  const [opened, setOpened] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  const open = () => {
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
      <dialog ref={dialog} className="film-dialog" aria-label="ContextReader film, 35 seconds"
        onClick={(e) => { if (e.target === dialog.current) close(); }}>
        <button type="button" className="film-close" onClick={close}>Close</button>
        {opened && (
          <video ref={video} className="film" controls autoPlay playsInline width={1280} height={720}
            aria-label="ContextReader product film. It shows ContextReader explaining a newspaper editorial.">
            <source src="/media/film-16x9.mp4" type="video/mp4" />
          </video>
        )}
      </dialog>
    </>
  );
}
