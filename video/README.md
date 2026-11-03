# ContextReader product film

This folder holds the source for a short product film, built with [Remotion](https://www.remotion.dev/). It has its own `package.json` and doesn't touch the app, the API or the extension.

| Composition | Size | Length | Notes |
| --- | --- | --- | --- |
| `Film` | 1920x1080 | 35.5 s | Main film |
| `Vertical` | 1080x1920 | 20.6 s | Text kept out of the top 15% and bottom 20% |
| `FilmHinglish` | 1920x1080 | 35.5 s | Only the on-screen lines change; the explanations stay in English |
| `Loop` | 1280x720 | 6 s | From selection to answer, silent |
| `Shot` | 1280x800 | still | Store screenshot from any film frame |
| `PromoSmall`, `PromoMarquee` | 440x280, 1400x560 | still | Store promo tiles |

## Re-render

```bash
npm install
npm run music     # downloads the Pixabay track and stretches it to 108 BPM (gitignored)
npm run render    # writes out/final/*.mp4 and out/exports/*
npm run stills    # review stills in out/stills/
npm run studio    # preview and scrub in the browser
```

All media in `out/` and `public/music/` is gitignored.

## How it's put together

- **Palette and fonts:** `src/theme.ts`.
- **Copy:** every on-screen line lives in `src/copy.ts`, both English and Hinglish.
- **Timing:** scene cuts are in `src/Root.tsx`. At 108 BPM one beat is 16.67 frames, and every cut sits on a beat.
- **The pill and card:** `src/components/ui.tsx` recreates them from `../src/extension/content.js`. Only the colours change, and the card's max-height scrolling is kept as in the product.
- **Explanations:** every one is read from `../content/demo-outputs.json`, never typed in. `npm run outputs` regenerates that file from the live API and refuses to overwrite it without `--force`. `--recheck` re-verifies the quotes without calling the API.

Sources and licences are listed in [CREDITS.md](CREDITS.md).
