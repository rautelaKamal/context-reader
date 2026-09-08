/**
 * Model provider.
 *
 * Everything the app needs from a model is "given these messages, return
 * text". Keeping that behind one interface means swapping Hugging Face for
 * Anthropic, OpenAI or a local server is a change to this file only.
 */

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
  /** 'fast' answers in about two seconds; 'deep' thinks, and takes far longer. */
  depth?: Depth;
}

export type Depth = 'fast' | 'deep';

export interface Provider {
  name: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
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
function createOpenAICompatibleProvider(): Provider {
  const baseUrl =
    process.env.PROVIDER_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta/openai';
  const apiKey = process.env.HUGGING_FACE_API_KEY ?? process.env.PROVIDER_API_KEY;
  const fastModel = process.env.EXPLAIN_MODEL ?? 'gemini-3.5-flash-lite';
  // Only used when the reader asks for a second, slower pass. Reasoning models
  // are far better at the things a quick answer flattens - irony, wordplay,
  // what a comparison is doing - and far too slow to wait for by default.
  const deepModel = process.env.DEEP_MODEL ?? 'gemini-3.6-flash';

  return {
    name: `openai-compatible:${fastModel}`,
    async chat(messages, options = {}) {
      const model = options.depth === 'deep' ? deepModel : fastModel;
      if (!apiKey) {
        throw new ProviderError('No model API key configured', 500);
      }

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: options.maxTokens ?? 700,
            temperature: options.temperature ?? 0.3,
          }),
        });
      } catch {
        throw new ProviderError('Could not reach the model service', 502);
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new ProviderError(
          `Model service returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
          response.status,
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
