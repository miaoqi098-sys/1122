PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  product_id TEXT PRIMARY KEY,
  marketplace TEXT NOT NULL,
  marketplace_id TEXT,
  seller_id TEXT,
  parent_asin TEXT,
  asin TEXT,
  sku TEXT,
  fnsku TEXT,
  title TEXT,
  brand TEXT,
  product_type TEXT,
  main_image TEXT,
  listing_status_json TEXT,
  listing_price REAL,
  regular_price REAL,
  currency TEXT,
  fulfillment_channel TEXT,
  source TEXT,
  source_observed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_marketplace_sku ON products(marketplace, sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_asin ON products(marketplace, asin);

CREATE TABLE IF NOT EXISTS product_operating_plans (
  plan_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  stage TEXT NOT NULL,
  stage_started_at TEXT,
  stage_reason TEXT,
  primary_goal TEXT,
  strategy TEXT,
  constraints_json TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(product_id) REFERENCES products(product_id)
);
CREATE INDEX IF NOT EXISTS idx_plans_product ON product_operating_plans(product_id, status, updated_at);

CREATE TABLE IF NOT EXISTS product_plan_goals (
  goal_id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  baseline_value REAL,
  target_value REAL,
  target_text TEXT,
  unit TEXT,
  comparator TEXT,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(plan_id) REFERENCES product_operating_plans(plan_id)
);
CREATE INDEX IF NOT EXISTS idx_goals_plan ON product_plan_goals(plan_id, status);

CREATE TABLE IF NOT EXISTS product_plan_actions (
  action_id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  action_text TEXT NOT NULL,
  priority TEXT,
  owner TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  progress REAL NOT NULL DEFAULT 0,
  start_at TEXT,
  due_at TEXT,
  validation_criteria TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(plan_id) REFERENCES product_operating_plans(plan_id)
);
CREATE INDEX IF NOT EXISTS idx_actions_plan ON product_plan_actions(plan_id, status, priority);

CREATE TABLE IF NOT EXISTS product_stage_history (
  stage_event_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  plan_id TEXT,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  reason TEXT,
  changed_by TEXT,
  effective_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(product_id) REFERENCES products(product_id)
);
CREATE INDEX IF NOT EXISTS idx_stage_history_product ON product_stage_history(product_id, effective_at);

CREATE TABLE IF NOT EXISTS inventory_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  total_quantity INTEGER,
  fulfillable_quantity INTEGER,
  inbound_working_quantity INTEGER,
  inbound_shipped_quantity INTEGER,
  inbound_receiving_quantity INTEGER,
  inbound_total_quantity INTEGER,
  reserved_quantity INTEGER,
  unfulfillable_quantity INTEGER,
  researching_quantity INTEGER,
  inventory_state TEXT,
  source TEXT,
  parser_version TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(product_id) REFERENCES products(product_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_product_time ON inventory_snapshots(product_id, observed_at);

CREATE TABLE IF NOT EXISTS sales_period_snapshots (
  sales_snapshot_id TEXT PRIMARY KEY,
  marketplace TEXT NOT NULL,
  product_id TEXT,
  period_key TEXT NOT NULL,
  interval_start TEXT NOT NULL,
  interval_end TEXT NOT NULL,
  total_sales REAL,
  currency TEXT,
  order_count INTEGER,
  order_item_count INTEGER,
  unit_count INTEGER,
  average_unit_price REAL,
  observed_at TEXT NOT NULL,
  source TEXT,
  parser_version TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(product_id) REFERENCES products(product_id)
);
CREATE INDEX IF NOT EXISTS idx_sales_period_scope ON sales_period_snapshots(marketplace, product_id, period_key, observed_at);

CREATE TABLE IF NOT EXISTS traffic_daily (
  traffic_daily_id TEXT PRIMARY KEY,
  marketplace TEXT NOT NULL,
  product_id TEXT,
  business_date TEXT NOT NULL,
  sessions INTEGER,
  page_views INTEGER,
  browser_sessions INTEGER,
  mobile_app_sessions INTEGER,
  buy_box_percentage REAL,
  order_item_session_percentage REAL,
  unit_session_percentage REAL,
  units_ordered INTEGER,
  order_items INTEGER,
  ordered_product_sales REAL,
  currency TEXT,
  units_refunded INTEGER,
  refund_rate REAL,
  observed_at TEXT NOT NULL,
  source TEXT,
  parser_version TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(product_id) REFERENCES products(product_id)
);
CREATE INDEX IF NOT EXISTS idx_traffic_daily_scope ON traffic_daily(marketplace, product_id, business_date);

CREATE TABLE IF NOT EXISTS finance_period_snapshots (
  finance_snapshot_id TEXT PRIMARY KEY,
  marketplace TEXT NOT NULL,
  posted_after TEXT NOT NULL,
  posted_before TEXT NOT NULL,
  currency TEXT,
  transaction_count INTEGER,
  net_amount REAL,
  transaction_types_json TEXT,
  observed_at TEXT NOT NULL,
  source TEXT,
  semantic_status TEXT NOT NULL DEFAULT 'PENDING_VALIDATION',
  parser_version TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_finance_period_time ON finance_period_snapshots(marketplace, posted_after, posted_before, observed_at);

CREATE TABLE IF NOT EXISTS product_daily_state (
  product_daily_state_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  business_date TEXT NOT NULL,
  stage TEXT,
  price REAL,
  sales REAL,
  units INTEGER,
  orders_count INTEGER,
  sessions INTEGER,
  page_views INTEGER,
  conversion_rate REAL,
  ad_spend REAL,
  ad_sales REAL,
  acos REAL,
  tacos REAL,
  fulfillable_inventory INTEGER,
  inbound_inventory INTEGER,
  coverage_days REAL,
  rating REAL,
  review_count INTEGER,
  contribution_profit REAL,
  profit_margin REAL,
  primary_goal TEXT,
  strategy_version INTEGER,
  completeness_json TEXT,
  observed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(product_id) REFERENCES products(product_id),
  UNIQUE(product_id, business_date)
);
CREATE INDEX IF NOT EXISTS idx_product_daily_time ON product_daily_state(product_id, business_date);

CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  product_id TEXT,
  marketplace TEXT,
  event_type TEXT NOT NULL,
  severity TEXT,
  source TEXT,
  event_status TEXT,
  processing_disposition TEXT,
  evidence_json TEXT,
  payload_json TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(product_id) REFERENCES products(product_id)
);
CREATE INDEX IF NOT EXISTS idx_events_product_time ON events(product_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(event_status, severity, occurred_at);

CREATE TABLE IF NOT EXISTS decisions (
  decision_id TEXT PRIMARY KEY,
  product_id TEXT,
  marketplace TEXT,
  decision_type TEXT,
  priority TEXT,
  decision_status TEXT,
  final_decision TEXT NOT NULL,
  reason TEXT,
  evidence_json TEXT,
  constraints_json TEXT,
  decided_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(product_id) REFERENCES products(product_id)
);
CREATE INDEX IF NOT EXISTS idx_decisions_product_time ON decisions(product_id, decided_at);

CREATE TABLE IF NOT EXISTS tasks (
  task_id TEXT PRIMARY KEY,
  decision_id TEXT,
  product_id TEXT,
  marketplace TEXT,
  task_type TEXT,
  task_status TEXT NOT NULL,
  approval_status TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(decision_id) REFERENCES decisions(decision_id),
  FOREIGN KEY(product_id) REFERENCES products(product_id)
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(task_status, approval_status, updated_at);

CREATE TABLE IF NOT EXISTS validation_results (
  validation_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  product_id TEXT,
  result_status TEXT NOT NULL,
  expected_json TEXT,
  observed_json TEXT,
  evidence_json TEXT,
  validated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(task_id) REFERENCES tasks(task_id),
  FOREIGN KEY(product_id) REFERENCES products(product_id)
);
CREATE INDEX IF NOT EXISTS idx_validation_task ON validation_results(task_id, validated_at);

CREATE TABLE IF NOT EXISTS raw_archive_manifest (
  archive_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  dataset TEXT NOT NULL,
  marketplace TEXT,
  product_id TEXT,
  r2_object_key TEXT NOT NULL UNIQUE,
  content_type TEXT,
  compression TEXT,
  object_size_bytes INTEGER,
  sha256 TEXT,
  schema_version TEXT,
  parser_version TEXT,
  source_observed_at TEXT,
  archived_at TEXT NOT NULL,
  ingestion_status TEXT NOT NULL DEFAULT 'ARCHIVED',
  metadata_json TEXT,
  FOREIGN KEY(product_id) REFERENCES products(product_id)
);
CREATE INDEX IF NOT EXISTS idx_archive_dataset_time ON raw_archive_manifest(dataset, archived_at);

CREATE TABLE IF NOT EXISTS data_source_state (
  source_key TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  dataset TEXT,
  status TEXT NOT NULL,
  last_success_at TEXT,
  last_attempt_at TEXT,
  freshness_status TEXT,
  schema_version TEXT,
  parser_version TEXT,
  details_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS data_layer_audit (
  audit_id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  object_type TEXT,
  object_id TEXT,
  actor TEXT,
  summary TEXT,
  metadata_json TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_data_audit_time ON data_layer_audit(occurred_at, action_type);
