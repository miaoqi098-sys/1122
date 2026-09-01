PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS a1_conflict_runs (
  conflict_run_id TEXT PRIMARY KEY,
  context_run_id TEXT NOT NULL,
  intake_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  product_id TEXT,
  marketplace TEXT,
  s02_status TEXT NOT NULL,
  s03_input_json TEXT NOT NULL,
  normalized_elements_json TEXT NOT NULL,
  conflicts_json TEXT NOT NULL,
  conflict_groups_json TEXT NOT NULL,
  unresolved_points_json TEXT NOT NULL,
  s03_output_json TEXT NOT NULL,
  s03_status TEXT NOT NULL,
  next_action TEXT NOT NULL,
  runtime_version TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(context_run_id) REFERENCES a1_context_runs(context_run_id),
  FOREIGN KEY(intake_id) REFERENCES a1_event_intake_runs(intake_id),
  FOREIGN KEY(event_id) REFERENCES events(event_id),
  FOREIGN KEY(product_id) REFERENCES products(product_id),
  UNIQUE(context_run_id, runtime_version)
);

CREATE INDEX IF NOT EXISTS idx_a1_conflict_event_time
  ON a1_conflict_runs(event_id, generated_at);
CREATE INDEX IF NOT EXISTS idx_a1_conflict_context_version
  ON a1_conflict_runs(context_run_id, runtime_version);
CREATE INDEX IF NOT EXISTS idx_a1_conflict_status
  ON a1_conflict_runs(s03_status, next_action, generated_at);

INSERT OR REPLACE INTO data_source_state (
  source_key, source_name, dataset, status, last_success_at,
  freshness_status, schema_version, parser_version, details_json, updated_at
) VALUES (
  'a1_conflict_detector',
  'A1 S03 Conflict Detector',
  'conflict_detection',
  'READY_PENDING_FIRST_CONTEXT',
  NULL,
  'PENDING_CONTEXT',
  'A1ConflictRun.v1',
  'S03-runtime-v1.2.0',
  '{"pipeline":["S02ContextPackage","ConflictElementNormalizer","ConflictDetection","ConflictClusterer","EvidenceResolver","A1ConflictLedger"],"context_package_is_unique_fact_source":true,"direct_to_s04":false}',
  datetime('now')
);
