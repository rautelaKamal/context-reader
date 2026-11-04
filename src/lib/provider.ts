/**
 * Model provider.
 *
 * Everything the app needs from a model is "given these messages, return
 * text". Keeping that behind one interface means swapping Hugging Face for
 * Anthropic, OpenAI or a local server is a change to this file only.
 */

import { SseTextReader } from './stream';

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
  /** 'fast' answers in about two seconds; 'deep' thinks, and takes far longer. */
  depth?: Depth;
  /**
   * A JSON Schema the reply must follow. Sent as an OpenAI-style
   * response_format, which Gemini's compatible endpoint turns into constrained
   * decoding: the reply is then valid JSON of this shape, not text that
   * usually is.
   */
  schema?: { name: string; schema: Record<string, unknown> };
}

export type Depth = 'fast' | 'deep';

export interface Provider {
  name: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  /**
   * The same request, streamed: `onText` gets the reply as it is written, and
   * the promise resolves with the whole reply. A stall (no text for a while)
   * before anything has arrived is retried once, quietly. A stall after text
   * has arrived rejects with `partial: true`, since a retry would start over.
   */
  chatStream(messages: ChatMessage[], options: ChatOptions, onText: (text: string) => void): Promise<string>;
}

/** No text for this long means the provider has stalled. */
export const STALL_MS = 12_000;
/** A reasoning model writes nothing while it thinks, so its first words get longer. */
export const FIRST_TEXT_MS = { fast: 12_000, deep: 45_000 } as const;

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** Some of the answer had already been streamed when this happened. */
    readonly partial = false,
    /** The provider's daily quota is spent (not a momentary rate limit). */
    readonly daily = false,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/**
 * Hugging Face router, called over plain fetch rather than the SDK so this
 * runs unchanged on the edge runtime.
 *
 * The endpoint is OpenAI-compatible, so pointing PROVIDER_BASE_URL at any
 * other OpenAI-compatible server (including a local one) works with no code
 * change.
 */
export function createOpenAICompatibleProvider(
  // Injectable so the stall handling can be tested in milliseconds.
  { fetchImpl = fetch, stallMs = STALL_MS, firstTextMs = FIRST_TEXT_MS }:
  { fetchImpl?: typeof fetch; stallMs?: number; firstTextMs?: { fast: number; deep: number } } = {},
): Provider {
  const baseUrl =
    process.env.PROVIDER_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta/openai';
  const apiKey = process.env.HUGGING_FACE_API_KEY ?? process.env.PROVIDER_API_KEY;
  const fastModel = process.env.EXPLAIN_MODEL ?? 'gemini-3.5-flash-lite';
  // Only used when the reader asks for a second, slower pass. Reasoning models
  // are far better at the things a quick answer flattens - irony, wordplay,
  // what a comparison is doing - and far too slow to wait for by default.
  const deepModel = process.env.DEEP_MODEL ?? 'gemini-3.6-flash';

  const request = (messages: ChatMessage[], options: ChatOptions, withSchema: boolean, stream: boolean, signal?: AbortSignal) =>
    fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.depth === 'deep' ? deepModel : fastModel,
        messages,
        max_tokens: options.maxTokens ?? 700,
        temperature: options.temperature ?? 0.3,
        ...(stream ? { stream: true } : {}),
        ...(withSchema && options.schema
          ? { response_format: { type: 'json_schema', json_schema: { ...options.schema, strict: true } } }
          : {}),
      }),
    });

  /** One streamed attempt. Resolves with the reply, or rejects; `got` says whether any text arrived. */
  async function streamOnce(messages: ChatMessage[], options: ChatOptions, onText: (t: string) => void, got: { text: boolean }) {
    const controller = new AbortController();
    let stalled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => { stalled = true; controller.abort(); }, ms);
    };
    arm(firstTextMs[options.depth === 'deep' ? 'deep' : 'fast']);
    try {
      let response = await request(messages, options, true, true, controller.signal);
      if (response.status === 400 && options.schema) {
        console.warn('provider rejected response_format for a stream; retrying without a schema');
        response = await request(messages, options, false, true, controller.signal);
      }
      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => '');
        throw new ProviderError(`Model service returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`, response.status, false, isDailyQuota(response.status, detail));
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const sse = new SseTextReader();
      let raw = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = sse.push(decoder.decode(value, { stream: true }));
        if (text) {
          raw += text;
          got.text = true;
          onText(text);
          arm(stallMs);
        }
      }
      if (!raw) throw new ProviderError('Model returned an empty response', 502);
      return raw;
    } catch (error) {
      if (stalled) throw new ProviderError('The model stopped responding', 504, got.text);
      if (error instanceof ProviderError) throw new ProviderError(error.message, error.status, got.text, error.daily);
      throw new ProviderError('Could not reach the model service', 502, got.text);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    name: `openai-compatible:${fastModel}`,
    async chatStream(messages, options, onText) {
      if (!apiKey) throw new ProviderError('No model API key configured', 500);
      const got = { text: false };
      try {
        return await streamOnce(messages, options, onText, got);
      } catch (error) {
        // Nothing reached the reader yet, so starting over is invisible. Once
        // words have been shown, a retry would replace them, so it isn't done.
        const retryable = error instanceof ProviderError && !error.partial
          && (error.status === 504 || error.status === 502 || error.status === 503);
        if (!retryable) throw error;
        console.warn(`stream: ${(error as Error).message}, retrying once`);
        return streamOnce(messages, options, onText, got);
      }
    },
    async chat(messages, options = {}) {
      const model = options.depth === 'deep' ? deepModel : fastModel;
      if (!apiKey) {
        throw new ProviderError('No model API key configured', 500);
      }

      const send = (withSchema: boolean) => request(messages, options, withSchema, false);

      let response: Response;
      try {
        response = await send(true);
        // A model or server that rejects the schema (400) still answers
        // without it; the prompt asks for the same JSON, and the parser
        // copes with the occasional slip.
        if (response.status === 400 && options.schema) {
          console.warn(`provider rejected response_format for ${model}; retrying without a schema`);
          response = await send(false);
        }
      } catch {
        throw new ProviderError('Could not reach the model service', 502);
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new ProviderError(
          `Model service returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
          response.status,
          false,
          isDailyQuota(response.status, detail),
        );
      }

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = payload.choices?.[0]?.message?.content;

      if (!content) {
        throw new ProviderError('Model returned an empty response', 502);
      }
      return content;
    },
  };
}

let cached: Provider | null = null;

export function getProvider(): Provider {
  if (!cached) cached = createOpenAICompatibleProvider();
  return cached;
}

export function hasProviderCredentials(): boolean {
  return Boolean(process.env.HUGGING_FACE_API_KEY ?? process.env.PROVIDER_API_KEY);
}

/** Gemini names its quotas; a per-day one won't come back until tomorrow. */
export function isDailyQuota(status: number, detail: string): boolean {
  return status === 429 && /PerDay/i.test(detail);
}
