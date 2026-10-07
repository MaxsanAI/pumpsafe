import type { Env } from '../../src/lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => Response.json({
  ok: true,
  service: 'PumpSafe',
  time: new Date().toISOString(),
  configured: {
    db: Boolean(env.DB),
    cache: Boolean(env.CACHE),
    rpc: Boolean(env.SOLANA_RPC_URL),
    discovery: Boolean(env.DISCOVERY_SECRET),
    telegram: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
  },
});
