-- Manual keyword imports deliberately live beside, but do not impersonate,
-- SIF-derived ASIN research. Imported phrases have no invented ASIN or SIF
-- metric provenance; they remain scoped to the selected product group.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS competitor_keyword_import_batches (
  import_id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  language TEXT NOT NULL,
  import_name TEXT,
  own_brands_json TEXT NOT NULL DEFAULT '[]',
  input_keyword_count INTEGER NOT NULL,
  unique_keyword_count INTEGER NOT NULL DEFAULT 0,
  duplicate_keyword_count INTEGER NOT NULL DEFAULT 0,
  invalid_keyword_count INTEGER NOT NULL DEFAULT 0,
  classified_keyword_count INTEGER NOT NULL DEFAULT 0,
  review_keyword_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  taxonomy_version TEXT NOT NULL,
  normalizer_version TEXT NOT NULL,
  warning_json TEXT,
  error_stage TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY(group_id) REFERENCES competitor_keyword_groups(group_id),
  FOREIGN KEY(taxonomy_version) REFERENCES competitor_keyword_taxonomy_versions(taxonomy_version)
);

CREATE INDEX IF NOT EXISTS idx_competitor_keyword_imports_group_created
  ON competitor_keyword_import_batches(group_id, created_at DESC);

CREATE TABLE IF NOT EXISTS competitor_keyword_import_items (
  import_id TEXT NOT NULL,
  keyword_id TEXT NOT NULL,
  raw_keyword TEXT NOT NULL,
  primary_category TEXT NOT NULL,
  secondary_tags_json TEXT NOT NULL DEFAULT '[]',
  matched_facets_json TEXT NOT NULL DEFAULT '[]',
  matched_rule_ids_json TEXT NOT NULL DEFAULT '[]',
  classification_reason TEXT NOT NULL,
  classification_confidence REAL NOT NULL,
  taxonomy_version TEXT NOT NULL,
  normalizer_version TEXT NOT NULL,
  classifier_method TEXT NOT NULL DEFAULT 'deterministic_rules',
  query_shape TEXT NOT NULL,
  strategic_tier TEXT NOT NULL,
  relevance_status TEXT NOT NULL DEFAULT 'RELEVANT',
  needs_review INTEGER NOT NULL DEFAULT 0,
  token_signature TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(import_id, keyword_id),
  FOREIGN KEY(import_id) REFERENCES competitor_keyword_import_batches(import_id) ON DELETE CASCADE,
  FOREIGN KEY(keyword_id) REFERENCES competitor_keywords(keyword_id),
  FOREIGN KEY(taxonomy_version) REFERENCES competitor_keyword_taxonomy_versions(taxonomy_version)
);

CREATE INDEX IF NOT EXISTS idx_competitor_keyword_import_items_category
  ON competitor_keyword_import_items(import_id, primary_category);
