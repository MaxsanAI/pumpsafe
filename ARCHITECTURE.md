# SafePump — Production Architecture & Deployment Runbook

## 1. Glossary
- CA / Contract Address: on Solana this normally means the token mint address.
- Mint: the on-chain account defining a token's supply, decimals and authorities.
- Mint Authority: can create additional supply. SafePump requires it to be revoked.
- Freeze Authority: can freeze token accounts. SafePump requires it to be revoked.
- SPL Token: Solana's standard fungible-token model.
- Token-2022: Solana's newer token program with extensions and a different risk surface.
- Holder: a wallet/token account holding the token.
- Top Holders: the largest token accounts/owners. Concentration can increase dump risk.
- LP / Liquidity Pool: assets deposited into an AMM for trading.
- LP Burn: LP ownership is destroyed or sent to an unrecoverable address.
- LP Lock: LP ownership is controlled by a lock mechanism until a condition/date.
- Bundled Launch / Cabal: multiple wallets acquiring meaningful allocations very early. It is a heuristic, not proof of fraud.
- Block 0 / first-slot buyers: informal trader terminology for the earliest launch transactions. Solana technically uses slots.
- MEV: Maximal Extractable Value from transaction ordering/insertion.
- Jito Tips: tips used in Jito's block-engine/validator ecosystem. A tip alone is not malicious.
- Priority Fee: additional compute-unit pricing intended to improve transaction scheduling.
- RPC Node: Solana JSON-RPC endpoint used to read chain state and submit transactions.
- Migration / Graduation: launchpad token moving from a bonding curve into an AMM/pool.
- Raydium: Solana liquidity/AMM protocol with multiple pool types.
- Pump.fun / PumpSwap: launchpad/AMM ecosystem.
- Dead Cat Bounce: temporary price recovery after a sharp fall; not a security property.
- SSE: one-way HTTP stream from server to browser. SafePump uses it for the live dashboard.
- WebSocket: long-lived bidirectional connection. Durable Objects are the recommended Cloudflare coordination layer.
- Webhook: HTTPS endpoint receiving pushed events.

## 2. Production architecture

Helius on-chain event -> authenticated Helius webhook -> Pages Function -> event normalizer -> anti-rug audit -> D1/KV -> Telegram + SSE dashboard.

A normal Pages Function is not used as a permanent outbound Solana WebSocket daemon. Cloudflare recommends Durable Objects for reliable long-lived WebSocket coordination. The current production baseline uses Helius webhooks for ingestion and SSE for browser fan-out. If sub-second LaserStream/parsed-stream ingestion is later required, add a dedicated Worker/Durable Object consumer and reuse the same audit pipeline.

## 3. Hard recommendation gate
1. Mint authority disabled.
2. Freeze authority disabled.
3. Top-10 owner concentration <= 35%.
4. Early launch cluster risk < 45.
5. Liquidity >= MIN_LIQUIDITY_USD.
6. LP burn/lock independently verified.
7. Final score >= 85.

LP verification is intentionally conservative. There is no single universal Solana RPC flag proving 100% LP burn/lock for every Raydium/PumpSwap pool type. SafePump therefore refuses to publish an 85+ recommendation unless LP_LOCK_API_URL returns explicit verification.

## 4. Dashboard deployment — no Wrangler CLI

### Pages
1. Cloudflare Dashboard -> Workers & Pages -> Create application -> Pages -> Import an existing Git repository.
2. Select MaxsanAI/pumpsafe.
3. Production branch: main.
4. Build command: npm run build.
5. Output directory: dist.
6. Deploy.

### D1
1. Workers & Pages -> D1 SQL database -> create pumpsafe-db.
2. Open D1 SQL Console.
3. Execute the full schema.sql file from this repository.
4. Pages project -> Settings -> Bindings -> Add -> D1 database.
5. Variable name: DB.
6. Select pumpsafe-db and redeploy.

### KV
1. Workers & Pages -> KV -> create pumpsafe-cache.
2. Pages project -> Settings -> Bindings -> Add -> KV namespace.
3. Variable name: CACHE.
4. Select pumpsafe-cache and redeploy.

### Runtime secrets/variables
- SOLANA_RPC_URL: production Solana RPC endpoint.
- HELIUS_API_KEY: Helius API key.
- HELIUS_WEBHOOK_SECRET: long random secret sent as Authorization by Helius.
- TELEGRAM_BOT_TOKEN: BotFather token.
- TELEGRAM_CHAT_ID: VIP channel/group destination.
- TELEGRAM_WEBHOOK_SECRET: optional Telegram secret token.
- MIN_LIQUIDITY_USD: recommended starting value 10000.
- LP_LOCK_API_URL: independent LP burn/lock verifier.
- LP_LOCK_API_KEY: optional verifier credential.
- PUBLIC_APP_URL: Pages/custom domain.

Use encrypted/secret values for credentials.

## 5. Helius webhook
1. Helius Dashboard -> Webhooks -> New Webhook.
2. Network: Mainnet.
3. Use Enhanced or Raw according to the event data available on your Helius plan.
4. URL: https://YOUR_PAGES_DOMAIN/api/webhooks/helius
5. Authorization header: exactly HELIUS_WEBHOOK_SECRET.
6. Subscribe to the Pump.fun/PumpSwap/Raydium launch, migration and token events available in the Helius dashboard.
7. Save and use the delivery/test function.

Helius can retry failed deliveries, so ingestion must be idempotent. SafePump uses a KV seen-by-mint guard and has a processed_events D1 table for future signature-level deduplication.

## 6. Telegram
Set the incoming bot webhook to https://YOUR_PAGES_DOMAIN/api/telegram.
If TELEGRAM_WEBHOOK_SECRET is configured, use Telegram's secret_token with the same value.
Outgoing SafePump recommendations use Telegram sendMessage with inline destinations for DEXScreener, GMGN, BullX, Trojan and Pump.fun.
The bot must be allowed to post in the configured channel/group.

## 7. Live dashboard
GET /api/tokens?limit=30 returns the initial recommendation snapshot.
GET /api/events opens the SSE stream.
The SSE function checks the newest D1 recommendation while keeping the HTTP response streaming, so the browser does not refresh.
For very large WebSocket fan-out or bidirectional commands, move the fan-out layer to a Durable Object using Cloudflare's WebSocket Hibernation API.

## 8. Deployment tests
Test 1: open /api/health and confirm ok=true plus configured binding booleans.
Test 2: in D1 SQL Console run SELECT 1; and SELECT COUNT(*) FROM tokens;.
Test 3: call the Helius endpoint without the correct Authorization header; it must return 401.
Test 4: send a Helius test delivery and verify it in Cloudflare live logs.
Test 5: confirm Telegram can post to the configured channel.
Test 6: open two dashboard tabs and replay a known event; both tabs should update without refresh.

## 9. Safety limitations
- Revoked authorities do not guarantee safety.
- LP burn/lock does not remove every developer or market risk.
- Holder concentration is a heuristic because multiple token accounts can be controlled by one entity.
- Cabal/bundle detection is behavioral, not proof of coordination.
- Jito tips are not automatically malicious.
- The score is a risk signal, not a profit forecast or guarantee.

SafePump deliberately prefers false negatives over false positives for its 85+ recommendation feed.