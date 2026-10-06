import { auditToken } from './antiRugService';
import { postTelegram } from '../lib/telegram';
import { saveAudit } from '../lib/store';
import type { Env, TokenCandidate } from '../lib/types';

export async function processCandidate(env: Env, candidate: TokenCandidate): Promise<void> {
  // D1 is the durable source of truth. Automatic webhook audits stay
  // lightweight: no Helius getAsset call and no launch-cluster RPC analysis.
  const existing = await env.DB
    .prepare('SELECT mint FROM tokens WHERE mint = ? LIMIT 1')
    .bind(candidate.mint)
    .first<{ mint: string }>();

  if (existing) return;

  try {
    const audit = await auditToken(env, candidate, false);
    await saveAudit(env, audit);

    if (audit.recommendation) {
      await postTelegram(env, audit);
    }
  } catch (error) {
    console.error('audit failed', candidate.mint, candidate.source, error);
  }
}
