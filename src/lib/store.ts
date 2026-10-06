import type { AuditResult, Env } from './types';

export async function saveAudit(env: Env, audit: AuditResult) {
  await env.DB.prepare(`INSERT INTO tokens (mint,name,symbol,score,source,detected_at,mint_authority_disabled,freeze_authority_disabled,top10_pct,lp_verified,bundle_risk,dev_risk,liquidity_usd,reason,recommendation) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(mint) DO UPDATE SET name=excluded.name,symbol=excluded.symbol,score=excluded.score,source=excluded.source,detected_at=excluded.detected_at,mint_authority_disabled=excluded.mint_authority_disabled,freeze_authority_disabled=excluded.freeze_authority_disabled,top10_pct=excluded.top10_pct,lp_verified=excluded.lp_verified,bundle_risk=excluded.bundle_risk,dev_risk=excluded.dev_risk,liquidity_usd=excluded.liquidity_usd,reason=excluded.reason,recommendation=excluded.recommendation`).bind(audit.mint,audit.name,audit.symbol,audit.score,audit.source,audit.detectedAt,audit.mintAuthorityDisabled?1:0,audit.freezeAuthorityDisabled?1:0,audit.top10Pct,audit.lpVerified?1:0,audit.bundleRisk,audit.devRisk,audit.liquidityUsd,audit.reason,audit.recommendation?1:0).run();
  await env.CACHE.put(`token:${audit.mint}`, JSON.stringify(audit), { expirationTtl: 3600 });
}

export async function recentAudits(env: Env, limit = 30): Promise<AuditResult[]> {
  const { results } = await env.DB.prepare(`SELECT mint,name,symbol,score,source,detected_at as detectedAt,mint_authority_disabled as mintAuthorityDisabled,freeze_authority_disabled as freezeAuthorityDisabled,top10_pct as top10Pct,lp_verified as lpVerified,bundle_risk as bundleRisk,dev_risk as devRisk,liquidity_usd as liquidityUsd,reason,recommendation FROM tokens WHERE recommendation=1 ORDER BY detected_at DESC LIMIT ?`).bind(Math.min(Math.max(limit,1),100)).all<AuditResult>();
  return results.map(r => ({ ...r, mintAuthorityDisabled: Boolean(r.mintAuthorityDisabled), freezeAuthorityDisabled: Boolean(r.freezeAuthorityDisabled), lpVerified: Boolean(r.lpVerified), recommendation: Boolean(r.recommendation) }));
}
