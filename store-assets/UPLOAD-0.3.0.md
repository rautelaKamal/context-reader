# Store upload checklist: 0.3.0

Everything for one visit to the Chrome Web Store dashboard. Paths are from
the repository root.

## 0. Before the dashboard
- [ ] `main` is pushed, and Vercel has deployed it. The listing links to
      `/privacy`, which now has the line about text boxes and frames.
- [ ] `node scripts/verify-live.mjs` passes against the live site. Last run:
      a, b, d and e passed; c was skipped because Go deeper was resting.
      Re-run after 13:30 IST.

## 1. Package
- [ ] Upload `public/extension.zip`. It's gitignored and built locally from
      `main` at `fc4e2e4`, with `API_BASE` unset.
  - Version: 0.3.0
  - API base: `https://context-reader.vercel.app`
  - SHA-256: `a91f132027a4afeb51e8ab8dddea016be4a2172c5439aa2d9f13ab6f565d063b`
  - Contents (10 files, 95,291 bytes uncompressed): `background.js`,
    `content.js`, `quotes.js`, `popup.html`, `popup.js`, `manifest.json`,
    `icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`
  - If anything changes on `main` before upload, rebuild with
    `node scripts/package-extension.js` and check the version and API base
    again.

## 2. Title and short description
These come from `manifest.json` inside the zip, so nothing to type:
- Title: `ContextReader: Explain Hard Sentences & Editorials`
- Short description (128 of 132 characters): `Select a hard sentence on any
  page and see what the writer actually means, in plain English, with the
  words it relies on quoted.`

## 3. Detailed description
- [ ] Paste from `store-assets/description.txt`, which has the updated
      Go deeper paragraph.

## 4. Screenshots, 1280x800: replace all five, in this order
- [ ] `store-assets/screenshots/0.3.0/screenshot-1-select-1280x800.png`: Select any sentence. Click Explain.
- [ ] `store-assets/screenshots/0.3.0/screenshot-2-meaning-1280x800.png`: Get what the writer actually means.
- [ ] `store-assets/screenshots/0.3.0/screenshot-3-poem-1280x800.png`: Poems, line by line.
- [ ] `store-assets/screenshots/0.3.0/screenshot-4-jargon-1280x800.png`: Jargon in plain words.
- [ ] `store-assets/screenshots/0.3.0/screenshot-5-legal-1280x800.png`: Legal text in plain English.

How they were made: the real 0.3.0 extension, captured only after the
answer was on the card. Its server returned the saved real answers from
`content/demo-outputs.json`, the same ones the film and site use. The legal
card shows only the summary, as on the site. The footer shows the reset time
as "0:00", because the capture browser used a 24-hour clock.

All five share one layout: the same zoom, caption and source label. They
were drawn in a 680-pixel-wide browser window at 1280/680 pixel density, so
each is exactly 1280x800. The window is 340 pixels tall, shorter than the
425-pixel frame. The card sizes itself to the window, up to 70% of it, so it
stays fully in frame below the passage. The frame also shows the page below
the window. Shot 1's paragraph ends at the selection, so the pill sits on clear
space instead of covering the next line.

The pill shows "Ctrl+Shift+E", which is what Chrome reports on Windows and
Linux, most of the audience. It was captured on a Mac, from a capture-only
copy of the extension set to report that shortcut. The extension shows
Chrome's own text for the shortcut, so it reads "Ctrl+Shift+E", not the
film's "Ctrl⇧E".

## 5. Manifest: 0.2.2 to 0.3.0
| Change | New permission or warning? |
| --- | --- |
| `name` and `description` | No |
| `version` 0.2.2 to 0.3.0 | No |
| `quotes.js` added to content scripts | No |
| `all_frames: false` to `true` | No. Same `<all_urls>` host access, so the same "read and change all your data on all websites" warning users already accepted |
| `commands.explain-selection` (Ctrl+Shift+E / Command+Shift+E) | No. Commands need no permission and show no warning |

`permissions` (storage, scripting) and `host_permissions` (`<all_urls>`)
are unchanged, so existing users are not asked to re-approve.

## 6. Privacy tab
- [x] **Data collected:** keep "Website content", and tick **Personal
      communications**. 0.3.0 can explain text the reader selects inside a
      text box or an embedded frame, such as an email or a chat they're
      reading or writing. It's sent only when they select it and click
      Explain, as `/privacy` now says.
- [ ] **Single purpose and permission justifications:** no change.
- [ ] **Certifications:** unchanged. Not sold, not used for unrelated
      purposes, not used for creditworthiness.
- [ ] **Privacy policy URL:** unchanged, `https://context-reader.vercel.app/privacy`
      (updated 5 November 2026).
- Note: the new `X-Request-Id` header is a random id per request, not user
  data.

## 7. After upload
- [ ] Re-run `node scripts/verify-live.mjs` once Go deeper is back, to see
      check (c) pass.
