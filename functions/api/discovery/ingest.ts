import { processCandidate } from '../../../src/services/processEvent';
import type { Env, TokenCandidate } from '../../../src/lib/types';

type PumpPortalToken = {
  txType?: string;
  mint?: string;
  name?: string;
  symbol?: string;
  signature?: string;
  traderPublicKey?: string;
  initialBuy?: number;
  marketCapSol?: number;
  bondingCurveKey?: string;
  vSolInBondingCurve?: number;
  vTokensInBondingCurve?: number;
};

function authorized(request: Request, env: Env): boolean {
  const secret = env.DISCOVERY_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const direct = request.headers.get('x-pumpsafe-discovery-secret')?.trim() ?? '';

  return token === secret || direct === secret;
}

function validMint(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length >= 32 &&
    value.length <= 44 &&
    /^[1-9A-HJ-NP-Za-km-z]+$/.test(value);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error || 'Unknown ingest error');
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!authorized(request, env)) {
    return Response.json(
      { error: 'Unauthorized discovery ingest request.' },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    );
  }

  try {
    const body = await request.json().catch(() => null) as PumpPortalToken | null;

    if (!body || body.txType !== 'create' || !validMint(body.mint)) {
      return Response.json(
        { error: 'Invalid PumpPortal token creation event.' },
        { status: 400, headers: { 'cache-control': 'no-store' } },
      );
    }

    const candidate: TokenCandidate = {
      mint: body.mint,
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Unknown',
      symbol: typeof body.symbol === 'string' && body.symbol.trim() ? body.symbol.trim() : 'TOKEN',
      source: 'pump.fun',
      signature: typeof body.signature === 'string' ? body.signature : undefined,
      pumpFun: true,
    };

    const result = await processCandidate(env, candidate, true);

    return Response.json(
      {
        ok: true,
        source: 'pumpportal',
        mint: candidate.mint,
        processed: result.processed,
        audit: result.audit ?? null,
        launch: {
          creator: body.traderPublicKey ?? null,
          initialBuy: body.initialBuy ?? null,
          marketCapSol: body.marketCapSol ?? null,
          bondingCurveKey: body.bondingCurveKey ?? null,
          vSolInBondingCurve: body.vSolInBondingCurve ?? null,
          vTokensInBondingCurve: body.vTokensInBondingCurve ?? null,
        },
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    console.error('pumpportal ingest failed', error);
    return Response.json(
      { error: 'PumpPortal ingest failed: ' + errorMessage(error) },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }
};
