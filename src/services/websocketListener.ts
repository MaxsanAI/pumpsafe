import type { TokenCandidate } from '../lib/types';

/**
 * Real-time ingestion adapter.
 *
 * Cloudflare Pages Functions should not keep a long-lived outbound Solana
 * WebSocket open. The production path is Helius webhook -> this adapter ->
 * audit -> D1/KV -> SSE to browsers.
 */
export type HeliusEvent = {
  signature?: string;
  type?: string;
  description?: string;
  timestamp?: number;
  tokenTransfers?: Array<{ mint?: string; tokenAmount?: number | string }>;
  events?: Record<string, unknown>;
  instructions?: Array<{
    programId?: string;
    programName?: string;
    instructionName?: string;
    accounts?: Array<{ pubkey?: string }>;
  }>;
  [key: string]: unknown;
};

const PUMP_FUN_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const PUMPSWAP_PROGRAM = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
const RAYDIUM_AMM = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
const RAYDIUM_CPMM = 'CPMMoo8L3F4NbVNunggL7H1ZpdTHKxQB5qKP1C';
const RAYDIUM_LAUNCHLAB = 'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function eventText(e: HeliusEvent): string {
  const instructions = asArray<{
    programId?: string;
    programName?: string;
    instructionName?: string;
  }>(e.instructions);

  const eventText = e.events && typeof e.events === 'object'
    ? JSON.stringify(e.events)
    : '';

  return [
    e.type ?? '',
    e.description ?? '',
    eventText,
    instructions
      .map(i => (i.programId ?? '') + ' ' + (i.programName ?? '') + ' ' + (i.instructionName ?? ''))
      .join(' '),
  ].join(' ').toLowerCase();
}

function looksLikeMint(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

/**
 * Helius has used more than one shape for parsed migration events.
 * Keep tokenTransfers as the primary source, then fall back to fields whose
 * names explicitly identify a mint. This avoids treating arbitrary account
 * addresses as token mints.
 */
function extractMints(value: unknown, found = new Set<string>(), depth = 0): Set<string> {
  if (depth > 8 || value == null) return found;

  if (Array.isArray(value)) {
    for (const item of value) extractMints(item, found, depth + 1);
    return found;
  }

  if (typeof value !== 'object') return found;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase();

    if (
      (normalizedKey === 'mint' ||
        normalizedKey === 'tokenmint' ||
        normalizedKey === 'mintaddress' ||
        normalizedKey === 'token_mint') &&
      looksLikeMint(child)
    ) {
      found.add(child);
    }

    extractMints(child, found, depth + 1);
  }

  return found;
}

export function normalizeEvents(events: HeliusEvent[]): TokenCandidate[] {
  const out = new Map<string, TokenCandidate>();

  for (const e of events) {
    const text = eventText(e);
    const programHit = [
      PUMP_FUN_PROGRAM,
      PUMPSWAP_PROGRAM,
      RAYDIUM_AMM,
      RAYDIUM_CPMM,
      RAYDIUM_LAUNCHLAB,
    ].some(p => text.includes(p.toLowerCase()));

    const migrationLike = /migrat|create[_ ]?pool|launchlab|raydium|pumpswap|pump\.fun/.test(text);
    if (!programHit && !migrationLike && e.type !== 'TOKEN_MINT') continue;

    const primaryMints = asArray<{ mint?: string }>(e.tokenTransfers)
      .map(transfer => transfer.mint)
      .filter(looksLikeMint);

    const mints = new Set(primaryMints);
    if (mints.size === 0) {
      extractMints(e, mints);
    }

    const source =
      text.includes(PUMP_FUN_PROGRAM.toLowerCase()) || text.includes('pump.fun')
        ? 'pump.fun'
        : text.includes(PUMPSWAP_PROGRAM.toLowerCase()) || text.includes('pumpswap')
          ? 'pumpswap'
          : text.includes(RAYDIUM_AMM.toLowerCase()) ||
              text.includes(RAYDIUM_CPMM.toLowerCase()) ||
              text.includes('raydium')
            ? 'raydium'
            : 'on-chain';

    for (const mint of mints) {
      out.set(mint, {
        mint,
        name: 'Unknown',
        symbol: 'TOKEN',
        source,
        signature: e.signature,
        pumpFun: source === 'pump.fun',
      });
    }
  }

  return [...out.values()];
}
