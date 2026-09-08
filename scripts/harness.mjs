/**
 * Generates public/_dev/, which runs the real content script in an ordinary
 * page with a stand-in for the extension APIs. That exercises selection
 * handling, positioning, the shadow-root card and mode switching against the
 * real API without loading anything into Chrome.
 *
 *   npm run dev        # in one terminal
 *   npm run harness    # then open http://localhost:3000/_dev/index.html
 *
 * The shadow root is opened in this copy only, so the DOM can be inspected.
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', '_dev');
mkdirSync(out, { recursive: true });

const source = readFileSync(join(root, 'src', 'extension', 'content.js'), 'utf8');
writeFileSync(
  join(out, 'content.js'),
  source.replace("attachShadow({ mode: 'closed' })", "attachShadow({ mode: 'open' })"),
);

writeFileSync(join(out, 'index.html'), `<!doctype html>
<meta charset="utf-8">
<title>ContextReader harness</title>
<style>
 body{font:16px/1.7 Georgia,serif;max-width:660px;margin:40px auto;padding:0 20px;color:#1c1917;background:#faf9f7}
 h2{font:600 11px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;color:#a8a29e;margin:36px 0 10px}
</style>

<h2>Verse &mdash; br separated</h2>
<p id="sonnet">Shall I compare thee to a summer's day?<br>
Thou art more lovely and more temperate:<br>
Rough winds do shake the darling buds of May,<br>
And summer's lease hath all too short a date;</p>

<h2>Verse &mdash; one element per line</h2>
<div id="metro"><p>The apparition of these faces in the crowd;</p><p>Petals on a wet, black bough.</p></div>

<h2>Editorial prose</h2>
<article>
<p id="prev">The decision to defer the census once more has been defended on administrative grounds, and there is no doubt that a headcount of this scale is a formidable undertaking.</p>
<p id="edit">But the argument wears thin in its fourth year. Every month of delay compounds an already serious deficit: welfare entitlements are still being apportioned on the basis of a population that no longer exists, and the schemes that depend on them are quietly shrinking in real terms.</p>
</article>

<h2>Technical prose</h2>
<p id="tech">We replace the dense feed-forward block with a sparse mixture-of-experts layer using top-k routing, and add an auxiliary load-balancing loss to keep expert utilisation from collapsing onto a small subset of capacity.</p>

<script>
window.chrome = {
  runtime: {
    lastError: undefined,
    sendMessage(message, callback) {
      const endpoint = message.type === 'translate' ? '/api/translate' : '/api/explain';
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message.payload),
      })
        .then(async (r) => {
          const data = await r.json();
          window.__lastCall = { status: r.status, sent: message.payload, got: data };
          callback(r.ok ? { success: true, data } : { success: false, error: data.error });
        })
        .catch((e) => callback({ success: false, error: e.message }));
    },
  },
};
</script>
<script src="/_dev/content.js"></script>
`);

console.log('harness written to public/_dev/ - open http://localhost:3000/_dev/index.html');
