'use client';

import { useState } from 'react';

export const STORE = 'https://chromewebstore.google.com/detail/jncoindjikmapfahhnljenbplfboglhf';

/**
 * On a computer, the store button. On a phone, where the extension can't run,
 * a way to send yourself the link instead. CSS picks which one shows.
 */
export function Install({ label = "Add to Chrome, it's free" }: { label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText('https://context-reader.vercel.app/');
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="install">
      <a className="button desktop-only" href={STORE}>{label}</a>
      <div className="mobile-only">
        <button type="button" className="button" onClick={copy}>
          {copied ? 'Copied' : 'Works on desktop Chrome. Copy link'}
        </button>
        <span className="sr-only" aria-live="polite">{copied ? 'Link copied' : ''}</span>
        <a className="store-link" href={STORE}>Open in Chrome Web Store</a>
      </div>
    </div>
  );
}
