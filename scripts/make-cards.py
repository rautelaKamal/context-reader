#!/usr/bin/env python3
"""
Renders one image per kind of difficult text, using real answers from the live
API rather than copy written for a picture.

Each card is rendered twice: once tall to measure where the content actually
ends, then again at exactly that height. Hand-guessing the height either
clipped the card or left a third of the frame empty.

    python3 scripts/make-cards.py
"""
import html, json, os, re, struct, subprocess, sys, zlib

API = "https://context-reader.vercel.app/api/explain"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT = os.path.join(os.path.dirname(__file__), "..", "store-assets", "cards")

CASES = [
    {
        "slug": "verse", "kind": "Verse", "mode": "lines",
        "source": "Shakespeare, Sonnet 18",
        "selection": "Shall I compare thee to a summer's day?\nThou art more lovely and more temperate:\nRough winds do shake the darling buds of May,",
    },
    {
        "slug": "editorial", "kind": "A newspaper editorial", "mode": "point",
        "source": "Leader column on fiscal devolution",
        "selection": "the Centre would do well to disabuse itself of the notion that federal comity is a favour it bestows",
        "marked": "If the recent acrimony over devolution is any indication, «the Centre would do well to disabuse itself of the notion that federal comity is a favour it bestows» upon the States rather than an obligation the Constitution imposes.",
        "before": "Several southern States have protested the terms of the latest Finance Commission award, arguing that they are penalised for having controlled their populations.",
    },
    {
        "slug": "sarcasm", "kind": "Sarcasm", "mode": "point",
        "source": "A letter to the editor",
        "selection": "One is grateful to the Corporation for finally repairing the road, a mere three monsoons after it dissolved.",
        "marked": "Sir — «One is grateful to the Corporation for finally repairing the road, a mere three monsoons after it dissolved.» Residents await news of the drains with similar optimism.",
    },
    {
        "slug": "paper", "kind": "A research paper", "mode": "jargon",
        "source": "Attention Is All You Need, 2017",
        "selection": "we compute scaled dot-product attention over the key-value pairs, masking future positions",
        "marked": "In each decoder layer «we compute scaled dot-product attention over the key-value pairs, masking future positions» so that predictions depend only on known outputs.",
    },
    {
        "slug": "wordplay", "kind": "Wordplay", "mode": "craft",
        "source": "Shakespeare, Richard III",
        "selection": "Now is the winter of our discontent\nMade glorious summer by this sun of York;",
    },
]

TEMPLATE = """<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    width: 1200px; height: {height}; background: #f3f4f0; color: #151a2d;
    font-family: 'IBM Plex Sans', system-ui, sans-serif;
    padding: 60px 66px; display: flex; flex-direction: column;
  }}
  .top {{ display: flex; align-items: baseline; gap: 14px; margin-bottom: 28px; }}
  .kind {{ font-family: Literata, serif; font-size: 28px; font-weight: 600; }}
  .src {{ font-size: 22px; color: #545a6b; }}
  .stage {{ flex-shrink: 0; background: #fffdf9; border: 1px solid #d7d9d1; border-radius: 12px; padding: 30px 34px; }}
  .quote {{ font-family: Literata, Georgia, serif; font-size: 29px; line-height: 1.5; }}
  .quote mark {{ background: #cfcbf2; color: inherit; padding: 2px 0; }}
  .quote .dim {{ color: #6b7280; }}
  .card {{ flex-shrink: 0; margin-top: 22px; background: #1c1917; color: #f5f5f4; border-radius: 12px; overflow: hidden; }}
  .modes {{ display: flex; gap: 8px; padding: 18px 22px; border-bottom: 1px solid #44403c; }}
  .chip {{ font-size: 18px; padding: 8px 14px; border-radius: 999px; background: #292524; color: #d6d3d1; }}
  .chip.on {{ background: #f5f5f4; color: #1c1917; }}
  .body {{ padding: 24px 26px 26px; }}
  .summary {{ font-size: 23px; line-height: 1.45; margin-bottom: 20px; }}
  .row {{ margin-bottom: 16px; }}
  .row:last-child {{ margin-bottom: 0; }}
  .label {{ font-size: 19px; color: #a8a29e; margin-bottom: 4px; }}
  .label.line {{ font-family: Literata, serif; font-style: italic; }}
  .gloss {{ font-size: 22px; line-height: 1.45; }}
  .foot {{ margin-top: auto; padding-top: 26px; display: flex; justify-content: space-between; font-size: 21px; color: #545a6b; }}
</style>
<div class="top"><span class="kind">{kind}</span><span class="src">{source}</span></div>
<div class="stage"><p class="quote">{quote}</p></div>
<div class="card">
  <div class="modes">{chips}</div>
  <div class="body">{summary}{rows}</div>
</div>
<div class="foot"><span>ContextReader &mdash; explains what a writer means</span><span>context-reader.vercel.app</span></div>
"""

