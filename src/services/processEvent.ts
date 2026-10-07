import { auditToken } from './antiRugService';
import { postTelegram } from '../lib/telegram';
import { saveAudit } from '../lib/store';
import type { Env, TokenCandidate } from '../lib/types';

async function claimEvent(env: Env, signature?: string): Promise<boolean> {
  if (!signature) return true;

  const result = await env.DB
    .prepare('INSERT OR IGNORE INTO processed_events (signature, processed_at) VALUES (?, ?)')
    .bind(signature, Date.now())
    .run();

  return result.meta.changes === 1;
}

async function releaseEvent(env: Env, signature?: string): Promise<void> {
  if (!signature) return;
  try {
    await env.DB.prepare('DELETE FROM processed_events WHERE signature = ?').bind(signature).run();
  } catch (error) {
    console.error('failed to release processed event', signature, error);
  }
}

async function tokenMetadata(env: Env, mint: string): Promise<{ name: string; symbol: string }> {
  try {
    const response = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(env.HELIUS_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'safepump-webhook-metadata',
          method: 'getAsset',
          params: { id: mint },
        }),
      },
    );

    if (!response.ok) return { name: 'Unknown token', symbol: 'TOKEN' };

    const body = await response.json() as {
      result?: {
        content?: { metadata?: { name?: string; symbol?: string } };
        token_info?: { symbol?: string };
      };
    };

    return {
      name: body.result?.content?.metadata?.name?.trim() || 'Unknown token',
      symbol:
        body.result?.content?.metadata?.symbol?.trim() ||
        body.result?.token_info?.symbol?.trim() ||
        'TOKEN',
    };
  } catch (error) {
    console.error('token metadata lookup failed', mint, error);
    return { name: 'Unknown token', symbol: 'TOKEN' };
  }
}

export async function processCandidate(env: Env, candidate: TokenCandidate): Promise<void> {
  const claimed = await claimEvent(env, candidate.signature);
  if (!claimed) return;

  try {
    // D1 is the durable source of truth. Automatic webhook audits stay
    // lightweight apart from one Helius metadata lookup.
    const existing = await env.DB
      .prepare('SELECT mint FROM tokens WHERE mint = ? LIMIT 1')
      .bind(candidate.mint)
      .first<{ mint: string }>();

    if (existing) return;

    const metadata =
      candidate.name !== 'Unknown' && candidate.name !== 'Unknown token'
        ? { name: candidate.name, symbol: candidate.symbol }
        : await tokenMetadata(env, candidate.mint);

    const audit = await auditToken(
      env,
      {
        ...candidate,
        name: metadata.name,
        symbol: metadata.symbol,
      },
      false,
    );

    await saveAudit(env, audit);

    if (audit.recommendation) {
      await postTelegram(env, audit);
    }
  } catch (error) {
    await releaseEvent(env, candidate.signature);
    throw error;
  }
}
