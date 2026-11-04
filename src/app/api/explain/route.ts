import { NextResponse } from 'next/server';
import { explain } from '@/lib/ai';
import { corsHeaders } from '@/lib/cors';
import { parseContext, ValidationError } from '@/lib/context';
import { applicableModes, detectMode, isModeId, MODES } from '@/lib/modes';
import { hasProviderCredentials, ProviderError } from '@/lib/provider';
import {
  clientIp, COST, countParse, limitsFromEnv, quotaHeaders, refusalMessage, spend, upstashPipeline,
} from '@/lib/quota';

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400, headers });
  }

  // The body is read first because a deep read costs more than a fast one, so
  // the price is not known until the request is understood. A malformed body
  // is rejected above without spending anything.
  const depth = (body as Record<string, unknown>).depth === 'deep' ? 'deep' : 'fast';

  const quota = await spend(upstashPipeline(), {
    installId: request.headers.get('x-install-id'),
    ip: clientIp(request),
    cost: COST[depth],
    limits: limitsFromEnv(),
  });

  if (!quota.ok) {
    return NextResponse.json(
      { error: refusalMessage(quota), quota: { remaining: 0, resetAt: quota.resetAt } },
      {
        status: 429,
        headers: {
          ...headers,
          ...quotaHeaders(quota),
          'Retry-After': String(Math.max(1, quota.resetAt - Math.floor(Date.now() / 1000))),
        },
      },
    );
  }

  try {
    const context = parseContext(body);
    const requested = (body as Record<string, unknown>).mode;
    const mode = isModeId(requested)
      ? requested
      : detectMode({ selection: context.selection, url: context.url });

    const limits = limitsFromEnv();
    let parse: Promise<void> = Promise.resolve();
    const result = await explain(context, mode, depth, (outcome) => {
      if (outcome !== 'clean') console.warn(`parse outcome: ${outcome}`);
      parse = countParse(upstashPipeline(), outcome, limits.dayOffsetMinutes);
    });
    await parse;

    // The extension renders its chips from this rather than a hardcoded list,
    // so a lens that makes no sense for the passage simply is not offered.
    const modes = applicableModes({ selection: context.selection, url: context.url })
      .map((id) => MODES[id]);

    return NextResponse.json({ ...result, modes, quota: { remaining: quota.remaining, resetAt: quota.resetAt } }, {
      headers: { ...headers, ...quotaHeaders(quota) },
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
