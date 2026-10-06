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

    for (const transfer of asArray<{ mint?: string }>(e.tokenTransfers)) {
      if (!transfer.mint || transfer.mint.length < 32) continue;

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

      out.set(transfer.mint, {
        mint: transfer.mint,
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