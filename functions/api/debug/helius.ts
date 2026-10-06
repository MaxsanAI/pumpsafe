import type { Env } from '../../../src/lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const raw = await env.CACHE.get('debug:helius:last');

  if (!raw) {
    return Response.json({
      ok: false,
      message: 'No Helius webhook payload captured yet. Wait for a new webhook delivery.',
    }, { status: 404, headers: { 'cache-control': 'no-store' } });
  }

  try {
    return Response.json({
      ok: true,
      debug: JSON.parse(raw),
    }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({
      ok: false,
      message: 'Stored diagnostic payload is invalid.',
    }, { status: 500, headers: { 'cache-control': 'no-store' } });
  }
};
