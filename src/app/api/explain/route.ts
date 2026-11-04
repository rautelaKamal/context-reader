import { NextResponse } from 'next/server';
import { explain, explainStream } from '@/lib/ai';
import { corsHeaders } from '@/lib/cors';
import { parseContext, ValidationError } from '@/lib/context';
import { applicableModes, detectMode, isModeId, MODES } from '@/lib/modes';
import { hasProviderCredentials, ProviderError } from '@/lib/provider';
import type { ExplainResult } from '@/lib/ai';
import type { ParseOutcome } from '@/lib/prompts';
import type { StreamEvent } from '@/lib/stream';
import {
  clientIp, closeDeepForToday, COST, countParse, deepCapFromEnv, limitsFromEnv, quotaHeaders, refund,
  refusalMessage, releaseDeep, reserveDeep, spend, upstashPipeline,
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

  const pipeline = upstashPipeline();
  const limits = limitsFromEnv();
  const deepCap = deepCapFromEnv();

  // The deep model's daily quota is shared by everyone and small, so a deep
  // read checks for a slot first, before the reader is charged anything.
  if (depth === 'deep') {
    const slot = await reserveDeep(pipeline, deepCap, limits.dayOffsetMinutes);
    if (!slot.ok) return restingResponse('deep_resting', slot.resetAt, headers);
  }

  const charge = {
    installId: request.headers.get('x-install-id'),
    ip: clientIp(request),
    cost: COST[depth],
    limits,
    requestId: requestIdFrom(request),
  };
  const quota = await spend(pipeline, charge);

  if (!quota.ok) {
    if (depth === 'deep') await releaseDeep(pipeline, limits.dayOffsetMinutes);
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

  /**
   * The provider refused (429): the reader got nothing, so they pay nothing.
   * A deep model out of daily quota closes deep reads for the rest of the day.
   */
  const refusedByProvider = async (error: ProviderError): Promise<Refusal> => {
    await refund(pipeline, { ...charge, cost: quota.charged ?? 0 });
    if (depth === 'deep') {
      if (error.daily) await closeDeepForToday(pipeline, deepCap, limits.dayOffsetMinutes);
      return { code: 'deep_resting', message: RESTING.deep_resting, refunded: true };
    }
    return error.daily
      ? { code: 'service_resting', message: RESTING.service_resting, refunded: true }
      : { code: 'busy', message: 'The model is busy right now. Try again in a minute. This one was not counted.', refunded: true };
  };

  try {
    const context = parseContext(body);
    const requested = (body as Record<string, unknown>).mode;
    const mode = isModeId(requested)
      ? requested
      : detectMode({ selection: context.selection, url: context.url });

    const modes = applicableModes({ selection: context.selection, url: context.url })
      .map((id) => MODES[id]);
    const quotaInfo = { remaining: quota.remaining, resetAt: quota.resetAt };

    // 0.3.0 asks for a stream; older extensions and the eval get one JSON reply.
    if ((body as Record<string, unknown>).stream === true) {
      return streamResponse(
        (emit, onParse) => explainStream(context, mode, depth, emit, onParse),
        { mode, depth, modes, quota: quotaInfo },
        limits.dayOffsetMinutes,
        refusedByProvider,
        { ...headers, ...quotaHeaders(quota) },
      );
    }

    let parse: Promise<void> = Promise.resolve();
    const result = await explain(context, mode, depth, (outcome) => {
      if (outcome !== 'clean') console.warn(`parse outcome: ${outcome}`);
      parse = countParse(pipeline, outcome, limits.dayOffsetMinutes);
    });
    await parse;

    // The extension renders its lens menu from `modes` rather than a hardcoded
    // list, so a lens that makes no sense for the passage is not offered.
    return NextResponse.json({ ...result, modes, quota: quotaInfo }, {
      headers: { ...headers, ...quotaHeaders(quota) },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers });
    }
    if (error instanceof ProviderError) {
      if (error.status === 429) {
        const refusal = await refusedByProvider(error);
        return NextResponse.json({ error: refusal.message, code: refusal.code, refunded: true }, { status: 503, headers });
      }
      return NextResponse.json({ error: 'Could not get an explanation. Try again.' }, { status: 502, headers });
    }

    console.error('explain failed:', error);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500, headers });
  }
}

