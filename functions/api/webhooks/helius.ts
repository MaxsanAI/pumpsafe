import { normalizeEvents } from '../../../src/services/websocketListener';
import { processCandidate } from '../../../src/services/processEvent';
import type { Env } from '../../../src/lib/types';

const MAX_CONCURRENCY = 2;
const DEBUG_KEY = 'debug:helius:last';

async function processWithLimit(env: Env, candidates: Awaited<ReturnType<typeof normalizeEvents>>) {
  let next = 0;

  async function worker() {
    while (next < candidates.length) {
      const index = next++;
      try {
        await processCandidate(env, candidates[index]);
      } catch (error) {
        console.error('helius candidate worker failed', error);
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENCY, candidates.length) },
      () => worker(),
    ),
  );
}

function summarize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 3).map(summarize);
  }

  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && value.length > 180) {
      return value.slice(0, 180) + '…';
    }
    return value;
  }

  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(input)) {
    const lower = key.toLowerCase();

    // Never retain credentials or authorization material in diagnostics.
    if (
      lower.includes('authorization') ||
      lower.includes('secret') ||
      lower.includes('token') && lower.includes('auth')
    ) {
      output[key] = '[redacted]';
      continue;
    }

    output[key] = summarize(child);
  }

  return output;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const auth = request.headers.get('authorization')?.trim();
  const expected = env.HELIUS_WEBHOOK_SECRET?.trim();

  if (!expected || auth !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json().catch(() => null) as unknown;

  if (!Array.isArray(body)) {
    return Response.json({ error: 'expected event array' }, { status: 400 });
  }

  let candidates: Awaited<ReturnType<typeof normalizeEvents>> = [];
  try {
    candidates = normalizeEvents(body);
  } catch (error) {
    console.error('helius event normalization failed', error);
  }

  const debugPayload = {
    receivedAt: new Date().toISOString(),
    received: body.length,
    candidates: candidates.length,
    firstEvent: summarize(body[0] ?? null),
  };

  // Keep only the latest compact diagnostic payload for troubleshooting.
  // It expires automatically and contains no auth secret.
  waitUntil(
    env.CACHE.put(DEBUG_KEY, JSON.stringify(debugPayload), {
      expirationTtl: 1800,
    }),
  );

  if (candidates.length > 0) {
    waitUntil(processWithLimit(env, candidates));
  }

  return Response.json({
    received: body.length,
    candidates: candidates.length,
    concurrency: MAX_CONCURRENCY,
  });
};
