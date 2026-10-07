import { auditToken } from '../../src/services/antiRugService';
import { saveAudit } from '../../src/lib/store';
import type { Env } from '../../src/lib/types';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Unknown scan error';
}

async function tokenMetadata(mint: string): Promise<{ name: string; symbol: string }> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`,
      { headers: { accept: 'application/json' } },
    );
    if (!response.ok) return { name: 'Unknown token', symbol: 'TOKEN' };

    const body = await response.json() as {
      pairs?: Array<{ baseToken?: { address?: string; name?: string; symbol?: string } }>;
    };
    const pair = (body.pairs ?? []).find(x => x.baseToken?.address === mint) ?? body.pairs?.[0];
    return {
      name: pair?.baseToken?.name?.trim() || 'Unknown token',
      symbol: pair?.baseToken?.symbol?.trim() || 'TOKEN',
    };
  } catch {
    return { name: 'Unknown token', symbol: 'TOKEN' };
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => null) as { mint?: unknown } | null;
    const mint = typeof body?.mint === 'string' ? body.mint.trim() : '';

    if (mint.length < 32 || mint.length > 44 || !BASE58.test(mint)) {
      return Response.json({ error: 'Enter a valid Solana token mint address.' }, { status: 400 });
    }

    const metadata = await tokenMetadata(mint);
    const audit = await auditToken(env, {
      mint,
      name: metadata.name,
      symbol: metadata.symbol,
      source: 'manual',
      pumpFun: true,
    }, true);

    await saveAudit(env, audit);
    return Response.json({ audit }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('manual scan failed', error);
    return Response.json(
      { error: `Scan failed: ${errorMessage(error)}` },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }
};
