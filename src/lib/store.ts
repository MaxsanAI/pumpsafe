import type { AuditResult, Env } from './types';

export async function saveAudit(env: Env, audit: AuditResult) {
  await env.DB.prepare(`INSERT INTO tokens (mint,name,symbol,score,source,detected_at,mint_authority_disabled,freeze_authority_disabled,top10_pct,lp_verified,bundle_risk,dev_risk,liquidity_usd,reason,recommendation) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(mint) DO UPDATE SET name=excluded.name,symbol=excluded.symbol,score=excluded.score,source=excluded.source,detected_at=excluded.detected_at,mint_authority_disabled=excluded.mint_authority_disabled,freeze_authority_disabled=excluded.freeze_authority_disabled,top10_pct=excluded.top10_pct,lp_verified=excluded.lp_verified,bundle_risk=excluded.bundle_risk,dev_risk=excluded.dev_risk,liquidity_usd=excluded.liquidity_usd,reason=excluded.reason,recommendation=excluded.recommendation`).bind(audit.mint,audit.name,audit.symbol,audit.score,audit.source,audit.detectedAt,audit.mintAuthorityDisabled?1:0,audit.freezeAuthorityDisabled?1:0,audit.top10Pct,audit.lpVerified?1:0,audit.bundleRisk,audit.devRisk,audit.liquidityUsd,audit.reason,audit.recommendation?1:0).run();

  // KV is only a cache. A KV quota/availability failure must never make a
  // successful D1 audit look like a failed scan.
  try {
    await env.CACHE.put(`token:${audit.mint}`, JSON.stringify(audit), { expirationTtl: 3600 });
  } catch (error) {
    console.warn('audit cache write skipped', error);
  }
}

export async function recentAudits(env: Env, limit = 30): Promise<AuditResult[]> {
  const { results } = await env.DB.prepare(`SELECT mint,name,symbol,score,source,detected_at as detectedAt,mint_authority_disabled as mintAuthorityDisabled,freeze_authority_disabled as freezeAuthorityDisabled,top10_pct as top10Pct,lp_verified as lpVerified,bundle_risk as bundleRisk,dev_risk as devRisk,liquidity_usd as liquidityUsd,reason,recommendation FROM tokens WHERE recommendation=1 ORDER BY detected_at DESC LIMIT ?`).bind(Math.min(Math.max(limit,1),100)).all<AuditResult>();
  return results.map(r => ({ ...r, mintAuthorityDisabled: Boolean(r.mintAuthorityDisabled), freezeAuthorityDisabled: Boolean(r.freezeAuthorityDisabled), lpVerified: Boolean(r.lpVerified), recommendation: Boolean(r.recommendation) }));
}

export async function scanStats(env: Env) {
  const row = await env.DB.prepare(`SELECT COUNT(*) as scanned, SUM(CASE WHEN recommendation=1 THEN 1 ELSE 0 END) as safe, SUM(CASE WHEN recommendation=0 THEN 1 ELSE 0 END) as blocked FROM tokens`).first<{ scanned:number; safe:number; blocked:number }>();
  return {
    scanned: Number(row?.scanned ?? 0),
    safe: Number(row?.safe ?? 0),
    blocked: Number(row?.blocked ?? 0),
  };
}
