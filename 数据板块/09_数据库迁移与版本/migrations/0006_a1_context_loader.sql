PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS a1_context_runs (
  context_run_id TEXT PRIMARY KEY,
  intake_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  product_id TEXT,
  marketplace TEXT,
  question TEXT NOT NULL,
  context_request_json TEXT NOT NULL,
  planned_domains_json TEXT NOT NULL,
  context_package_json TEXT NOT NULL,
  loaded_items_json TEXT NOT NULL,
  missing_context_json TEXT NOT NULL,
  stale_context_json TEXT NOT NULL,
  excluded_context_json TEXT NOT NULL,
  context_refs_json TEXT NOT NULL,
  context_summary TEXT,
  s02_status TEXT NOT NULL,
  next_action TEXT NOT NULL,
  loader_version TEXT NOT NULL,
  loaded_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(intake_id) REFERENCES a1_event_intake_runs(intake_id),
  FOREIGN KEY(event_id) REFERENCES events(event_id),
  FOREIGN KEY(product_id) REFERENCES products(product_id)
);
CREATE INDEX IF NOT EXISTS idx_a1_context_event_time
  ON a1_context_runs(event_id, loaded_at);
CREATE INDEX IF NOT EXISTS idx_a1_context_intake_version
  ON a1_context_runs(intake_id, loader_version, loaded_at);
CREATE INDEX IF NOT EXISTS idx_a1_context_status
  ON a1_context_runs(s02_status, next_action, loaded_at);

INSERT OR REPLACE INTO data_source_state (
  source_key, source_name, dataset, status, last_success_at,
  freshness_status, schema_version, parser_version, details_json, updated_at
) VALUES (
  'a1_context_loader',
  'A1 S02 Context Loader',
  'minimum_sufficient_context',
  'READY_PENDING_FIRST_CONTEXT',
  NULL,
  'PENDING_EVENT',
  'A1ContextRun.v1',
  'S02-runtime-v1.2.0',
  '{"pipeline":["S01NormalizedEvent","ContextPlanner","D1Retriever","FreshnessCheck","ContextPackage"],"context_package_is_unique_fact_source":true}',
  datetime('now')
);
