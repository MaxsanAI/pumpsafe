import { discoverPumpFunTokens } from '../../../src/services/solanaDiscoveryService';
import { processCandidate } from '../../../src/services/processEvent';
import type { Env } from '../../../src/lib/types';

function authorized(request: Request, env: Env): boolean {
  const secret = env.DISCOVERY_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const direct = request.headers.get('x-pumpsafe-discovery-secret')?.trim() ?? '';

  return token === secret || direct === secret;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error || 'Unknown discovery error');
}

async function handleDiscovery(request: Request, env: Env): Promise<Response> {
  if (!authorized(request, env)) {
    return Response.json(
      { error: 'Unauthorized discovery request.' },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    );
  }

  try {
    const discovery = await discoverPumpFunTokens(env);
    const processed: string[] = [];
    const failed: Array<{ mint: string; error: string }> = [];

    for (let i = 0; i < discovery.candidates.length; i += 1) {
      const batch = discovery.candidates.slice(i, i + 1);

      await Promise.all(
        batch.map(async candidate => {
          try {
            const result = await processCandidate(env, candidate, true);
            if (result.processed) processed.push(candidate.mint);
          } catch (error) {
            failed.push({
              mint: candidate.mint,
              error: errorMessage(error),
            });
          }
        }),
      );
    }

    return Response.json(
      {
        ok: true,
        source: 'solana-rpc',
        discovery: {
          signaturesChecked: discovery.signaturesChecked,
          transactionsChecked: discovery.transactionsChecked,
          candidates: discovery.candidates.length,
          cursor: discovery.cursor,
          diagnostics: discovery.diagnostics,
        },
        processed,
        failed,
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    console.error('solana discovery failed', error);

    return Response.json(
      { error: 'Discovery failed: ' + errorMessage(error) },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) =>
  handleDiscovery(request, env);

export const onRequestGet: PagesFunction<Env> = async () =>
  Response.json(
    {
      ok: true,
      route: '/api/discovery/run',
      method: 'GET',
      message: 'PumpSafe discovery endpoint is deployed. Use POST to run discovery.',
    },
    {
      headers: {
        'cache-control': 'no-store',
        allow: 'POST, GET',
      },
    },
  );
