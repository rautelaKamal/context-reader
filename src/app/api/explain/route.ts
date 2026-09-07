import { NextResponse } from 'next/server';
import { explain } from '@/lib/ai';
import { corsHeaders } from '@/lib/cors';
import { parseContext, ValidationError } from '@/lib/context';
import { detectMode, isModeId, MODES } from '@/lib/modes';
import { hasProviderCredentials, ProviderError } from '@/lib/provider';
import { checkRateLimit, clientKey } from '@/lib/ratelimit';

export const runtime = 'edge';

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: Request) {
  // Lets the extension render mode chips without hardcoding the list.
  return NextResponse.json({ modes: Object.values(MODES) }, { headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request);

  if (!hasProviderCredentials()) {
    return NextResponse.json(
      { error: 'The explanation service is not configured.' },
      { status: 503, headers },
    );
  }

  const limit = checkRateLimit(clientKey(request));
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Give it a moment and try again.' },
      {
        status: 429,
        headers: { ...headers, 'Retry-After': String(limit.retryAfterSeconds) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400, headers });
  }

  try {
    const context = parseContext(body);
    const requested = (body as Record<string, unknown>).mode;
    const mode = isModeId(requested)
      ? requested
      : detectMode({ selection: context.selection, url: context.url });

    const result = await explain(context, mode);

    return NextResponse.json(result, {
      headers: { ...headers, 'X-RateLimit-Remaining': String(limit.remaining) },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers });
    }
    if (error instanceof ProviderError) {
      const status = error.status === 429 ? 429 : 502;
      return NextResponse.json(
        {
          error:
            status === 429
              ? 'The model is busy right now. Try again shortly.'
              : 'Could not get an explanation. Try again.',
        },
        { status, headers },
      );
    }

    console.error('explain failed:', error);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500, headers });
  }
}
