import { normalizeEvents } from '../../../src/services/websocketListener';
import { processCandidate } from '../../../src/services/processEvent';
import type { Env } from '../../../src/lib/types';

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const auth = request.headers.get('authorization');
  if (!env.HELIUS_WEBHOOK_SECRET || auth !== env.HELIUS_WEBHOOK_SECRET) return new Response('Unauthorized', { status: 401 });
  const body = await request.json().catch(() => null) as unknown;
  if (!Array.isArray(body)) return Response.json({ error: 'expected event array' }, { status: 400 });
  const candidates = normalizeEvents(body);
  waitUntil(Promise.all(candidates.map(c => processCandidate(env, c))));
  return Response.json({ received: body.length, candidates: candidates.length });
};
