'use client';

import { useState } from 'react';

export const STORE = 'https://chromewebstore.google.com/detail/jncoindjikmapfahhnljenbplfboglhf';
const URL = 'https://context-reader.vercel.app/';

/**
 * On a computer, the store button. On a touch device, where the add-on can't
 * run, a way to send the page to a laptop: the phone's share sheet where there
 * is one, otherwise a copied link. CSS picks which shows, by input type.
 */
export function Install({ label = "Add to Chrome, it's free" }: { label?: string }) {
  const [status, setStatus] = useState('');
  const flash = (text: string) => {
    setStatus(text);
    setTimeout(() => setStatus(''), 2400);
  };
  const send = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ContextReader',
          text: 'ContextReader, a free Chrome add-on that explains hard sentences. Open this on your laptop:',
          url: URL,
        });
        return;
      } catch (e) {
        // Closing the share sheet is a choice, not a failure.
        if ((e as Error).name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(URL);
      flash('Link copied');
    } catch {
      flash('Copy this: context-reader.vercel.app');
    }
  };
  return (
    <div className="install">
      <a className="button desktop-only" href={STORE}>{label}</a>
      <div className="touch-only">
        <button type="button" className="button" onClick={send}>{status || 'Send to my laptop'}</button>
        <span className="sr-only" aria-live="polite">{status}</span>
        <a className="store-link" href={STORE}>Open in Chrome Web Store</a>
      </div>
    </div>
  );
}
