import { normalizeEvents } from '../../../src/services/websocketListener';
import { processCandidate } from '../../../src/services/processEvent';
import type { Env } from '../../../src/lib/types';

const MAX_CONCURRENCY = 3;

async function processWithLimit(env: Env, candidates: Awaited<ReturnType<typeof normalizeEvents>>) {
  let next = 0;

  async function worker() {
    while (next < candidates.length) {
      const index = next++;
      await processCandidate(env, candidates[index]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENCY, candidates.length) },
      () => worker(),
    ),
  );
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const auth = request.headers.get('authorization');
  if (!env.HELIUS_WEBHOOK_SECRET || auth !== env.HELIUS_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json().catch(() => null) as unknown;
  if (!Array.isArray(body)) {
    return Response.json({ error: 'expected event array' }, { status: 400 });
  }

  const candidates = normalizeEvents(body);

  // Never fan out a whole Helius batch into dozens of simultaneous RPC,
  // DexScreener and RugCheck calls. Keep the webhook responsive while the
  // background audit workers process a small number at a time.
  waitUntil(processWithLimit(env, candidates));

  return Response.json({
    received: body.length,
    candidates: candidates.length,
    concurrency: MAX_CONCURRENCY,
  });
};
