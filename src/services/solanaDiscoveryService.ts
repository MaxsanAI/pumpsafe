import { rpc } from '../lib/rpc';
import type { Env, TokenCandidate } from '../lib/types';

export const PUMP_FUN_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

const CREATE_DISCRIMINATORS = new Set([
  // legacy create
  '181ec828051c0777',
  // createV2
  'd6904cec5f8b31b4',
]);

const DISCOVERY_LIMIT = 100;
const MAX_TRANSACTIONS_PER_RUN = 30;

interface DiscoveryDiagnostics {
  transactionsWithPumpProgram: number;
  outerPumpInstructions: number;
  innerPumpInstructions: number;
  createDiscriminatorHits: number;
  createV2DiscriminatorHits: number;
  sampleDiscriminators: string[];
}

interface SignatureInfo {
  signature: string;
  slot: number;
  blockTime?: number | null;
  err?: unknown;
}

type AccountKey =
  | string
  | { pubkey: string; signer?: boolean; writable?: boolean; source?: string };

type Instruction = {
  programId?: string;
  programIdIndex?: number;
  accounts?: Array<number | string>;
  data?: string;
  parsed?: unknown;
};

type InnerInstructionGroup = {
  index: number;
  instructions?: Instruction[];
};

type TransactionResponse = {
  slot: number;
  blockTime?: number | null;
  meta?: {
    err?: unknown;
    logMessages?: string[] | null;
    innerInstructions?: InnerInstructionGroup[] | null;
  } | null;
  transaction?: {
    message?: {
      accountKeys?: AccountKey[];
      instructions?: Instruction[];
    };
  };
};

function accountKeyValue(value: AccountKey | undefined): string | null {
  if (typeof value === 'string') return value;
  return value?.pubkey ?? null;
}

