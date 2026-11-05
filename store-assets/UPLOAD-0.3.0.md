# Store upload checklist: 0.3.0

## 1. Package (not built yet)
- [ ] After the go-ahead, from `main` (`eb597a8` or later): `node scripts/package-extension.js` with `API_BASE` unset.
- [ ] Upload `public/extension.zip`. Check it says `ContextReader v0.3.0` and the API is `https://context-reader.vercel.app`.

## 2. Title and short description
These come from `src/extension/manifest.json` (`name`, `description`), so changing them means a manifest commit before the zip is built.
- Title (50 chars): `ContextReader: Explain Hard Sentences & Editorials`
- Short description (128 of 132 chars): `Select a hard sentence on any page and see what the writer actually means, in plain English, with the words it relies on quoted.`

## 3. Detailed description
- Paste from `store-assets/description.txt` (updated "Go deeper" paragraph).

## 4. Screenshots, 1280x800 (not ready, see note)
- `store-assets/screenshots/0.3.0/screenshot-1-select-1280x800.png`: Select any sentence. Click Explain.
- `store-assets/screenshots/0.3.0/screenshot-2-meaning-1280x800.png`: Get what the writer actually means.
- `store-assets/screenshots/0.3.0/screenshot-3-poem-1280x800.png`: Poems, line by line.
- `store-assets/screenshots/0.3.0/screenshot-4-jargon-1280x800.png`: Jargon in plain words.
- `store-assets/screenshots/0.3.0/screenshot-5-legal-1280x800.png`: Legal text in plain English.

Note: the first capture of the real 0.3.0 extension shows the pill correctly, but cards 2 to 5 were captured while still loading. They need retaking.

## 5. Manifest: 0.2.2 to 0.3.0
| Change | New permission or warning? |
| --- | --- |
| `version` 0.2.2 to 0.3.0 | No |
| `quotes.js` added to content scripts | No |
| `all_frames: false` to `true` | No. Same `<all_urls>` host access, so the same "read and change all your data on all websites" warning users already accepted |
| `commands.explain-selection` (Ctrl+Shift+E / Command+Shift+E) | No. Commands need no permission and show no warning |

`permissions` (storage, scripting) and `host_permissions` (`<all_urls>`) are unchanged, so existing users won't be asked to re-approve.

## 6. Privacy tab
- **Single purpose, permission justifications:** no change needed.
- **Data collected:** still "Website content", the selected passage and its surrounding text. New in 0.3.0: text selected inside iframes and inside text fields can be explained too.
- **Review:** a reader can select text in an email or a message they are writing and explain it. That was already possible for email text on the page in 0.2.2. Consider whether "Personal communications" should also be ticked to be safe.
- **Policy:** `/privacy` doesn't mention text fields or iframes. Optional wording update.
- **Request id:** the new `X-Request-Id` is a random id per request. It's not user data.

## 7. After upload
- [ ] Once Vercel has deployed `main`: `node scripts/verify-live.mjs`. All checks should pass; (c) may skip if the deep cap is already full.
