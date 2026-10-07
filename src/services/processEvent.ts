import { auditToken } from './antiRugService';
import { postTelegram } from '../lib/telegram';
import { saveAudit } from '../lib/store';
import { resolveTokenMetadata } from './tokenMetadataService';
import type { Env, TokenCandidate } from '../lib/types';

async function claimEvent(env: Env, signature?: string): Promise<boolean> {
  if (!signature) return true;
  const result = await env.DB.prepare('INSERT OR IGNORE INTO processed_events (signature, processed_at) VALUES (?, ?)').bind(signature, Date.now()).run();
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

export async function processCandidate(env: Env, candidate: TokenCandidate, deepScan = false): Promise<{ processed: boolean; audit?: Awaited<ReturnType<typeof auditToken>> }> {
  const claimed = await claimEvent(env, candidate.signature);
  if (!claimed) return { processed: false };

  try {
    const existing = await env.DB.prepare('SELECT mint FROM tokens WHERE mint = ? LIMIT 1').bind(candidate.mint).first<{ mint: string }>();
    if (existing) return { processed: false };

    const metadata = await resolveTokenMetadata(env, candidate.mint);
    const audit = await auditToken(env, { ...candidate, name: metadata.name, symbol: metadata.symbol }, deepScan);

    audit.imageUrl = metadata.imageUrl;
    audit.metadataSource = metadata.metadataSource;
    audit.website = metadata.website;
    audit.twitter = metadata.twitter;
    audit.telegram = metadata.telegram;
    audit.verified = metadata.verified;
    audit.organicScore = metadata.organicScore;
    audit.holderCount = metadata.holderCount;

    await saveAudit(env, audit);
    await postTelegram(env, audit);
    return { processed: true, audit };
  } catch (error) {
    await releaseEvent(env, candidate.signature);
    throw error;
  }
}
