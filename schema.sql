CREATE TABLE IF NOT EXISTS tokens (
  mint TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Unknown',
  symbol TEXT NOT NULL DEFAULT 'TOKEN',
  score INTEGER NOT NULL,
  source TEXT NOT NULL,
  detected_at INTEGER NOT NULL,
  mint_authority_disabled INTEGER NOT NULL,
  freeze_authority_disabled INTEGER NOT NULL,
  top10_pct REAL NOT NULL,
  lp_verified INTEGER NOT NULL,
  bundle_risk REAL NOT NULL,
  dev_risk REAL NOT NULL,
  liquidity_usd REAL,
  reason TEXT NOT NULL,
  recommendation INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tokens_recommendation_detected ON tokens(recommendation, detected_at DESC);
CREATE TABLE IF NOT EXISTS processed_events (
  signature TEXT PRIMARY KEY,
  processed_at INTEGER NOT NULL
);
