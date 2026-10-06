import { auditToken } from '../../src/services/antiRugService';
import { saveAudit } from '../../src/lib/store';
import type { Env } from '../../src/lib/types';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => null) as { mint?: unknown } | null;
    const mint = typeof body?.mint === 'string' ? body.mint.trim() : '';

    if (mint.length < 32 || mint.length > 44 || !BASE58.test(mint)) {
      return Response.json({ error: 'Enter a valid Solana token mint address.' }, { status: 400 });
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const rateKey = `manual-scan:${ip}`;
    if (await env.CACHE.get(rateKey)) {
      return Response.json({ error: 'Please wait a few seconds before scanning again.' }, { status: 429 });
    }
    await env.CACHE.put(rateKey, '1', { expirationTtl: 8 });

    const audit = await auditToken(env, {
      mint,
      name: 'Token',
      symbol: 'TOKEN',
      source: 'manual',
      pumpFun: true,
    });

    await saveAudit(env, audit);

    return Response.json({ audit }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('manual scan failed', error);
    return Response.json({ error: 'Token could not be scanned. Check the mint address and try again.' }, { status: 400 });
  }
};
