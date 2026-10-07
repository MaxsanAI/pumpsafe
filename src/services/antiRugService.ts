import { rpc } from '../lib/rpc';
import type { AuditResult, Env, TokenCandidate } from '../lib/types';

type ParsedAccount = { value: { data?: { parsed?: { info?: { mintAuthority?: string | null; freezeAuthority?: string | null; supply?: string; decimals?: number } } } } | null };
type Largest = { address: string; amount: string; decimals: number };
type Multiple = { value: Array<{ data?: { parsed?: { info?: { owner?: string; tokenAmount?: { amount?: string } } } } } | null> };
type DexPair = { liquidity?: { usd?: number }; baseToken?: { address?: string; name?: string; symbol?: string }; quoteToken?: { address?: string } };

const pct = (part: bigint, total: bigint) => total > 0n ? Number((part * 10000n) / total) / 100 : 100;
const DEFAULT_LP_PROVIDER = 'https://api.rugcheck.xyz/v1/tokens/{mint}/report/summary';

async function dexLiquidity(mint: string): Promise<{ usd: number | null; pair: DexPair | null }> {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`, { headers: { accept: 'application/json' } });
    if (!r.ok) return { usd: null, pair: null };
    const body = await r.json() as { pairs?: DexPair[] };
    const pair = (body.pairs ?? []).sort((a,b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0] ?? null;
    return { usd: pair?.liquidity?.usd ?? null, pair };
  } catch { return { usd: null, pair: null }; }
}

async function verifyLp(env: Env, mint: string, liquidityUsd: number | null): Promise<boolean> {
  try {
    const template = env.LP_LOCK_API_URL || DEFAULT_LP_PROVIDER;
    const endpoint = template.includes('{mint}') ? template.replaceAll('{mint}', encodeURIComponent(mint)) : (() => {
      const u = new URL(template);
      u.searchParams.set('mint', mint);
      return u.toString();
    })();
    const r = await fetch(endpoint, { headers: env.LP_LOCK_API_KEY ? { authorization: `Bearer ${env.LP_LOCK_API_KEY}` } : { accept: 'application/json' } });
    if (!r.ok) return false;
    const data = await r.json() as any;
    const lockedPct = Number(data?.lpLockedPct ?? data?.lockedPct ?? data?.markets?.[0]?.lp?.lpLockedPct ?? 0);
    const burnedPct = Number(data?.burnedPct ?? 0);
    const providerLiquidity = Number(data?.totalMarketLiquidity ?? data?.liquidityUsd ?? 0);
    const reportedLiquidity = providerLiquidity > 0 ? providerLiquidity : (liquidityUsd ?? 0);
    return reportedLiquidity > 0 && lockedPct + burnedPct >= 100;
  } catch { return false; }
}

async function holderConcentration(env: Env, mint: string): Promise<{ top10Pct: number; owners: string[] }> {
  const largest = await rpc<LargestResponse>(env.SOLANA_RPC_URL, 'getTokenLargestAccounts', [mint, { commitment: 'finalized' }]);
  const supply = await rpc<{ value: { amount: string } }>(env.SOLANA_RPC_URL, 'getTokenSupply', [mint, { commitment: 'finalized' }]);
  const top = (largest.value ?? []).slice(0, 20);
  const accounts = await rpc<Multiple>(env.SOLANA_RPC_URL, 'getMultipleAccounts', [top.map(x => x.address), { encoding: 'jsonParsed', commitment: 'finalized' }]);
  const ownerBalances = new Map<string, bigint>();
  for (let i = 0; i < top.length; i++) {
    const owner = accounts.value[i]?.data?.parsed?.info?.owner;
    if (!owner) continue;
    const amount = BigInt(top[i].amount);
    ownerBalances.set(owner, (ownerBalances.get(owner) ?? 0n) + amount);
  }
  const sorted = [...ownerBalances.entries()].sort((a,b) => Number(b[1] - a[1]));
  const top10 = sorted.slice(0,10).reduce((s, [,v]) => s + v, 0n);
  return { top10Pct: pct(top10, BigInt(supply.value.amount)), owners: sorted.slice(0,10).map(([o]) => o) };
}

async function launchClusterRisk(env: Env, candidate: TokenCandidate, owners: string[]): Promise<{ bundleRisk: number; devRisk: number }> {
  if (!candidate.signature) return { bundleRisk: 50, devRisk: 50 };
  try {
    const signatures = await rpc<Array<{ signature: string; slot: number }>>(env.SOLANA_RPC_URL, 'getSignaturesForAddress', [candidate.mint, { limit: 1000, commitment: 'finalized' }]);
    if (signatures.length === 0) return { bundleRisk: 50, devRisk: 50 };

    const launchSlot = Math.min(...signatures.map(x => x.slot));
    const earliest = signatures.filter(x => x.slot <= launchSlot + 2).slice(-6);
    const txs: any[] = [];

    for (let i = 0; i < earliest.length; i += 2) {
      const batch = earliest.slice(i, i + 2);
      const results = await Promise.all(batch.map(async item => {
        try {
          return await rpc<any>(env.SOLANA_RPC_URL, 'getTransaction', [
            item.signature,
            { encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 0 },
          ]);
        } catch {
          return null;
        }
      }));
      txs.push(...results);
    }

    const payerSet = new Set<string>();
    let feePayer: string | undefined;
    for (const tx of txs) {
      const payer = tx?.transaction?.message?.accountKeys?.[0]?.pubkey ?? tx?.transaction?.message?.accountKeys?.[0];
      if (payer) { payerSet.add(payer); if (!feePayer) feePayer = payer; }
    }
    const clusterSize = payerSet.size;
    const bundleRisk = clusterSize >= 8 ? 90 : clusterSize >= 6 ? 65 : clusterSize >= 4 ? 40 : clusterSize >= 2 ? 18 : 5;
    const devRisk = feePayer && owners.includes(feePayer) ? 70 : 10;
    return { bundleRisk, devRisk };
  } catch { return { bundleRisk: 55, devRisk: 55 }; }
}

export async function auditToken(env: Env, candidate: TokenCandidate, deepScan = false): Promise<AuditResult> {
  const mint = await rpc<ParsedAccount>(env.SOLANA_RPC_URL, 'getAccountInfo', [candidate.mint, { encoding: 'jsonParsed', commitment: 'finalized' }]);
  const info = mint.value?.data?.parsed?.info;
  if (!info) throw new Error('Mint account not found or unsupported token program');
  const mintAuthorityDisabled = info.mintAuthority == null;
  const freezeAuthorityDisabled = info.freezeAuthority == null;
  const holders = await holderConcentration(env, candidate.mint);
  const liq = await dexLiquidity(candidate.mint);
  const lpVerified = await verifyLp(env, candidate.mint, liq.usd);
  const risks = deepScan ? await launchClusterRisk(env, candidate, holders.owners) : { bundleRisk: 0, devRisk: 0 };

  let score = 100;
  score -= mintAuthorityDisabled ? 0 : 30;
  score -= freezeAuthorityDisabled ? 0 : 30;
  if (holders.top10Pct > 50) score -= 25; else if (holders.top10Pct > 35) score -= 15; else if (holders.top10Pct > 25) score -= 8;
  score -= Math.round(risks.bundleRisk * 0.18);
  score -= Math.round(risks.devRisk * 0.12);
  if (!lpVerified) score -= 20;
  const minLiquidity = Number(env.MIN_LIQUIDITY_USD ?? '10000');
  if (liq.usd == null || liq.usd < minLiquidity) score -= 10;
  score = Math.max(0, Math.min(100, score));

  const safetyThreshold = 60;
  const criticalAuthorityRisk = !mintAuthorityDisabled || !freezeAuthorityDisabled;
  const recommendation = score >= safetyThreshold && !criticalAuthorityRisk;
  const reasons: string[] = [];
  if (!mintAuthorityDisabled) reasons.push('mint authority is still active');
  if (!freezeAuthorityDisabled) reasons.push('freeze authority is still active');
  if (!lpVerified) reasons.push('LP burn/lock is not independently verified');
  if (holders.top10Pct > 50) reasons.push(`top 10 holders control ${holders.top10Pct.toFixed(1)}%`);
  else if (holders.top10Pct > 35) reasons.push(`elevated holder concentration at ${holders.top10Pct.toFixed(1)}%`);
  if (deepScan && risks.bundleRisk >= 45) reasons.push(`launch clustering risk ${risks.bundleRisk}/100`);
  if ((liq.usd ?? 0) < minLiquidity) reasons.push(`liquidity is below ${Math.round(minLiquidity).toLocaleString()}`);
  if (score < safetyThreshold) reasons.push(`risk score is below the ${safetyThreshold}/100 safety threshold`);
  const reason = recommendation
    ? reasons.length > 0
      ? `SAFE at ${safetyThreshold}/100 threshold, with noted risks: ${reasons.join('; ')}.`
      : `SAFE: score ${score}/100 with both token authorities revoked.`
    : `RUG RISK: ${reasons.length > 0 ? reasons.join('; ') + '.' : `risk score ${score}/100 is below the ${safetyThreshold}/100 safety threshold.`}`;

  return { mint: candidate.mint, name: candidate.name, symbol: candidate.symbol, score, source: candidate.source, detectedAt: Date.now(), mintAuthorityDisabled, freezeAuthorityDisabled, top10Pct: holders.top10Pct, lpVerified, bundleRisk: risks.bundleRisk, devRisk: risks.devRisk, liquidityUsd: liq.usd, reason, recommendation };
}
