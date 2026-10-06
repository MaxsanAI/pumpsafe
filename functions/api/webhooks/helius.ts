import { normalizeEvents } from '../../../src/services/websocketListener';
import { processCandidate } from '../../../src/services/processEvent';
import type { Env } from '../../../src/lib/types';

const MAX_CONCURRENCY = 2;

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

  if (candidates.length > 0) {
    waitUntil(processWithLimit(env, candidates));
  }

  return Response.json({
    received: body.length,
    candidates: candidates.length,
    concurrency: MAX_CONCURRENCY,
  });
};