function decodeBase58(value: string): Uint8Array | null {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const bytes = [0];

  for (const char of value) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) return null;

    let carry = digit;
    for (let i = 0; i < bytes.length; i++) {
      const next = bytes[i] * 58 + carry;
      bytes[i] = next & 0xff;
      carry = next >> 8;
    }

    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  for (let i = 0; i < value.length && value[i] === '1'; i++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

function discriminator(data: string | undefined): string | null {
  if (!data) return null;
  const decoded = decodeBase58(data);
  if (!decoded || decoded.length < 8) return null;

  return [...decoded.slice(0, 8)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function instructionProgramId(instruction: Instruction, keys: AccountKey[]): string | null {
  if (instruction.programId) return instruction.programId;
  if (typeof instruction.programIdIndex === 'number') {
    return accountKeyValue(keys[instruction.programIdIndex]);
  }
  return null;
}

function extractMint(instruction: Instruction, keys: AccountKey[]): string | null {
  const first = instruction.accounts?.[0];

  if (typeof first === 'number') return accountKeyValue(keys[first]);
  if (typeof first === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(first)) return first;

  return null;
}

function isCreateInstruction(instruction: Instruction, keys: AccountKey[]): boolean {
  if (instructionProgramId(instruction, keys) !== PUMP_FUN_PROGRAM) return false;
  return CREATE_DISCRIMINATORS.has(discriminator(instruction.data) ?? '');
}

function candidateFromTransaction(
  signature: SignatureInfo,
  tx: TransactionResponse,
  diagnostics: DiscoveryDiagnostics,
): TokenCandidate | null {
  if (tx.meta?.err) return null;

  const message = tx.transaction?.message;
  const keys = message?.accountKeys ?? [];
  let foundPumpInstruction = false;

  const inspect = (instruction: Instruction): TokenCandidate | null => {
    if (instructionProgramId(instruction, keys) !== PUMP_FUN_PROGRAM) return null;

    foundPumpInstruction = true;
    const disc = discriminator(instruction.data);
    if (disc) {
      if (diagnostics.sampleDiscriminators.length < 12 && !diagnostics.sampleDiscriminators.includes(disc)) {
        diagnostics.sampleDiscriminators.push(disc);
      }
      if (disc === '181ec828051c0777') diagnostics.createDiscriminatorHits++;
      if (disc === 'd6904cec5f8b31b4') diagnostics.createV2DiscriminatorHits++;
    }

    const isCreate = CREATE_DISCRIMINATORS.has(disc ?? '');
    if (!isCreate) return null;

    const mint = extractMint(instruction, keys);
    if (!mint) return null;

    return {
      mint,
      name: 'Unknown',
      symbol: 'TOKEN',
      source: 'pump.fun',
      signature: signature.signature,
      pumpFun: true,
    };
  };

  for (const instruction of message?.instructions ?? []) {
    if (instructionProgramId(instruction, keys) === PUMP_FUN_PROGRAM) {
      diagnostics.outerPumpInstructions++;
    }
    const candidate = inspect(instruction);
    if (candidate) return candidate;
  }

  for (const group of tx.meta?.innerInstructions ?? []) {
    for (const instruction of group.instructions ?? []) {
      if (instructionProgramId(instruction, keys) === PUMP_FUN_PROGRAM) {
        diagnostics.innerPumpInstructions++;
      }
      const candidate = inspect(instruction);
      if (candidate) return candidate;
    }
  }

  if (foundPumpInstruction) diagnostics.transactionsWithPumpProgram++;
  return null;
}

async function ensureDiscoveryState(env: Env): Promise<void> {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS discovery_state (id TEXT PRIMARY KEY, cursor_signature TEXT, updated_at INTEGER NOT NULL)').run();
}

async function getCursor(env: Env): Promise<string | null> {
  await ensureDiscoveryState(env);

  const row = await env.DB
    .prepare('SELECT cursor_signature FROM discovery_state WHERE id = ?')
    .bind('pumpfun')
    .first<{ cursor_signature: string | null }>();

  return row?.cursor_signature ?? null;
}

async function setCursor(env: Env, signature: string): Promise<void> {
  await ensureDiscoveryState(env);

  await env.DB.prepare('INSERT INTO discovery_state (id,cursor_signature,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET cursor_signature=excluded.cursor_signature,updated_at=excluded.updated_at')
    .bind('pumpfun', signature, Date.now())
    .run();
}

export interface DiscoveryResult {
  signaturesChecked: number;
  transactionsChecked: number;
  candidates: TokenCandidate[];
  cursor: string | null;
  diagnostics: DiscoveryDiagnostics;
}

export async function discoverPumpFunTokens(env: Env): Promise<DiscoveryResult> {
  const cursor = await getCursor(env);

  const signatures = await rpc<SignatureInfo[]>(
    env.SOLANA_RPC_URL,
    'getSignaturesForAddress',
    [PUMP_FUN_PROGRAM, { limit: DISCOVERY_LIMIT }],
  );

  const cursorIndex = cursor
    ? signatures.findIndex(item => item.signature === cursor)
    : -1;

  const pending = cursorIndex >= 0
    ? signatures.slice(0, cursorIndex)
    : signatures;

  const batch = pending.slice(0, MAX_TRANSACTIONS_PER_RUN);

  const candidates = new Map<string, TokenCandidate>();
  let transactionsChecked = 0;
  const diagnostics: DiscoveryDiagnostics = {
    transactionsWithPumpProgram: 0,
    outerPumpInstructions: 0,
    innerPumpInstructions: 0,
    createDiscriminatorHits: 0,
    createV2DiscriminatorHits: 0,
    sampleDiscriminators: [],
  };

  for (const signature of batch) {
    const tx = await rpc<TransactionResponse | null>(
      env.SOLANA_RPC_URL,
      'getTransaction',
      [
        signature.signature,
        { encoding: 'jsonParsed', maxSupportedTransactionVersion: 1 },
      ],
    );

    transactionsChecked++;

    if (tx) {
      const candidate = candidateFromTransaction(signature, tx, diagnostics);
      if (candidate) candidates.set(candidate.mint, candidate);
    }
  }

  if (batch.length > 0) {
    await setCursor(env, batch[batch.length - 1].signature);
  }

  return {
    signaturesChecked: signatures.length,
    transactionsChecked,
    candidates: [...candidates.values()],
    cursor: batch.length ? batch[batch.length - 1].signature : cursor,
    diagnostics,
  };
}
