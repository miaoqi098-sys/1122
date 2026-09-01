PRAGMA foreign_keys = ON;

-- Derived Layer V1: enrich the canonical daily product state with Sif market visibility facts.
ALTER TABLE product_daily_state ADD COLUMN market_total_score REAL;
ALTER TABLE product_daily_state ADD COLUMN market_natural_score REAL;
ALTER TABLE product_daily_state ADD COLUMN market_ad_score REAL;
ALTER TABLE product_daily_state ADD COLUMN bsr INTEGER;
ALTER TABLE product_daily_state ADD COLUMN data_quality_status TEXT;

-- Long-form metric ledger. One row = one product/date/metric after deterministic calculation.
CREATE TABLE IF NOT EXISTS product_daily_metrics (
  metric_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  business_date TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  metric_value REAL,
  prior_value REAL,
  baseline_7d REAL,
  delta_abs REAL,
  delta_pct REAL,
  direction TEXT,
  signal TEXT,
  source TEXT,
  computed_at TEXT NOT NULL,
  engine_version TEXT NOT NULL DEFAULT 'derived-v1',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(product_id) REFERENCES products(product_id),
  UNIQUE(product_id, business_date, metric_key)
);
CREATE INDEX IF NOT EXISTS idx_product_metrics_product_date
  ON product_daily_metrics(product_id, business_date, metric_key);
CREATE INDEX IF NOT EXISTS idx_product_metrics_signal
  ON product_daily_metrics(signal, business_date, metric_key);

-- Events are append-oriented but each deterministic rule/date/subject must be idempotent.
ALTER TABLE events ADD COLUMN dedup_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedup_key
  ON events(dedup_key) WHERE dedup_key IS NOT NULL;

INSERT OR REPLACE INTO data_source_state (
  source_key, source_name, dataset, status, last_success_at,
  freshness_status, schema_version, parser_version, details_json, updated_at
) VALUES (
  'derived_layer_v1',
  '1122 Derived Layer',
  'product_daily_state_metrics_events',
  'READY_PENDING_FIRST_BUILD',
  NULL,
  'PENDING_BUILD',
  'DerivedLayer.v1',
  'derived-v1',
  '{"pipeline":["ProductDailyState","Metric","Event"],"event_rules":"deterministic-v1"}',
  datetime('now')
);
