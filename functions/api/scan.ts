import { auditToken } from '../../src/services/antiRugService';
import { saveAudit } from '../../src/lib/store';
import { resolveTokenMetadata } from '../../src/services/tokenMetadataService';
import type { Env } from '../../src/lib/types';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Unknown scan error';
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => null) as { mint?: unknown } | null;
    const mint = typeof body?.mint === 'string' ? body.mint.trim() : '';

    if (mint.length < 32 || mint.length > 44 || !BASE58.test(mint)) {
      return Response.json({ error: 'Enter a valid Solana token mint address.' }, { status: 400 });
    }

    const metadata = await resolveTokenMetadata(env, mint);
    const audit = await auditToken(env, {
      mint,
      name: metadata.name,
      symbol: metadata.symbol,
      source: 'manual',
      pumpFun: true,
    }, true);

    audit.imageUrl = metadata.imageUrl;
    audit.metadataSource = metadata.metadataSource;
    audit.website = metadata.website;
    audit.twitter = metadata.twitter;
    audit.telegram = metadata.telegram;
    audit.verified = metadata.verified;
    audit.organicScore = metadata.organicScore;
    audit.holderCount = metadata.holderCount;

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
