# Credits

## Music

| | |
| --- | --- |
| Track | Minimal Corporate Inspiration |
| Artist | alexrockbeat ([profile](https://pixabay.com/users/alexrockbeat-56087866/)) |
| Track page | https://pixabay.com/music/corporate-minimal-corporate-inspiration-595636/ |
| Licence | [Pixabay Content License](https://pixabay.com/service/license-summary/) |
| Published on Pixabay | 2026-09-04 |
| Downloaded | 2026-11-03 |

**Content ID check (2026-11-03).**

- The track page doesn't show "Content ID Registered", and the search listing shows no shield icon next to the track. Pixabay uses those two signals to mark tracks registered with YouTube Content ID ([Pixabay FAQ](https://pixabay.com/service/faq/)).
- The page doesn't show the "AI generated" label either.
- A contributor can register a track later. Before posting, download the track once while logged in to Pixabay and keep the licence certificate, which can be used to dispute a claim.

**What the licence allows.**

- Free use, including commercial use, with no attribution required.
- Modifying the track.
- What it forbids: distributing the file "on a Standalone basis". That's why the audio file is gitignored, and `npm run music` downloads it fresh.

**Changes we made.**

- Sped up from about 101 BPM to 108 BPM with no pitch change, so the cuts land on beats. The 101 is measured from the audio, and the stretched file re-measures at 108.00.
- Trimmed 0.116 s so the first beat lands on frame 0.
- Loudness normalised to -16 LUFS.
- Faded in and out.
- The drums enter at frame 533, the 16:9 cut into the montage. The vertical cut starts 3 beats into the track, so the drums land on its end card.

## Type

- [Inter](https://fonts.google.com/specimen/Inter) and [Source Serif 4](https://fonts.google.com/specimen/Source+Serif+4), both under the SIL Open Font License, loaded through `@remotion/google-fonts`.

## Passages shown

- **Editorial:** written by us for the film. It isn't a real publication, and `example.org` is a reserved demo domain.
- **Sonnet 73:** William Shakespeare, public domain (Project Gutenberg #1041).
- **On the Origin of Species, chapter IV:** Charles Darwin, public domain (Project Gutenberg #1228).
- **Marbury v. Madison, 5 U.S. 137 (1803):** a US court opinion, public domain. Text checked against Cornell LII.

## Explanations shown

- Every explanation on screen is a real response from the live ContextReader API, saved once in `../content/demo-outputs.json` and rendered from that file, never edited.
- The film shows only the summary of the legal answer. The full answer is logged in `../docs/eval-findings.md`.

## Icon

- The ContextReader store icon, unchanged, shown on a white tile of the same shape.

## Software

- [Remotion](https://www.remotion.dev/) 4. It is free for individuals and companies of up to 3 people ([licence](https://www.remotion.dev/license)). A larger company re-rendering this needs a Company License.
