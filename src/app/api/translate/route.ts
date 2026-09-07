import { NextResponse } from 'next/server';
import { translate } from '@/lib/ai';
import { corsHeaders } from '@/lib/cors';
import { parseContext, ValidationError } from '@/lib/context';
import { hasProviderCredentials, ProviderError } from '@/lib/provider';
import { checkRateLimit, clientKey } from '@/lib/ratelimit';

export const runtime = 'edge';

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request);

  if (!hasProviderCredentials()) {
    return NextResponse.json(
      { error: 'The translation service is not configured.' },
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
    const result = await translate(context);
    return NextResponse.json(result, { headers });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers });
    }
    if (error instanceof ProviderError) {
      return NextResponse.json(
        { error: 'Could not translate that. Try again.' },
        { status: 502, headers },
      );
    }

    console.error('translate failed:', error);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500, headers });
  }
}
