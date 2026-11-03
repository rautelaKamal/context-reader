# Icon research for ContextReader

**Decision: kept the existing icon.** Its highlighted middle line already carries
the highlight metaphor, it's more polished than the concepts, and users already
recognise it. No icon files changed and no 0.2.3 was made.

Written 2026-11-03 to test whether a new icon in the film's palette would do
better. Kept as a record of the research.

The preview sheets, concept SVGs and competitor grid live in `design-private/icon-research/`,
which is gitignored because the grid and sheets contain other companies' icons:

- `competitor-grid.png`: 15 comparable extensions, store icons fetched 2026-11-03
- `concepts/`: the three concepts as SVG (16 and 32 hand-drawn on the pixel grid; 48, 128 and 512 from one 96-unit artwork)
- `preview-swipe.png`, `preview-card.png`, `preview-quote.png`: one sheet per concept

## 1. Chrome's official rules

**Store icon (128x128)** from [Supplying Images](https://developer.chrome.com/docs/webstore/images):

- "The actual icon size should be 96x96 (for square icons); an additional 16 pixels per side should be transparent padding."
- PNG only, and it "should work well on both light and dark backgrounds."
- Don't put an edge around the 128x128 image, because the store UI may add one.
- If the icon is mostly dark, consider a subtle white outer glow for dark backgrounds.
- Avoid large drop shadows. Small shadows for contrast are fine. A bottom bevel should be 4 px deep.
- Face the viewer, with no strong built-in perspective.
- Weight: square artwork about 96 px. Squarish shapes take 75 to 80% of the width. A circle is about 112 px across (85 to 90%). Irregular shapes should carry similar visual weight.

**Sizes** from [Configure extension icons](https://developer.chrome.com/docs/extensions/develop/ui/configure-icons):

| Size | Where it shows |
| --- | --- |
| 16 | Favicon on extension pages, context menu |
| 32 | Windows often needs it |
| 48 | Extensions management page |
| 128 | Install dialog and the Chrome Web Store |

**Toolbar and puzzle menu** from [chrome.action](https://developer.chrome.com/docs/extensions/reference/api/action):

- Installed extensions appear in the extensions menu (the puzzle piece), and users can pin them to the toolbar.
- Toolbar icons are 16 device-independent pixels (DIPs). On a 2x screen Chrome draws the 32 px file there, and on 1x the 16 px file. Chrome also encourages extra sizes for 1.5x and 1.2x screens.
- So the 16 and 32 files are the ones people see every day. They are the ones to hand-tune.

**Branding** from [Branding Guidelines](https://developer.chrome.com/docs/webstore/branding):

- Don't use Google trademarks, or a modified version of one, as the extension's logo without written permission. That rules out anything echoing the Chrome ball, the four Google colours or the Google "G".

## 2. Legibility principles

From Apple's [Human Interface Guidelines: App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons):

- "Embrace simplicity." Find one concept that captures the app, "with a minimal number of shapes."
- Fine detail looks busy and is hard to read at small sizes. Avoid very thin lines and sharp corners.
- Include text only when it's essential. A single first letter can help recognition, but words don't belong.
- Don't just copy UI components or screenshots into the icon.

From Material Design's [Product icons](https://m2.material.io/design/iconography/product-icons.html):

- Icons should communicate the product's core idea "in a simple, bold, and friendly way."
- Draw on a grid and edit at 400%, so edges stay sharp and aligned when scaled back to the small size.
- Use keyline shapes (square, circle, rectangle) to keep proportions consistent.

What this means for us:

- Use one metaphor and two or three flat shapes.
- No lines of text inside the icon. At 16 px they turn to mush.
- Draw the small sizes on the pixel grid instead of scaling the big one down.

## 3. Comparable extensions

Icons were taken from each listing's store page (`og:image`) on 2026-11-03:

| Extension | Store id | Metaphor |
| --- | --- | --- |
| Google Dictionary (by Google) | mgijmajocgfcbeboacabfgobmjgjcoja | Book with a letter "A" |
| Grammarly | kbfnbcaeplbcioakkpcpgfkobkghlhen | Letter "G" in a bubble shape |
| Readwise Highlighter | jjhefcfhmnkfeepcpnilbbkaadhngkbi | Letter "R" |
| Glasp | blillmbchncajnhkjfdnincfndboieik | Multicolour diamond |
| QuillBot | iidnbdjijdkbmajdffnidomddglmieko | Robot |
| Definer | noagjioaihamoljcbelhdlldnmlgnkon | Magnifier plus yellow page |
| Monica | ofpnmcalabcbjgholdjcjblkibolbppb | Face, gradient ring |
| Sider | difoiogjjojoaoomphldepapgpbgkhkb | Brain, gradient |
| Explain Like I'm 5 | lmoolagngdndafkonhmlkcljlnififkf | Brain |
| Explain AI | hgdhahipoomjkhbadikhoopfdkllpbgf | Lines of text on a tile |
| Explain This | bjmfpleffomaonephjppfibhplpjahck | Speech bubble with lines, blue tile |
| ExplainTXT | bemjlbapbbadopcopocppgjhggodfmca | Cat mascot |
| Explaina | kkfojaghlgdedbeebfkgihjkjfomngkp | AI sparkles |
| Explain Selected | mgdagfcgfpcglofdkfgaajafcmniddcc | Magnifier |
| Explain Explain | nojpbdnlhfkheephngedfkbnpakaecog | Sparkle plus code brackets |

I found no Chrome extension for Explainpaper. It appears to be web-only.

**Overused metaphors, counted across the 15:**

- Letters: 3 (A, G, R)
- Robots, faces and mascots: 3
- Brains: 2
- Sparkles: 2
- Magnifiers: 2
- Speech bubbles: 2
- Lines of text: 2. Our current icon, with three lines and a yellow middle bar, belongs to this group.
- Rounded-square tiles are the default container, used by about 8 of 15.

**Unused:**

- No listing uses a highlighter stroke as its mark.
- None uses quotation marks.
- None uses the text-selection cursor.
- None points an answer back at a highlighted line.

## 4. The three concepts

All three use ink #14213D, highlighter yellow #FFD84D with the #A67E00 edge, and paper #FAF8F3. None uses red, gradients or text.

1. **Swipe.** A chisel highlighter stroke (yellow with the gold edge, exactly like the film's highlight) ending at a text-selection I-beam cursor.
   - **Research:** nobody uses a highlighter or the selection cursor. Its irregular, tile-free silhouette stands apart from about 8 of 15 tiles.
   - **Risk:** the I-beam can be read as a serif letter "I".
2. **Answer card.** An ink tile with a highlighted line and a paper card pointing up at it. This is the product's actual moment.
   - **Research:** it's the most literal metaphor.
   - **Risk:** it's the closest to the tile-plus-white-bubble family (Explain This). At 16 px it reads a little like a generic app window, which Apple warns against ("don't replicate UI components").
3. **Quote.** Closing quote marks in ink on a yellow disc with a 4 px gold bevel. Answers come back quoting the page.
   - **Research:** no competitor uses quote marks, and the circle silhouette is unused among direct competitors.
   - **Strengths:** best contrast on both toolbars.
   - **Risks:** at 16 px the two marks can read as a smiley's eyes. Quote marks are a common mark for quote and notes apps generally.

## 5. Legibility tests

Each preview sheet shows:

- the 128, 48, 32 and 16 files at true pixels on white and on dark grey (#3C3C3C)
- the 32 and 16 files enlarged to show the hand-drawn pixels
- light and dark toolbars at 2x, plus a true 1x toolbar using the 16 px file
- the puzzle menu in light and dark
- a Chrome Web Store results list next to Google Dictionary, Explain This and Explain AI (layout mock only, with no ratings or counts)
- the film's end card

The toolbar and menu colours approximate Chrome's default light and dark themes. They aren't screenshots.

**Results:**

- **Swipe:** reads at 16 on both themes. The yellow carries it on dark, and a 1 px paper halo keeps the ink cursor visible.
- **Answer card:** reads at 16 on light. On dark the tile edge fades into the toolbar, but the yellow and paper shapes inside still read.
- **Quote:** the strongest at 16 on both themes. It also carries the smiley risk noted above.
