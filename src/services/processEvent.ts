import { auditToken } from './antiRugService';
import { postTelegram } from '../lib/telegram';
import { saveAudit } from '../lib/store';
import type { Env, TokenCandidate } from '../lib/types';

async function enrichCandidate(env: Env, candidate: TokenCandidate): Promise<TokenCandidate> {
  if (!env.HELIUS_API_KEY) return candidate;
  try {
    const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(env.HELIUS_API_KEY)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAsset',
        params: { id: candidate.mint, displayOptions: { showFungible: true } },
      }),
    });
    if (!r.ok) return candidate;
    const body = await r.json() as any;
    const content = body?.result?.content?.metadata;
    const tokenInfo = body?.result?.token_info;
    return {
      ...candidate,
      name: content?.name ?? tokenInfo?.symbol ?? candidate.name,
      symbol: content?.symbol ?? tokenInfo?.symbol ?? candidate.symbol,
    };
  } catch {
    return candidate;
  }
}

export async function processCandidate(env: Env, candidate: TokenCandidate): Promise<void> {
  // D1 is the durable source of truth. KV must not be required for ingestion,
  // because KV quotas can be exhausted independently of the scanner.
  const existing = await env.DB
    .prepare('SELECT mint FROM tokens WHERE mint = ? LIMIT 1')
    .bind(candidate.mint)
    .first<{ mint: string }>();

  if (existing) return;

  try {
    const enriched = await enrichCandidate(env, candidate);
    const audit = await auditToken(env, enriched);
    await saveAudit(env, audit);

    if (audit.recommendation) {
      await postTelegram(env, audit);
    }
  } catch (error) {
    console.error('audit failed', candidate.mint, candidate.source, error);
  }
}
