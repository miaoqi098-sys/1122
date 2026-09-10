-- The first writable Amazon Ads capability is deliberately narrow: a human
-- confirmed state change for one Sponsored Products campaign.  No Amazon
-- identifiers or request bodies are persisted in this audit table; hashes are
-- enough to prove idempotency and trace an operation without duplicating
-- sensitive account metadata.
CREATE TABLE IF NOT EXISTS amazon_ads_write_intents (
  intent_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  credential_key TEXT NOT NULL,
  region TEXT NOT NULL,
  profile_hash TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_hash TEXT NOT NULL,
  action_type TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  requested_state TEXT NOT NULL,
  status TEXT NOT NULL,
  amazon_request_id TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_amazon_ads_write_intents_recent
  ON amazon_ads_write_intents(credential_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_amazon_ads_write_intents_target
  ON amazon_ads_write_intents(profile_hash, target_hash, created_at DESC);
