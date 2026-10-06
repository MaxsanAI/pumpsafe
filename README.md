# SafePump 🛡️

Production-oriented Solana anti-rug scanner and automated safety recommendation feed.

Stack: Cloudflare Pages + Pages Functions + D1 + KV + Helius webhooks + Solana JSON-RPC + Telegram Bot API + React/Vite.

## Safety gate

SafePump only publishes a recommendation when all critical controls pass: revoked mint authority, revoked freeze authority, controlled top-holder concentration, acceptable early-launch clustering, sufficient liquidity and 100% LP burn/lock evidence, with a final score of at least 85/100.

## Real-time architecture

Helius on-chain webhook
-> /api/webhooks/helius
-> websocketListener.ts
-> antiRugService.ts
-> D1 + KV
-> Telegram alert + /api/events SSE
-> React PWA live dashboard

SafePump intentionally does not keep a permanent outbound Solana WebSocket inside a Pages Function. Cloudflare recommends Durable Objects for reliable long-lived WebSocket coordination. Helius webhooks provide the event-driven ingestion edge; a future LaserStream/DO consumer can reuse the same audit pipeline.

## Files

- src/services/antiRugService.ts — authority, holder concentration, launch-cluster, liquidity and LP checks.
- src/services/websocketListener.ts — real-time event normalization adapter.
- src/services/processEvent.ts — enrichment, audit, persistence and Telegram dispatch.
- functions/api/webhooks/helius.ts — authenticated Helius webhook endpoint.
- functions/api/events.ts — browser SSE stream.
- functions/api/telegram.ts — Telegram webhook endpoint.
- web/main.tsx — live dashboard.
- schema.sql — D1 schema.
- ARCHITECTURE.md — glossary, Cloudflare dashboard setup, webhook setup and production test plan.

## LP verification

SafePump uses RugCheck's token report summary as the default LP evidence source and requires reported LP locked/burned coverage of 100% before a token can pass the hard gate. You can override the provider with LP_LOCK_API_URL and optionally LP_LOCK_API_KEY.

## Source verification

The source has been statically type-checked with TypeScript using compatibility declarations for the Cloudflare/React runtime. The local environment available for this build could not complete npm dependency installation, so the final Vite production build is intentionally left to the Cloudflare Pages build environment, where package installation occurs from package.json.

See ARCHITECTURE.md for the complete no-Wrangler dashboard deployment procedure.
