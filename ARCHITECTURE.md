# PumpSafe — Production Architecture & Deployment Runbook

## 1. Core architecture

PumpSafe uses a Solana-native discovery pipeline:

Solana JSON-RPC
-> Pump.fun program signatures
-> transaction inspection
-> create / create_v2 detection
-> TokenCandidate
-> token metadata enrichment
-> anti-rug scanner
-> D1
-> Telegram + /api/events SSE
-> React dashboard

The browser feed is read-only. It never performs discovery itself.

## 2. Discovery

The discovery service watches the Pump.fun program:

6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P

It reads recent transaction signatures with getSignaturesForAddress, fetches the transactions with getTransaction, and identifies successful Pump.fun create and create_v2 instructions by their program ID and Anchor instruction discriminator.

The first instruction account is the new mint account. The transaction signature becomes the event identity used by processed_events.

Discovery state is stored in D1:

- id = pumpfun
- cursor_signature = most recently processed discovery signature
- updated_at = last cursor update time

The service processes a bounded batch per run so a busy period can be caught up over subsequent runs instead of skipping transactions.

## 3. Enrichment and scanning

Each discovered mint follows the same audit path as a manual scan:

1. Jupiter token metadata.
2. DexScreener fallback when Jupiter does not have the token yet.
3. Mint authority check.
4. Freeze authority check.
5. Holder/top-10 concentration.
6. Early launch clustering.
7. Liquidity.
8. LP evidence.
9. Risk score.
10. D1 persistence.
11. Telegram notification.
12. SSE visibility through /api/events.

The scanner remains the security decision layer. Discovery does not decide whether a token is safe.

## 4. RPC reliability

RPC requests use:

1. SOLANA_RPC_URL.
2. SOLANA_RPC_FALLBACK_URL when configured.
3. Public Solana mainnet RPC as the final fallback.

The RPC layer rejects Helius URLs, applies timeouts, retries transient failures, and backs off after rate limits/server errors.

## 5. Hard recommendation gate

The anti-rug scanner remains conservative. A recommendation requires the existing critical controls to pass, including revoked authorities, acceptable holder concentration, acceptable launch-cluster risk, sufficient liquidity, verified LP evidence and the configured final score threshold.

## 6. Cloudflare Pages deployment — no Wrangler CLI

### Pages

1. Cloudflare Dashboard -> Workers & Pages -> Create application -> Pages -> Import an existing Git repository.
2. Select MaxsanAI/pumpsafe.
3. Production branch: main.
4. Build command: npm run build.
5. Output directory: dist.
6. Deploy.

### D1

1. Create or select the PumpSafe D1 database.
2. Open the D1 SQL Console.
3. Execute schema.sql.
4. Pages project -> Settings -> Bindings -> D1 database.
5. Variable name: DB.
6. Select the database and redeploy.

The discovery_state table is included in schema.sql and is also created defensively by the discovery service.

### KV

1. Create or select the PumpSafe KV namespace.
2. Pages project -> Settings -> Bindings -> KV namespace.
3. Variable name: CACHE.
4. Select the namespace and redeploy.

### Runtime variables

- SOLANA_RPC_URL — production Solana RPC endpoint.
- SOLANA_RPC_FALLBACK_URL — optional secondary Solana RPC endpoint.
- DISCOVERY_SECRET — long random secret used to authorize discovery runs.
- TELEGRAM_BOT_TOKEN — Telegram bot token.
- TELEGRAM_CHAT_ID — Telegram destination.
- TELEGRAM_WEBHOOK_SECRET — optional Telegram webhook secret.
- MIN_LIQUIDITY_USD — minimum liquidity threshold.
- LP_LOCK_API_URL — independent LP evidence provider.
- LP_LOCK_API_KEY — optional provider credential.
- PUBLIC_APP_URL — public PumpSafe URL.

Do not add legacy provider keys. PumpSafe does not depend on Helius.

## 7. Discovery execution

Run:

POST /api/discovery/run

with either:

Authorization: Bearer <DISCOVERY_SECRET>

or:

x-pumpsafe-discovery-secret: <DISCOVERY_SECRET>

The response reports:

- Solana signatures inspected.
- transactions inspected.
- real token candidates discovered.
- mints successfully passed to the scanner.
- failures with their actual error.

A scheduler should call this endpoint at a controlled interval. The scheduler is intentionally separate from the Pages request lifecycle so the Pages Function never becomes a permanent background daemon.

## 8. Production verification

A real production test is successful only when all of the following are observed:

1. A real Pump.fun create/create_v2 transaction is found through Solana RPC.
2. Its mint is extracted from the transaction.
3. Metadata is resolved or safely falls back.
4. The anti-rug scanner completes.
5. The audit is written to D1.
6. GET /api/tokens returns that audit.
7. /api/events can emit the new audit.
8. No legacy provider request or configuration is involved.

Until this chain is observed on the deployed system, discovery should not be described as proven live.
