PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS a1_decision_item_builder_runs (
  builder_run_id TEXT PRIMARY KEY,
  conflict_run_id TEXT NOT NULL,
  context_run_id TEXT NOT NULL,
  intake_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  product_id TEXT,
  marketplace TEXT,
  builder_input_json TEXT NOT NULL,
  decision_items_json TEXT NOT NULL,
  merged_source_groups_json TEXT NOT NULL,
  builder_notes_json TEXT NOT NULL,
  builder_output_json TEXT NOT NULL,
  next_action TEXT NOT NULL,
  runtime_version TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(conflict_run_id) REFERENCES a1_conflict_runs(conflict_run_id),
  FOREIGN KEY(context_run_id) REFERENCES a1_context_runs(context_run_id),
  FOREIGN KEY(intake_id) REFERENCES a1_event_intake_runs(intake_id),
  FOREIGN KEY(event_id) REFERENCES events(event_id),
  FOREIGN KEY(product_id) REFERENCES products(product_id),
  UNIQUE(conflict_run_id, runtime_version)
);

CREATE TABLE IF NOT EXISTS a1_decision_items (
  decision_item_id TEXT PRIMARY KEY,
  builder_run_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  product_id TEXT,
  marketplace TEXT,
  item_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  problem_definition TEXT NOT NULL,
  objective TEXT NOT NULL,
  goal_layer TEXT NOT NULL,
  severity TEXT,
  urgency TEXT,
  decision_item_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(builder_run_id) REFERENCES a1_decision_item_builder_runs(builder_run_id),
  FOREIGN KEY(event_id) REFERENCES events(event_id),
  FOREIGN KEY(product_id) REFERENCES products(product_id)
);

CREATE INDEX IF NOT EXISTS idx_a1_builder_event_time
  ON a1_decision_item_builder_runs(event_id, generated_at);
CREATE INDEX IF NOT EXISTS idx_a1_builder_conflict_version
  ON a1_decision_item_builder_runs(conflict_run_id, runtime_version);
CREATE INDEX IF NOT EXISTS idx_a1_builder_next_action
  ON a1_decision_item_builder_runs(next_action, generated_at);
CREATE INDEX IF NOT EXISTS idx_a1_decision_items_event
  ON a1_decision_items(event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_a1_decision_items_product
  ON a1_decision_items(product_id, created_at);

INSERT OR REPLACE INTO data_source_state (
  source_key, source_name, dataset, status, last_success_at,
  freshness_status, schema_version, parser_version, details_json, updated_at
) VALUES (
  'a1_decision_item_builder',
  'A1 DecisionItem Builder',
  'decision_items',
  'READY_PENDING_FIRST_CONFLICT',
  NULL,
  'PENDING_CONFLICT',
  'DecisionItemBuilderRun.v1',
  'DecisionItemBuilder-runtime-v1.0.0',
  '{"pipeline":["S03ConflictResult","DecisionItemBuilder","CanonicalDecisionItem","A1DecisionItemLedger"],"context_package_is_unique_fact_source":true,"builder_does_not_rank":true,"normal_next_action":"continue_to_S04"}',
  datetime('now')
);
