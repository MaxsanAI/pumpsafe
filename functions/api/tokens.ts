import { recentAudits } from '../../src/lib/store';
import type { Env } from '../../src/lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const limit = Number(new URL(request.url).searchParams.get('limit') ?? 30);
  return Response.json({ tokens: await recentAudits(env, limit) }, { headers: { 'cache-control': 'no-store' } });
};
