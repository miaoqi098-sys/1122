PRAGMA foreign_keys = ON;

-- Generic immutable observation ledger for external intelligence providers.
CREATE TABLE IF NOT EXISTS external_tool_observations (
  observation_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  dataset TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  product_id TEXT,
  marketplace TEXT,
  observed_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  schema_version TEXT NOT NULL DEFAULT 'ExternalToolObservation.v1',
  parser_version TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(product_id) REFERENCES products(product_id)
);
CREATE INDEX IF NOT EXISTS idx_external_obs_subject_time
  ON external_tool_observations(provider, dataset, subject_type, subject_key, observed_at);
CREATE INDEX IF NOT EXISTS idx_external_obs_product_time
  ON external_tool_observations(product_id, observed_at);

-- Sif product/profile snapshots used by A3 competitor intelligence and product context.
CREATE TABLE IF NOT EXISTS sif_asin_profile_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  product_id TEXT,
  marketplace TEXT NOT NULL,
  asin TEXT NOT NULL,
  title TEXT,
  brand TEXT,
  price REAL,
  star_rating REAL,
  rating_num INTEGER,
  bought_in_past_month INTEGER,
  first_available_day TEXT,
  variation_num INTEGER,
  weight_oz REAL,
  package_weight_oz REAL,
  dimensions_json TEXT,
  package_dimensions_json TEXT,
  bsr_json TEXT,
  item_highlights_json TEXT,
  observed_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'sif',
  parser_version TEXT NOT NULL DEFAULT 'sif-v1',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(product_id) REFERENCES products(product_id)
);
CREATE INDEX IF NOT EXISTS idx_sif_profile_asin_time
  ON sif_asin_profile_snapshots(marketplace, asin, observed_at);

-- Sif daily traffic history. This complements Amazon Business Reports with market/visibility signals.
CREATE TABLE IF NOT EXISTS sif_asin_traffic_daily (
  traffic_id TEXT PRIMARY KEY,
  product_id TEXT,
  marketplace TEXT NOT NULL,
  asin TEXT NOT NULL,
  business_date TEXT NOT NULL,
  total_score REAL,
  natural_score REAL,
  ad_score REAL,
  sp_score REAL,
  rec_sp_score REAL,
  sb_score REAL,
  sbv_score REAL,
  deal_price REAL,
  buybox_price REAL,
  prime_price REAL,
  limited_deal_price REAL,
  bsr INTEGER,
  star_rating REAL,
  review_count INTEGER,
  bought_in_past_month INTEGER,
  observed_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'sif',
  parser_version TEXT NOT NULL DEFAULT 'sif-v1',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(product_id) REFERENCES products(product_id),
  UNIQUE(marketplace, asin, business_date, observed_at)
);
CREATE INDEX IF NOT EXISTS idx_sif_traffic_asin_date
  ON sif_asin_traffic_daily(marketplace, asin, business_date);
CREATE INDEX IF NOT EXISTS idx_sif_traffic_product_date
  ON sif_asin_traffic_daily(product_id, business_date);

-- Keyword-level ASIN signals: contribution, organic/paid dependency, ranks and market demand.
CREATE TABLE IF NOT EXISTS sif_asin_keyword_signals (
  signal_id TEXT PRIMARY KEY,
  product_id TEXT,
  marketplace TEXT NOT NULL,
  asin TEXT NOT NULL,
  keyword TEXT NOT NULL,
  keyword_health TEXT,
  rank_evolution TEXT,
  traffic_share REAL,
  contribution_change REAL,
  contribution_severity TEXT,
  natural_ratio REAL,
  traffic_dependency TEXT,
  search_volume REAL,
  aba_rank INTEGER,
  cpc_median REAL,
  top3_click_share REAL,
  top3_conversion_share REAL,
  organic_rank REAL,
  sp_rank REAL,
  sb_rank REAL,
  sbv_rank REAL,
  channel_coverage_json TEXT,
  observed_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'sif',
  parser_version TEXT NOT NULL DEFAULT 'sif-v1',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(product_id) REFERENCES products(product_id)
);
CREATE INDEX IF NOT EXISTS idx_sif_keyword_asin_time
  ON sif_asin_keyword_signals(marketplace, asin, keyword, observed_at);
CREATE INDEX IF NOT EXISTS idx_sif_keyword_product_time
  ON sif_asin_keyword_signals(product_id, observed_at);

-- Historical ad-structure intelligence. This is Sif market intelligence, not Amazon Ads account data.
CREATE TABLE IF NOT EXISTS sif_asin_ad_structure_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  product_id TEXT,
  marketplace TEXT NOT NULL,
  asin TEXT NOT NULL,
  total_campaign_count INTEGER,
  ad_types_json TEXT,
  structure_scope TEXT,
  observed_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'sif',
  parser_version TEXT NOT NULL DEFAULT 'sif-v1',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(product_id) REFERENCES products(product_id)
);
CREATE INDEX IF NOT EXISTS idx_sif_ad_structure_asin_time
  ON sif_asin_ad_structure_snapshots(marketplace, asin, observed_at);

-- Keyword-market facts for later market history, demand, competition and opportunity ingestion.
CREATE TABLE IF NOT EXISTS sif_keyword_market_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  marketplace TEXT NOT NULL,
  keyword TEXT NOT NULL,
  dataset TEXT NOT NULL,
  metric_date TEXT,
  search_volume REAL,
  aba_rank INTEGER,
  top3_click_share REAL,
  top3_conversion_share REAL,
  cvr REAL,
  cpc REAL,
  lifecycle TEXT,
  competition_position TEXT,
  payload_json TEXT,
  observed_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'sif',
  parser_version TEXT NOT NULL DEFAULT 'sif-v1',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sif_keyword_market_time
  ON sif_keyword_market_snapshots(marketplace, keyword, dataset, observed_at);

INSERT OR REPLACE INTO data_source_state (
  source_key, source_name, dataset, status, freshness_status, schema_version, parser_version, details_json, updated_at
) VALUES (
  'sif_mcp',
  'Sif MCP',
  'market_intelligence',
  'CONNECTED_PENDING_INGESTION',
  'UNKNOWN',
  'SifIntelligence.v1',
  'sif-v1',
  '{"transport":"MCP","tool_catalog_discovered":true,"tool_count":34}',
  datetime('now')
);
