# PumpSafe

Production-oriented Solana anti-rug scanner and automated safety recommendation feed.

Stack: Cloudflare Pages + Pages Functions + D1 + KV + Solana JSON-RPC + Jupiter token metadata + DexScreener + Telegram Bot API + React/Vite.

## Solana discovery pipeline

PumpSafe discovers new Pump.fun launches directly from Solana RPC.

Solana RPC
-> Pump.fun program signatures
-> transaction inspection
-> create / create_v2 instruction detection
-> TokenCandidate
-> Jupiter / DexScreener metadata
-> anti-rug audit
-> D1
-> /api/tokens + /api/events

The discovery cursor is stored in D1 so repeated runs do not rescan the same transaction window. Discovery uses the configured Solana RPC, an optional fallback RPC, and the public Solana endpoint as a final fallback.

## Scanner safety gate

PumpSafe evaluates mint authority, freeze authority, holder concentration, early launch clustering, liquidity and LP evidence before publishing a recommendation.

## API

- POST /api/scan — manually scan a token mint.
- POST /api/discovery/run — protected Solana discovery run.
- GET /api/tokens — recent audited tokens.
- GET /api/events — live SSE feed.
- GET /api/market — DexScreener market data.
- GET /api/health — runtime configuration health.

The discovery endpoint requires the DISCOVERY_SECRET environment secret and accepts either Authorization: Bearer <secret> or x-pumpsafe-discovery-secret.

## Files

- src/services/solanaDiscoveryService.ts — direct Solana/Pump.fun discovery.
- src/services/antiRugService.ts — authority, holder concentration, launch-cluster, liquidity and LP checks.
- src/services/tokenMetadataService.ts — Jupiter metadata with DexScreener fallback.
- src/services/processEvent.ts — enrichment, audit, persistence and Telegram dispatch.
- functions/api/discovery/run.ts — protected discovery execution endpoint.
- functions/api/events.ts — browser SSE stream.
- functions/api/telegram.ts — Telegram webhook endpoint.
- web/main.tsx — live dashboard.
- schema.sql — D1 schema.
- ARCHITECTURE.md — deployment and production runbook.

## Deployment

Cloudflare Pages remains the runtime target. No Wrangler configuration is required.

Configure the D1 and KV bindings in the Cloudflare dashboard, then set the runtime variables from .env.example. Set DISCOVERY_SECRET to a long random value before enabling scheduled discovery calls.

## LP verification

PumpSafe uses its configured independent LP evidence source and remains conservative when LP evidence is unavailable.

