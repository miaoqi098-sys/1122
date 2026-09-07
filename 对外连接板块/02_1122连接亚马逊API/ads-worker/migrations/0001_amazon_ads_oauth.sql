CREATE TABLE IF NOT EXISTS amazon_ads_oauth_states (
  state_hash TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS amazon_ads_credentials (
  credential_key TEXT PRIMARY KEY,
  encrypted_refresh_token TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_token_refresh_at TEXT
);