/** A client-chosen id for this request, so a retry of it isn't charged twice. */
function requestIdFrom(request: Request): string | null {
  const id = request.headers.get('x-request-id');
  return id && /^[A-Za-z0-9-]{8,64}$/.test(id) ? id : null;
}

/**
 * The answer as newline-delimited JSON events, written as the model writes:
 *
 *   {"type":"start", mode, depth, modes, quota}   lens and allowance, at once
 *   {"type":"summary", text}                      summary text, in pieces
 *   {"type":"section", label}                     a new section begins
 *   {"type":"delta", text}                        that section's body, in pieces
 *   {"type":"done", result}                       the whole answer, parsed properly
 *   {"type":"error", message, partial}            what went wrong, and whether text had arrived
 *   {"type":"wait"}                               every 10s while nothing else is sent
 *
 * The wait events exist for the extension's service worker. Chrome stops one
 * after 30 seconds without extension activity, and a reasoning model can think
 * that long before its first word. The worker forwards each wait over its
 * port, and that message resets Chrome's idle timer.
 *
 * The quota was charged before this starts, once. The stream can't bypass it.
 */
function streamResponse(
  run: (emit: (e: StreamEvent) => void, onParse: (o: ParseOutcome) => void) => Promise<ExplainResult>,
  start: Record<string, unknown>,
  dayOffsetMinutes: number,
  onRefusal: (error: ProviderError) => Promise<Refusal>,
  headers: Record<string, string>,
) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      send({ type: 'start', ...start });
      let last = Date.now();
      const heartbeat = setInterval(() => { if (Date.now() - last >= 9_000) { last = Date.now(); send({ type: 'wait' }); } }, 10_000);
      const emit = (event: Record<string, unknown>) => { last = Date.now(); send(event); };
      let counted: Promise<void> = Promise.resolve();
      try {
        const result = await run(emit, (outcome) => {
          if (outcome !== 'clean') console.warn(`parse outcome: ${outcome}`);
          counted = countParse(upstashPipeline(), outcome, dayOffsetMinutes);
        });
        send({ type: 'done', result: { ...result, modes: start.modes, quota: start.quota } });
      } catch (error) {
        const partial = error instanceof ProviderError && error.partial;
        if (!(error instanceof ProviderError)) console.error('explain stream failed:', error);
        if (error instanceof ProviderError && error.status === 429 && !partial) {
          send({ type: 'error', partial: false, ...(await onRefusal(error)) });
        } else {
          send({
            type: 'error',
            partial,
            message: partial ? 'Answer cut off. Try again.' : 'Could not get an explanation. Try again.',
          });
        }
      }
      clearInterval(heartbeat);
      await counted;
      controller.close();
    },
  });
  return new Response(body, {
    headers: {
      ...headers,
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      // No proxy buffering, so each event reaches the reader as it is written.
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

type Refusal = { code: 'deep_resting' | 'service_resting' | 'busy'; message: string; refunded: true };

const RESTING = {
  deep_resting: 'Go deeper is resting until tomorrow. It runs on a small shared daily quota, and today\'s is used up. Your allowance was not charged.',
  service_resting: 'ContextReader has used its share of the model for today, across everyone. It\'s back tomorrow. This one was not counted.',
};

/** Refused before anything was charged, with when it comes back. */
function restingResponse(code: 'deep_resting', resetAt: number, headers: Record<string, string>) {
  return NextResponse.json(
    { error: RESTING[code], code, refunded: true, resetAt },
    { status: 503, headers: { ...headers, 'Retry-After': String(Math.max(1, resetAt - Math.floor(Date.now() / 1000))) } },
  );
}
