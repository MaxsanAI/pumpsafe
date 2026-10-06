import type { TokenCandidate } from '../lib/types';

export type HeliusEvent = {
  signature?: string;
  type?: string;
  source?: string;
  description?: string;
  timestamp?: number;
  tokenTransfers?: Array<{ mint?: string; tokenAmount?: number | string }>;
  events?: Record<string, unknown>;
  instructions?: Array<{
    programId?: string;
    programName?: string;
    instructionName?: string;
    accounts?: Array<{ pubkey?: string }>;
    innerInstructions?: Array<{
      programId?: string;
      accounts?: string[];
      data?: string;
    }>;
  }>;
  [key: string]: unknown;
};

const PUMP_FUN_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const PUMPSWAP_PROGRAM = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
const RAYDIUM_AMM = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp1';
const RAYDIUM_CPMM = 'CPMMoo8L3F4NbVNunggL7H1ZpdTHKxQB5qKP1C';
const RAYDIUM_LAUNCHLAB = 'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function eventText(e: HeliusEvent): string {
  const eventText = e.events && typeof e.events === 'object'
    ? JSON.stringify(e.events)
    : '';
  const rawInstructionText = JSON.stringify(e.instructions ?? []);
  return [e.source ?? '', e.type ?? '', e.description ?? '', eventText, rawInstructionText]
    .join(' ')
    .toLowerCase();
}

function looksLikeMint(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function containsKnownProgram(value: unknown, depth = 0): boolean {
  if (depth > 10 || value == null) return false;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return [
      PUMP_FUN_PROGRAM,
      PUMPSWAP_PROGRAM,
      RAYDIUM_AMM,
      RAYDIUM_CPMM,
      RAYDIUM_LAUNCHLAB,
    ].some(program => lower.includes(program.toLowerCase()));
  }
  if (Array.isArray(value)) return value.some(item => containsKnownProgram(item, depth + 1));
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .some(child => containsKnownProgram(child, depth + 1));
  }
  return false;
}

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

function isLaunchEvent(e: HeliusEvent, text: string): boolean {
  const type = (e.type ?? '').toLowerCase();
  if (type === 'token_mint' || type === 'create_mint' || type === 'initialize_mint') return true;

  // Do not treat ordinary Pump.fun swaps as new launches. Helius can deliver
  // SWAP payloads even when the webhook is configured around Pump.fun migration.
  if (type === 'swap' || type === 'trade') {
    return /migrat|graduate|graduat|create[_ ]?pool|launchlab/.test(text);
  }

  return /migrat|graduate|graduat|create[_ ]?pool|initialize[_ ]?mint|create[_ ]?mint|launchlab/.test(text);
}

export function normalizeEvents(events: HeliusEvent[]): TokenCandidate[] {
  const out = new Map<string, TokenCandidate>();

  for (const e of events) {
    const text = eventText(e);
    const source = e.source?.toLowerCase() === 'pump_fun'
      ? 'pump.fun'
      : text.includes(PUMP_FUN_PROGRAM.toLowerCase()) || text.includes('pump.fun')
        ? 'pump.fun'
        : text.includes(PUMPSWAP_PROGRAM.toLowerCase()) || text.includes('pumpswap')
          ? 'pumpswap'
          : text.includes(RAYDIUM_AMM.toLowerCase()) ||
              text.includes(RAYDIUM_CPMM.toLowerCase()) ||
              text.includes('raydium')
            ? 'raydium'
            : 'on-chain';

    if (!isLaunchEvent(e, text) || !containsKnownProgram(e)) continue;

    const primaryMints = asArray<{ mint?: string }>(e.tokenTransfers)
      .map(transfer => transfer.mint)
      .filter(looksLikeMint);

    const mints = new Set(primaryMints);
    if (mints.size === 0) extractMints(e, mints);

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
