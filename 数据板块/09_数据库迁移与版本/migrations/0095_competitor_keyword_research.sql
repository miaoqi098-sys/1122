PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS competitor_keyword_taxonomy_versions (
  taxonomy_version TEXT PRIMARY KEY,
  normalizer_version TEXT NOT NULL,
  status TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS competitor_keyword_taxonomy_categories (
  taxonomy_version TEXT NOT NULL,
  category_code TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  name_cn TEXT NOT NULL,
  description TEXT NOT NULL,
  PRIMARY KEY(taxonomy_version, category_code),
  FOREIGN KEY(taxonomy_version) REFERENCES competitor_keyword_taxonomy_versions(taxonomy_version)
);

INSERT OR IGNORE INTO competitor_keyword_taxonomy_versions (
  taxonomy_version, normalizer_version, status, description, created_at
) VALUES (
  'KeywordTaxonomy.v1.0', 'KeywordNormalizer.v1.0', 'ACTIVE',
  '竞品关键词唯一主分类；长尾、核心层级、相关性与待复核为独立维度。', datetime('now')
);

INSERT OR IGNORE INTO competitor_keyword_taxonomy_categories
  (taxonomy_version, category_code, display_order, name_cn, description)
VALUES
  ('KeywordTaxonomy.v1.0', 'own_brand', 1, '自有品牌词', '用户明确提供的我方品牌及受控别名。'),
  ('KeywordTaxonomy.v1.0', 'competitor_alternative', 2, '竞品 / 替代词', '竞品品牌、ASIN、对比或替代表达。'),
  ('KeywordTaxonomy.v1.0', 'promotion_transaction', 3, '促销 / 交易词', '价格、优惠、购买和促销意图。'),
  ('KeywordTaxonomy.v1.0', 'occasion_seasonal', 4, '节日 / 季节 / 礼赠词', '节庆、季节、纪念日和礼赠意图。'),
  ('KeywordTaxonomy.v1.0', 'audience', 5, '人群词', '年龄、性别、职业、熟练度或使用者。'),
  ('KeywordTaxonomy.v1.0', 'scenario_use_case', 6, '场景 / 用途词', '使用地点、活动、环境或任务场景。'),
  ('KeywordTaxonomy.v1.0', 'problem_benefit', 7, '痛点 / 功能利益词', '待解决问题、期望结果和功能收益。'),
  ('KeywordTaxonomy.v1.0', 'feature_attribute', 8, '属性 / 材质 / 规格词', '材质、颜色、尺寸、数量、兼容性和客观规格。'),
  ('KeywordTaxonomy.v1.0', 'category_core', 9, '核心 / 类目词', '多竞品共同覆盖或标题上下文支持的产品核心词。'),
  ('KeywordTaxonomy.v1.0', 'related_general', 10, '相关泛词', '来自竞品流量范围但暂未命中更明确规则的探索词。');

-- One immutable, auditable request for a batch of competitor ASINs.
CREATE TABLE IF NOT EXISTS competitor_keyword_research_jobs (
  job_id TEXT PRIMARY KEY,
  job_name TEXT,
  marketplace TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  input_asins_json TEXT NOT NULL,
  own_brands_json TEXT NOT NULL DEFAULT '[]',
  input_asin_count INTEGER NOT NULL,
  period_start TEXT NOT NULL,
  granularity TEXT NOT NULL,
  requested_page_size INTEGER NOT NULL,
  maximum_pages_per_asin INTEGER NOT NULL,
  status TEXT NOT NULL,
  source_tool TEXT NOT NULL DEFAULT 'ops_get_asin_traffic_trend_detail',
  taxonomy_version TEXT NOT NULL,
  normalizer_version TEXT NOT NULL,
  raw_keyword_count INTEGER NOT NULL DEFAULT 0,
  unique_keyword_count INTEGER NOT NULL DEFAULT 0,
  duplicate_keyword_count INTEGER NOT NULL DEFAULT 0,
  classification_offset INTEGER NOT NULL DEFAULT 0,
  successful_asin_count INTEGER NOT NULL DEFAULT 0,
  failed_asin_count INTEGER NOT NULL DEFAULT 0,
  warning_json TEXT,
  error_stage TEXT,
  error_code TEXT,
  error_message TEXT,
  observed_at TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY(taxonomy_version) REFERENCES competitor_keyword_taxonomy_versions(taxonomy_version)
);
CREATE INDEX IF NOT EXISTS idx_competitor_keyword_jobs_created
  ON competitor_keyword_research_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_keyword_jobs_market_status
  ON competitor_keyword_research_jobs(marketplace, status, created_at DESC);

-- Per-ASIN execution ledger. A partial batch remains inspectable and retryable.
CREATE TABLE IF NOT EXISTS competitor_keyword_research_asins (
  job_id TEXT NOT NULL,
  asin TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT,
  brand TEXT,
  image_url TEXT,
  expected_keyword_count INTEGER,
  fetched_keyword_count INTEGER NOT NULL DEFAULT 0,
  fetched_page_count INTEGER NOT NULL DEFAULT 0,
  is_truncated INTEGER NOT NULL DEFAULT 0,
  data_notice TEXT,
  observed_at TEXT,
  error_code TEXT,
  error_message TEXT,
  PRIMARY KEY(job_id, asin),
  FOREIGN KEY(job_id) REFERENCES competitor_keyword_research_jobs(job_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_competitor_keyword_asins_asin_time
  ON competitor_keyword_research_asins(asin, observed_at DESC);

-- Cross-run canonical keyword library. Exact deduplication uses normalized_keyword;
-- token_signature is only a review hint and never silently merges word-order variants.
CREATE TABLE IF NOT EXISTS competitor_keywords (
  keyword_id TEXT PRIMARY KEY,
  marketplace TEXT NOT NULL,
  language TEXT NOT NULL,
  normalized_keyword TEXT NOT NULL,
  display_keyword TEXT NOT NULL,
  token_signature TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE(marketplace, language, normalized_keyword)
);
CREATE INDEX IF NOT EXISTS idx_competitor_keywords_signature
  ON competitor_keywords(marketplace, language, token_signature);

-- Deduplicated keyword snapshot for one research job. Classification is copied here
-- so later taxonomy revisions do not rewrite historical conclusions.
CREATE TABLE IF NOT EXISTS competitor_keyword_job_items (
  job_id TEXT NOT NULL,
  keyword_id TEXT NOT NULL,
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
  source_asin_count INTEGER NOT NULL,
  source_asins_json TEXT NOT NULL,
  search_volume REAL,
  best_aba_rank INTEGER,
  max_traffic_score REAL,
  max_traffic_share REAL,
  best_organic_rank REAL,
  best_sp_rank REAL,
  near_duplicate_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY(job_id, keyword_id),
  FOREIGN KEY(job_id) REFERENCES competitor_keyword_research_jobs(job_id) ON DELETE CASCADE,
  FOREIGN KEY(keyword_id) REFERENCES competitor_keywords(keyword_id),
  FOREIGN KEY(taxonomy_version) REFERENCES competitor_keyword_taxonomy_versions(taxonomy_version)
);
CREATE INDEX IF NOT EXISTS idx_competitor_job_items_category
  ON competitor_keyword_job_items(job_id, primary_category, search_volume DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_job_items_source_count
  ON competitor_keyword_job_items(job_id, source_asin_count DESC, search_volume DESC);

-- Many-to-many provenance: every retained keyword can be traced back to each ASIN
-- and its factual ABA position without exposing SIF credentials.
CREATE TABLE IF NOT EXISTS competitor_keyword_sources (
  job_id TEXT NOT NULL,
  keyword_id TEXT NOT NULL,
  asin TEXT NOT NULL,
  raw_keyword TEXT NOT NULL,
  translated_keyword TEXT,
  search_volume REAL,
  aba_rank INTEGER,
  traffic_score REAL,
  traffic_share REAL,
  organic_rank REAL,
  sp_rank REAL,
  source_tool TEXT NOT NULL DEFAULT 'ops_get_asin_traffic_trend_detail',
  source_observation_id TEXT,
  observed_at TEXT NOT NULL,
  PRIMARY KEY(job_id, keyword_id, asin),
  FOREIGN KEY(job_id) REFERENCES competitor_keyword_research_jobs(job_id) ON DELETE CASCADE,
  FOREIGN KEY(keyword_id) REFERENCES competitor_keywords(keyword_id)
);
CREATE INDEX IF NOT EXISTS idx_competitor_keyword_sources_asin
  ON competitor_keyword_sources(job_id, asin, search_volume DESC);

-- Reserved append-only audit ledger for a future human review workflow.
-- v1 does not expose override writes or merge overrides into read responses.
CREATE TABLE IF NOT EXISTS competitor_keyword_classification_overrides (
  override_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  keyword_id TEXT NOT NULL,
  primary_category TEXT NOT NULL,
  reason TEXT NOT NULL,
  reviewed_by TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(job_id) REFERENCES competitor_keyword_research_jobs(job_id) ON DELETE CASCADE,
  FOREIGN KEY(keyword_id) REFERENCES competitor_keywords(keyword_id)
);
CREATE INDEX IF NOT EXISTS idx_competitor_keyword_overrides_latest
  ON competitor_keyword_classification_overrides(job_id, keyword_id, created_at DESC);
