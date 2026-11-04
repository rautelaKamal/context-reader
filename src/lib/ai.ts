import { getProvider, ProviderError, type Depth } from './provider';
import { buildMessages, EXPLANATION_SCHEMA, parseWithOutcome, type Explanation, type ParseOutcome } from './prompts';
import type { ModeId } from './modes';
import { ExplanationStreamer, type StreamEvent } from './stream';
import type { PassageContext } from './context';

export type { Explanation };

export interface ExplainResult extends Explanation {
  mode: ModeId;
  depth: Depth;
}

export async function explain(
  context: PassageContext,
  mode: ModeId,
  depth: Depth = 'fast',
  /** Told how the reply was read, so the caller can count it. Never given the text. */
  onParse?: (outcome: ParseOutcome) => void,
): Promise<ExplainResult> {
  const provider = getProvider();
  const messages = buildMessages(mode, context);

  const raw = await provider.chat(messages, {
    depth,
    // Line-by-line output has one section per line, so it needs the headroom.
    // 700 was not enough for dense editorial paragraphs: real articles ran past
    // it mid-string, leaving JSON that never closed. A reasoning model spends
    // most of its budget thinking before it writes anything, so the deep pass
    // needs several times the ceiling or it returns a single section.
    maxTokens: (mode === 'lines' ? 1400 : 1100) * (depth === 'deep' ? 4 : 1),
    // Low: this is extraction, not composition. At 0.3 the same passage came
    // back with meaningfully different readings between runs.
    temperature: 0.1,
    schema: EXPLANATION_SCHEMA,
  });

  const { parsed, outcome } = parseWithOutcome(raw);
  onParse?.(outcome);

  if (!parsed) {
    // The model answered but not in JSON. Its prose is still useful, so show
    // it rather than failing the request outright - unless it is broken JSON,
    // which would put braces and "label": keys in front of the reader.
    const fallback = raw.trim();
    if (!fallback) {
      throw new ProviderError('Model returned an empty response', 502);
    }
    if (/^(```(json)?\s*)?\{/i.test(fallback) || /"(summary|sections|label|body)"\s*:/.test(fallback)) {
      throw new ProviderError('The answer came back garbled. Try again.', 502);
    }
    return { mode, depth, summary: fallback, sections: [] };
  }

  return { mode, depth, ...parsed };
}

/**
 * The streaming version of `explain`. `emit` gets the summary, each section's
 * label and its body text as the model writes them. The resolved result is
 * the whole reply parsed properly, and that is what the card keeps: the
 * streamed text is a preview of it, not a second source of truth.
 */
export async function explainStream(
  context: PassageContext,
  mode: ModeId,
  depth: Depth,
  emit: (event: StreamEvent) => void,
  onParse?: (outcome: ParseOutcome) => void,
): Promise<ExplainResult> {
  const provider = getProvider();
  const streamer = new ExplanationStreamer();
  const raw = await provider.chatStream(buildMessages(mode, context), {
    depth,
    maxTokens: (mode === 'lines' ? 1400 : 1100) * (depth === 'deep' ? 4 : 1),
    temperature: 0.1,
    schema: EXPLANATION_SCHEMA,
  }, (text) => { for (const event of streamer.push(text)) emit(event); });

  const { parsed, outcome } = parseWithOutcome(raw);
  onParse?.(outcome);
  if (!parsed) throw new ProviderError('The answer came back garbled. Try again.', 502, true);
  return { mode, depth, ...parsed };
}
