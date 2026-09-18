-- Bounded, privacy-preserving guard for the server-side 1122 access password.
-- client_key is a Worker-generated HMAC of the trusted Cloudflare client IP;
-- neither a raw IP address nor a password is stored in D1.
CREATE TABLE IF NOT EXISTS access_login_rate_limit_windows (
  client_key TEXT NOT NULL,
  bucket_start INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL CHECK (attempt_count >= 0),
  last_attempt_at INTEGER NOT NULL,
  PRIMARY KEY (client_key, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_access_login_rate_limit_windows_last_attempt
  ON access_login_rate_limit_windows(last_attempt_at);
