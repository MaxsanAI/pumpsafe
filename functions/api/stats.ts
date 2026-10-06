import { scanStats } from '../../src/lib/store';
import type { Env } from '../../src/lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const stats = await scanStats(env);
    return Response.json(stats, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('stats failed', error);
    return Response.json({ scanned: 0, safe: 0, blocked: 0 }, { status: 200 });
  }
};
