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

export async function processCandidate(env: Env, candidate: TokenCandidate): Promise<void> {
  const claimed = await claimEvent(env, candidate.signature);
  if (!claimed) return;

  try {
    // D1 is the durable source of truth. Automatic webhook audits stay
    // lightweight: no Helius getAsset call and no launch-cluster RPC analysis.
    const existing = await env.DB
      .prepare('SELECT mint FROM tokens WHERE mint = ? LIMIT 1')
      .bind(candidate.mint)
      .first<{ mint: string }>();

    if (existing) return;

    const audit = await auditToken(env, candidate, false);
    await saveAudit(env, audit);

    if (audit.recommendation) {
      await postTelegram(env, audit);
    }
  } catch (error) {
    await releaseEvent(env, candidate.signature);
    throw error;
  }
}