MODES = [("plain", "Plain meaning"), ("point", "What&rsquo;s the point?"),
         ("lines", "Line by line"), ("craft", "How it works"), ("jargon", "The jargon")]


def explain(case):
    payload = {
        "selection": case["selection"],
        "markedParagraph": case.get("marked") or f"«{case['selection']}»",
        "title": case["source"], "mode": case["mode"],
    }
    if case.get("before"):
        payload["precedingParagraph"] = case["before"]
    out = subprocess.run(
        ["/usr/bin/curl", "-s", "-X", "POST", API, "-H", "Content-Type: application/json",
         "--data-binary", json.dumps(payload), "--max-time", "90"],
        capture_output=True, text=True).stdout
    return json.loads(out)


def build_quote(case):
    """Show the surrounding sentences dimmed, so the context idea is visible."""
    marked = case.get("marked")
    if not marked:
        return f'<mark>{html.escape(case["selection"]).replace(chr(10), "<br>")}</mark>'
    before, rest = marked.split("«", 1)
    inner, after = rest.split("»", 1)
    return (f'<span class="dim">{html.escape(before)}</span>'
            f'<mark>{html.escape(inner)}</mark>'
            f'<span class="dim">{html.escape(after)}</span>')


def content_height(path):
    """Last row that differs from the background colour."""
    data = open(path, "rb").read()
    pos, idat, w, h, ct = 8, b"", None, None, None
    while pos < len(data):
        ln = struct.unpack(">I", data[pos:pos + 4])[0]
        tag = data[pos + 4:pos + 8]
        if tag == b"IHDR":
            w, h, _, ct = struct.unpack(">IIBB", data[pos + 8:pos + 18])
        elif tag == b"IDAT":
            idat += data[pos + 8:pos + 8 + ln]
        pos += 12 + ln
    raw = zlib.decompress(idat)
    bpp = 3 if ct == 2 else 4
    stride, prev, last = w * bpp + 1, bytearray(w * bpp), 0
    bg = None
    for y in range(h):
        f = raw[y * stride]
        line = bytearray(raw[y * stride + 1:(y + 1) * stride])
        for i in range(len(line)):
            a = line[i - bpp] if i >= bpp else 0
            b = prev[i]
            c = prev[i - bpp] if i >= bpp else 0
            if f == 1: line[i] = (line[i] + a) & 255
            elif f == 2: line[i] = (line[i] + b) & 255
            elif f == 3: line[i] = (line[i] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        if y == 5:
            bg = bytes(line[0:bpp])
        if bg and any(bytes(line[x:x + bpp]) != bg for x in range(0, w * bpp, bpp * 40)):
            last = y
        prev = line
    return last


def shoot(src, dst, height, scale=2):
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
                    f"--force-device-scale-factor={scale}",
                    f"--window-size=1200,{height}", f"--screenshot={dst}",
                    f"file://{os.path.abspath(src)}"], capture_output=True)


os.makedirs(OUT, exist_ok=True)
for case in CASES:
    data = explain(case)
    if "sections" not in data:
        print(f"  !! {case['slug']}: {data}")
        continue

    chips = "".join(
        f'<span class="chip{" on" if mid == data["mode"] else ""}">{lbl}</span>'
        for mid, lbl in MODES if mid in {m["id"] for m in data.get("modes", [])} or mid == data["mode"])
    summary = f'<p class="summary">{html.escape(data["summary"])}</p>' if data.get("summary") else ""
    rows = "".join(
        f'<div class="row"><p class="label{" line" if data["mode"] == "lines" else ""}">'
        f'{html.escape(s["label"])}</p><p class="gloss">{html.escape(s["body"])}</p></div>'
        for s in data["sections"][:3])

    page = TEMPLATE.format(height="auto", kind=html.escape(case["kind"]),
                           source=html.escape(case["source"]), quote=build_quote(case),
                           chips=chips, summary=summary, rows=rows)
    src = os.path.join(OUT, f"{case['slug']}.html")
    open(src, "w").write(page)

    probe = os.path.join(OUT, "_probe.png")
    shoot(src, probe, 2200, scale=1)
    h = content_height(probe) + 60          # bottom padding
    os.remove(probe)

    open(src, "w").write(page.replace('height: auto;', f'height: {h}px;'))
    shoot(src, os.path.join(OUT, f"{case['slug']}.png"), h)
    print(f"  {case['slug']:10} [{data['mode']:6}] {h}px  {len(data['sections'])} sections")
