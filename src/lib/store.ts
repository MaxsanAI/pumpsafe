import type { AuditResult, Env } from './types';

type StoredMetadata = {
  mint: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  metadataSource: string;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  verified: number | null;
  organicScore: number | null;
  holderCount: number | null;
  updatedAt: number;
};

let metadataTableReady: Promise<void> | null = null;

async function ensureMetadataTable(env: Env): Promise<void> {
  if (!metadataTableReady) {
    metadataTableReady = env.DB.prepare(`CREATE TABLE IF NOT EXISTS token_metadata (
      mint TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Unknown token',
      symbol TEXT NOT NULL DEFAULT 'TOKEN',
      image_url TEXT,
      metadata_source TEXT NOT NULL DEFAULT 'fallback',
      website TEXT,
      twitter TEXT,
      telegram TEXT,
      verified INTEGER,
      organic_score REAL,
      holder_count INTEGER,
      updated_at INTEGER NOT NULL
    )`).run().then(() => undefined).catch(error => {
      metadataTableReady = null;
      throw error;
    });
  }
  await metadataTableReady;
}

export async function saveAudit(env: Env, audit: AuditResult) {
  await ensureMetadataTable(env);

  await env.DB.prepare(`INSERT INTO tokens (mint,name,symbol,score,source,detected_at,mint_authority_disabled,freeze_authority_disabled,top10_pct,lp_verified,bundle_risk,dev_risk,liquidity_usd,reason,recommendation) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(mint) DO UPDATE SET name=excluded.name,symbol=excluded.symbol,score=excluded.score,source=excluded.source,detected_at=excluded.detected_at,mint_authority_disabled=excluded.mint_authority_disabled,freeze_authority_disabled=excluded.freeze_authority_disabled,top10_pct=excluded.top10_pct,lp_verified=excluded.lp_verified,bundle_risk=excluded.bundle_risk,dev_risk=excluded.dev_risk,liquidity_usd=excluded.liquidity_usd,reason=excluded.reason,recommendation=excluded.recommendation`).bind(
    audit.mint,audit.name,audit.symbol,audit.score,audit.source,audit.detectedAt,
    audit.mintAuthorityDisabled?1:0,audit.freezeAuthorityDisabled?1:0,audit.top10Pct,audit.lpVerified?1:0,
    audit.bundleRisk,audit.devRisk,audit.liquidityUsd,audit.reason,audit.recommendation?1:0,
  ).run();

  await env.DB.prepare(`INSERT INTO token_metadata (mint,name,symbol,image_url,metadata_source,website,twitter,telegram,verified,organic_score,holder_count,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(mint) DO UPDATE SET
      name=excluded.name,symbol=excluded.symbol,image_url=excluded.image_url,metadata_source=excluded.metadata_source,
      website=excluded.website,twitter=excluded.twitter,telegram=excluded.telegram,verified=excluded.verified,
      organic_score=excluded.organic_score,holder_count=excluded.holder_count,updated_at=excluded.updated_at`).bind(
    audit.mint,
    audit.name,
    audit.symbol,
    audit.imageUrl ?? null,
    audit.metadataSource ?? 'fallback',
    audit.website ?? null,
    audit.twitter ?? null,
    audit.telegram ?? null,
    typeof audit.verified === 'boolean' ? (audit.verified ? 1 : 0) : null,
    audit.organicScore ?? null,
    audit.holderCount ?? null,
    Date.now(),
  ).run();
}

export async function recentAudits(env: Env, limit = 30): Promise<AuditResult[]> {
  await ensureMetadataTable(env);
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const { results } = await env.DB.prepare(`SELECT
    t.mint,t.name,t.symbol,t.score,t.source,t.detected_at as detectedAt,
    t.mint_authority_disabled as mintAuthorityDisabled,t.freeze_authority_disabled as freezeAuthorityDisabled,
    t.top10_pct as top10Pct,t.lp_verified as lpVerified,t.bundle_risk as bundleRisk,t.dev_risk as devRisk,
    t.liquidity_usd as liquidityUsd,t.reason,t.recommendation,
    m.image_url as imageUrl,m.metadata_source as metadataSource,m.website,m.twitter,m.telegram,
    m.verified,m.organic_score as organicScore,m.holder_count as holderCount
    FROM tokens t LEFT JOIN token_metadata m ON m.mint=t.mint
    ORDER BY t.detected_at DESC LIMIT ?`).bind(safeLimit).all<AuditResult & StoredMetadata>();

  return results.map(r => ({
    ...r,
    mintAuthorityDisabled: Boolean(r.mintAuthorityDisabled),
    freezeAuthorityDisabled: Boolean(r.freezeAuthorityDisabled),
    lpVerified: Boolean(r.lpVerified),
    recommendation: Boolean(r.recommendation),
    verified: r.verified == null ? null : Boolean(r.verified),
    organicScore: r.organicScore == null ? null : Number(r.organicScore),
    holderCount: r.holderCount == null ? null : Number(r.holderCount),
  }));
}

export async function scanStats(env: Env) {
  const row = await env.DB.prepare(`SELECT COUNT(*) as scanned, SUM(CASE WHEN recommendation=1 THEN 1 ELSE 0 END) as safe, SUM(CASE WHEN recommendation=0 THEN 1 ELSE 0 END) as blocked FROM tokens`).first<{ scanned:number; safe:number; blocked:number }>();
  return {
    scanned: Number(row?.scanned ?? 0),
    safe: Number(row?.safe ?? 0),
    blocked: Number(row?.blocked ?? 0),
  };
}
