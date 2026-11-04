/**
 * Turns the model's JSON, as it streams in, into events a card can render
 * word by word: the summary text, then each section's label, then its body.
 *
 * The schema fixes the shape ({"summary": "...", "sections": [{"label": "...",
 * "body": "..."}]}), so this doesn't need a general JSON parser. It tracks
 * where it is (in which key, inside which string) and passes string content
 * through as it arrives, decoding escapes, including ones split across chunks.
 * Anything it doesn't recognise is ignored; the full reply is still parsed
 * properly at the end, and that is the version the card keeps.
 */

export type StreamEvent =
  | { type: 'summary'; text: string }
  | { type: 'section'; label: string }
  | { type: 'delta'; text: string };

type Field = 'summary' | 'label' | 'body' | null;

export class ExplanationStreamer {
  private depth = 0;
  private inString = false;
  private escape = '';
  private key = '';
  private expectingKey = false;
  /** The key whose string value is being read, if any. */
  private field: Field = null;
  private lastKey = '';
  private label = '';
  private sectionOpen = false;

  /** Feed the next chunk of raw model text; returns the events it completes. */
  push(chunk: string): StreamEvent[] {
    const out: StreamEvent[] = [];
    let text = '';
    const flush = () => {
      if (!text) return;
      if (this.field === 'summary') out.push({ type: 'summary', text });
      else if (this.field === 'body') out.push({ type: 'delta', text });
      else if (this.field === 'label') this.label += text;
      text = '';
    };

    for (const ch of chunk) {
      if (this.inString) {
        if (this.escape) {
          this.escape += ch;
          const decoded = decodeEscape(this.escape);
          if (decoded === undefined) continue;
          this.escape = '';
          if (this.field) text += decoded; else this.key += decoded;
          continue;
        }
        if (ch === '\\') { this.escape = '\\'; continue; }
        if (ch === '"') {
          this.inString = false;
          if (this.field) {
            flush();
            if (this.field === 'label') {
              out.push({ type: 'section', label: this.label });
              this.sectionOpen = true;
              this.label = '';
            }
            this.field = null;
          } else {
            this.lastKey = this.key;
          }
          continue;
        }
        if (this.field) text += ch; else this.key += ch;
        continue;
      }

      if (ch === '"') {
        this.inString = true;
        if (this.expectingKey) {
          this.key = '';
          this.field = null;
        } else {
          // A string value: is it one we stream?
          const k = this.lastKey;
          this.field = (this.depth === 1 && k === 'summary') ? 'summary'
            : (this.depth === 3 && (k === 'label' || k === 'body')) ? k as Field : null;
          // A body that arrives before its label still gets a section to sit in.
          if (this.field === 'body' && !this.sectionOpen) {
            out.push({ type: 'section', label: '' });
            this.sectionOpen = true;
          }
        }
        continue;
      }
      if (ch === '{') { this.depth += 1; this.expectingKey = true; continue; }
      if (ch === '}') {
        this.depth -= 1;
        if (this.depth === 2) this.sectionOpen = false;
        this.expectingKey = false;
        continue;
      }
      if (ch === '[') { this.depth += 1; this.expectingKey = false; continue; }
      if (ch === ']') { this.depth -= 1; continue; }
      if (ch === ':') { this.expectingKey = false; continue; }
      if (ch === ',') { this.expectingKey = this.isInObject(); continue; }
    }
    flush();
    return out;
  }

  // Depths 1 (the answer) and 3 (a section) are objects; 2 is the sections array.
  private isInObject() {
    return this.depth === 1 || this.depth === 3;
  }
}

/** Decodes one JSON escape, or returns undefined while it's still incomplete. */
function decodeEscape(seq: string): string | undefined {
  if (seq.length < 2) return undefined;
  const c = seq[1];
  if (c === 'u') {
    if (seq.length < 6) return undefined;
    return String.fromCharCode(parseInt(seq.slice(2, 6), 16));
  }
  return ({ n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '"': '"', '\\': '\\', '/': '/' } as Record<string, string>)[c] ?? c;
}

/**
 * Splits an OpenAI-style server-sent event stream into the text deltas it
 * carries. Feed it raw bytes as text; it keeps partial lines between calls.
 */
export class SseTextReader {
  private buffer = '';
  done = false;

  push(chunk: string): string {
    this.buffer += chunk;
    let text = '';
    let nl: number;
    while ((nl = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') { this.done = true; continue; }
      try {
        const parsed = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
        text += parsed.choices?.[0]?.delta?.content ?? '';
      } catch {
        // A malformed event is skipped; the final parse decides what was said.
      }
    }
    return text;
  }
}
