#!/usr/bin/env python3
"""
Renders the install link as a QR code printed on the page of an open book.

Modules are drawn as rounded squares and the three finders are restyled, but
only mildly: heavy stylisation is what makes decorative QR codes fail to scan.
Error correction is H (30%), and the quiet zone is the full four modules.

    python3 scripts/make-qr.py
"""
import os, subprocess
import qrcode

URL = "https://context-reader.vercel.app/get"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT = os.path.join(os.path.dirname(__file__), "..", "store-assets")

q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=1, border=0)
q.add_data(URL)
q.make(fit=True)
m = q.get_matrix()
n = len(m)

CELL, QUIET = 11, 4
side = (n + QUIET * 2) * CELL


def is_finder(r, c):
    return (r < 7 and c < 7) or (r < 7 and c >= n - 7) or (r >= n - 7 and c < 7)


mods = []
for r in range(n):
    for c in range(n):
        if not m[r][c] or is_finder(r, c):
            continue
        x, y = (c + QUIET) * CELL, (r + QUIET) * CELL
        mods.append(f'<rect x="{x}" y="{y}" width="{CELL}" height="{CELL}" rx="3.2"/>')

finders = []
for r0, c0 in ((0, 0), (0, n - 7), (n - 7, 0)):
    x, y = (c0 + QUIET) * CELL, (r0 + QUIET) * CELL
    s = 7 * CELL
    finders.append(
        f'<rect x="{x}" y="{y}" width="{s}" height="{s}" rx="{CELL*2.1:.1f}" '
        f'fill="none" stroke="#151a2d" stroke-width="{CELL}"/>'
        f'<rect x="{x+CELL*2}" y="{y+CELL*2}" width="{CELL*3}" height="{CELL*3}" '
        f'rx="{CELL*.9:.1f}" fill="#151a2d"/>'
    )

# No width/height: the container sizes it. With them the SVG renders at its
# intrinsic module size and overflows the page.
qr_svg = (f'<svg viewBox="0 0 {side} {side}" width="100%" height="100%">'
          f'<g fill="#151a2d">{"".join(mods)}</g>{"".join(finders)}</svg>')

html = f"""<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,600&family=IBM+Plex+Sans:wght@400;500&display=swap">
<style>
  *{{margin:0;padding:0;box-sizing:border-box}}
  body{{width:1000px;height:1000px;background:#e7e5df;font-family:'IBM Plex Sans',system-ui;
       display:flex;align-items:center;justify-content:center}}
  .book{{position:relative;width:840px;height:600px;display:flex;
        filter:drop-shadow(0 26px 44px rgba(21,26,45,.28))}}
  .page{{width:50%;height:100%;background:#fdfcf7;position:relative;overflow:hidden}}
  .page.l{{border-radius:12px 3px 3px 12px;
          background:linear-gradient(90deg,#f1efe7 0%,#fdfcf7 14%)}}
  .page.r{{border-radius:3px 12px 12px 3px;
          background:linear-gradient(270deg,#f1efe7 0%,#fdfcf7 14%)}}
  .spine{{position:absolute;left:50%;top:0;width:3px;height:100%;transform:translateX(-50%);
         background:linear-gradient(180deg,rgba(21,26,45,.16),rgba(21,26,45,.30),rgba(21,26,45,.16))}}
  .l .inner{{padding:64px 52px 0 62px}}
  .kicker{{font-size:19px;color:#6b7280;letter-spacing:.02em}}
  h1{{font-family:Literata,serif;font-size:46px;font-weight:600;line-height:1.14;
     letter-spacing:-.02em;margin:14px 0 20px}}
  h1 mark{{background:#cfcbf2;color:inherit;padding:1px 4px;border-radius:3px}}
  .body{{font-family:Literata,serif;font-size:21px;line-height:1.6;color:#3f4657;max-width:26ch}}
  .r .inner{{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px}}
  .qr{{width:290px;height:290px;display:block}}
  .scan{{font-size:20px;color:#3f4657}}
  .url{{font-size:17px;color:#6b7280}}
</style>
<div class="book">
  <div class="page l"><div class="inner">
    <div class="kicker">A Chrome extension</div>
    <h1>Some sentences stop you even though you know <mark>every word</mark>.</h1>
    <p class="body">Select the passage. It tells you what the writer actually means, read with the paragraph around it.</p>
  </div></div>
  <div class="page r"><div class="inner">
    <div class="qr">{qr_svg}</div>
    <div class="scan">Scan to install</div>
    <div class="url">context-reader.vercel.app</div>
  </div></div>
  <div class="spine"></div>
</div>
"""

os.makedirs(OUT, exist_ok=True)
src = os.path.join(OUT, "qr-book.html")
open(src, "w").write(html)
subprocess.run([CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
                "--force-device-scale-factor=2", "--window-size=1000,1000",
                f"--screenshot={os.path.join(OUT, 'qr-book.png')}",
                f"file://{os.path.abspath(src)}"], capture_output=True)
print(f"  {n}x{n} modules, error correction H, encoding {URL}")
print("  -> store-assets/qr-book.png")
