import type { AuditResult, Env } from './types';

async function tokenMetadata(env: Env, mint: string): Promise<{ name: string; symbol: string } | null> {
  try {
    const response = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(env.HELIUS_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'safepump-backfill-metadata',
          method: 'getAsset',
          params: { id: mint },
        }),
      },
    );

    if (!response.ok) return null;

    const body = await response.json() as {
      result?: {
        content?: { metadata?: { name?: string; symbol?: string } };
        token_info?: { symbol?: string };
      };
    };

    const name = body.result?.content?.metadata?.name?.trim() || '';
    const symbol =
      body.result?.content?.metadata?.symbol?.trim() ||
      body.result?.token_info?.symbol?.trim() ||
      '';

    if (!name && !symbol) return null;

    return {
      name: name || 'Unknown token',
      symbol: symbol || 'TOKEN',
    };
  } catch (error) {
    console.error('metadata backfill lookup failed', mint, error);
    return null;
  }
}

export async function saveAudit(env: Env, audit: AuditResult) {
  await env.DB.prepare(`INSERT INTO tokens (mint,name,symbol,score,source,detected_at,mint_authority_disabled,freeze_authority_disabled,top10_pct,lp_verified,bundle_risk,dev_risk,liquidity_usd,reason,recommendation) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(mint) DO UPDATE SET name=excluded.name,symbol=excluded.symbol,score=excluded.score,source=excluded.source,detected_at=excluded.detected_at,mint_authority_disabled=excluded.mint_authority_disabled,freeze_authority_disabled=excluded.freeze_authority_disabled,top10_pct=excluded.top10_pct,lp_verified=excluded.lp_verified,bundle_risk=excluded.bundle_risk,dev_risk=excluded.dev_risk,liquidity_usd=excluded.liquidity_usd,reason=excluded.reason,recommendation=excluded.recommendation`).bind(audit.mint,audit.name,audit.symbol,audit.score,audit.source,audit.detectedAt,audit.mintAuthorityDisabled?1:0,audit.freezeAuthorityDisabled?1:0,audit.top10Pct,audit.lpVerified?1:0,audit.bundleRisk,audit.devRisk,audit.liquidityUsd,audit.reason,audit.recommendation?1:0).run();
}

export async function recentAudits(env: Env, limit = 30): Promise<AuditResult[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const { results } = await env.DB.prepare(`SELECT mint,name,symbol,score,source,detected_at as detectedAt,mint_authority_disabled as mintAuthorityDisabled,freeze_authority_disabled as freezeAuthorityDisabled,top10_pct as top10Pct,lp_verified as lpVerified,bundle_risk as bundleRisk,dev_risk as devRisk,liquidity_usd as liquidityUsd,reason,recommendation FROM tokens ORDER BY detected_at DESC LIMIT ?`).bind(safeLimit).all<AuditResult>();

  const normalized = results.map(r => ({
    ...r,
    mintAuthorityDisabled: Boolean(r.mintAuthorityDisabled),
    freezeAuthorityDisabled: Boolean(r.freezeAuthorityDisabled),
    lpVerified: Boolean(r.lpVerified),
    recommendation: Boolean(r.recommendation),
  }));

  const missingMetadata = normalized.filter(
    token => (token.name === 'Unknown' || token.name === 'Unknown token') && token.symbol === 'TOKEN',
  ).slice(0, 10);

  if (missingMetadata.length > 0) {
    const repaired = await Promise.all(
      missingMetadata.map(async token => ({
        mint: token.mint,
        metadata: await tokenMetadata(env, token.mint),
      })),
    );

    for (const item of repaired) {
      if (!item.metadata) continue;

      await env.DB
        .prepare('UPDATE tokens SET name = ?, symbol = ? WHERE mint = ?')
        .bind(item.metadata.name, item.metadata.symbol, item.mint)
        .run();

      const token = normalized.find(row => row.mint === item.mint);
      if (token) {
        token.name = item.metadata.name;
        token.symbol = item.metadata.symbol;
      }
    }
  }

  return normalized;
}

export async function scanStats(env: Env) {
  const row = await env.DB.prepare(`SELECT COUNT(*) as scanned, SUM(CASE WHEN recommendation=1 THEN 1 ELSE 0 END) as safe, SUM(CASE WHEN recommendation=0 THEN 1 ELSE 0 END) as blocked FROM tokens`).first<{ scanned:number; safe:number; blocked:number }>();
  return {
    scanned: Number(row?.scanned ?? 0),
    safe: Number(row?.safe ?? 0),
    blocked: Number(row?.blocked ?? 0),
  };
}
