CREATE TABLE IF NOT EXISTS amazon_ads_profile_pins (
  credential_key TEXT NOT NULL,
  region TEXT NOT NULL,
  profile_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (credential_key, region, profile_hash)
);

CREATE INDEX IF NOT EXISTS idx_amazon_ads_profile_pins_last_seen
  ON amazon_ads_profile_pins(last_seen_at);
