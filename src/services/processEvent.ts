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
  const key = `seen:${candidate.mint}:${candidate.source}`;
  const lockKey = `processing:${candidate.mint}`;

  // KV is used as a lightweight burst guard. A successful audit is cached for
  // one hour, while an in-flight audit gets a short lease so duplicate Helius
  // deliveries do not fan out into parallel RPC/Dex/RugCheck work.
  if (await env.CACHE.get(key)) return;
  if (await env.CACHE.get(lockKey)) return;
  await env.CACHE.put(lockKey, '1', { expirationTtl: 120 });

  try {
    const enriched = await enrichCandidate(env, candidate);
    const audit = await auditToken(env, enriched);
    await saveAudit(env, audit);

    if (audit.recommendation) {
      await postTelegram(env, audit);
    }

    await env.CACHE.put(key, '1', { expirationTtl: 3600 });
    await env.CACHE.delete(lockKey);
  } catch (error) {
    await env.CACHE.delete(lockKey);
    console.error('audit failed', candidate.mint, candidate.source, error);
  }
}
