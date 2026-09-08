import { getProvider, ProviderError, type Depth } from './provider';
import { buildMessages, parseExplanation, type Explanation } from './prompts';
import type { ModeId } from './modes';
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
  });

  const parsed = parseExplanation(raw);

  if (!parsed) {
    // The model answered but not in JSON. Its prose is still useful, so show
    // it rather than failing the request outright.
    const fallback = raw.trim();
    if (!fallback) {
      throw new ProviderError('Model returned an empty response', 502);
    }
    return { mode, depth, summary: fallback, sections: [] };
  }

  return { mode, depth, ...parsed };
}

export interface TranslationResult {
  translation: string;
  detectedLanguage?: string;
}

/**
 * Translation used to be pinned to a Russian-to-English model, which quietly
 * produced nonsense for every other language. The instruction-tuned model
 * handles detection and translation in one call.
 */
export async function translate(context: PassageContext): Promise<TranslationResult> {
  const provider = getProvider();

  const raw = await provider.chat(
    [
      {
        role: 'system',
        content: `Translate the passage into natural English.

- Preserve line breaks and stanza structure exactly.
- Translate meaning, not words: idiom becomes idiom.
- If the passage is already English, return it unchanged.
- Reply with JSON only: {"detectedLanguage": "<language name>", "translation": "<the English>"}`,
      },
      { role: 'user', content: context.selection },
    ],
    { maxTokens: 900, temperature: 0.2 },
  );

  try {
    const text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(text) as { translation?: unknown; detectedLanguage?: unknown };
    if (typeof parsed.translation === 'string' && parsed.translation.trim()) {
      return {
        translation: parsed.translation.trim(),
        detectedLanguage:
          typeof parsed.detectedLanguage === 'string' ? parsed.detectedLanguage : undefined,
      };
    }
  } catch {
    // fall through to treating the reply as plain text
  }

  return { translation: raw.trim() };
}
