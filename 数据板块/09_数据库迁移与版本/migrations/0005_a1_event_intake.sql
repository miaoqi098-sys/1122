PRAGMA foreign_keys = ON;

-- A1 Event Intake V1. Events remain raw operating observations; S01 validation is tracked separately.
CREATE TABLE IF NOT EXISTS a1_event_intake_runs (
  intake_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  product_id TEXT,
  marketplace TEXT,
  source TEXT,
  canonical_event_json TEXT NOT NULL,
  s01_input_json TEXT NOT NULL,
  s01_output_json TEXT NOT NULL,
  s01_status TEXT NOT NULL,
  next_action TEXT NOT NULL,
  normalized_event_json TEXT,
  blocking_errors_json TEXT NOT NULL,
  warnings_json TEXT NOT NULL,
  duplicate_signal_json TEXT NOT NULL,
  intake_status TEXT NOT NULL,
  validator_version TEXT NOT NULL,
  received_at TEXT NOT NULL,
  validated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(event_id) REFERENCES events(event_id),
  FOREIGN KEY(product_id) REFERENCES products(product_id),
  UNIQUE(event_id, validator_version)
);
CREATE INDEX IF NOT EXISTS idx_a1_intake_status
  ON a1_event_intake_runs(intake_status, s01_status, validated_at);
CREATE INDEX IF NOT EXISTS idx_a1_intake_product
  ON a1_event_intake_runs(product_id, validated_at);

INSERT OR REPLACE INTO data_source_state (
  source_key, source_name, dataset, status, last_success_at,
  freshness_status, schema_version, parser_version, details_json, updated_at
) VALUES (
  'a1_event_intake',
  'A1 Event Intake',
  'canonical_event_s01_validation',
  'READY_PENDING_FIRST_EVENT',
  NULL,
  'PENDING_EVENT',
  'A1EventIntake.v1',
  'S01-runtime-v1.2.0',
  '{"pipeline":["RawEvent","CanonicalEvent","S01","NormalizedEvent"],"bypass_s01":false}',
  datetime('now')
);
