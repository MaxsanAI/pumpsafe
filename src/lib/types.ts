export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  SOLANA_RPC_URL: string;
  SOLANA_RPC_FALLBACK_URL?: string;
  DISCOVERY_SECRET?: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  LP_LOCK_API_URL?: string;
  LP_LOCK_API_KEY?: string;
  MIN_LIQUIDITY_USD?: string;
  PUBLIC_APP_URL?: string;
}

export interface TokenCandidate {
  mint: string;
  name: string;
  symbol: string;
  source: string;
  signature?: string;
  pumpFun?: boolean;
}

export interface AuditResult {
  mint: string;
  name: string;
  symbol: string;
  score: number;
  source: string;
  detectedAt: number;
  mintAuthorityDisabled: boolean;
  freezeAuthorityDisabled: boolean;
  top10Pct: number;
  lpVerified: boolean;
  bundleRisk: number;
  devRisk: number;
  liquidityUsd: number | null;
  reason: string;
  recommendation: boolean;
  imageUrl?: string | null;
  metadataSource?: string;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  verified?: boolean | null;
  organicScore?: number | null;
  holderCount?: number | null;
}
