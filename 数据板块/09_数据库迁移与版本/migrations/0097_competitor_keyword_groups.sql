-- Product/category isolation for competitor keyword research.
-- A group is a user-managed business context (for example, "毛绒玩具" or
-- "厨房用品"), not a replacement for the ten keyword taxonomy categories.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS competitor_keyword_groups (
  group_id TEXT PRIMARY KEY,
  marketplace TEXT NOT NULL,
  language TEXT NOT NULL,
  group_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  UNIQUE (marketplace, language, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_competitor_keyword_groups_active
  ON competitor_keyword_groups(marketplace, language, status, updated_at DESC);

-- Existing historical runs deliberately remain nullable/unassigned. Every new
-- run is validated by the Worker to have exactly one ACTIVE group.
ALTER TABLE competitor_keyword_research_jobs ADD COLUMN group_id TEXT;
CREATE INDEX IF NOT EXISTS idx_competitor_keyword_jobs_group_created
  ON competitor_keyword_research_jobs(group_id, created_at DESC);

-- Group-level ASIN history enables safe context reuse without making an ASIN
-- globally exclusive: the same competitor can legitimately be researched in
-- separate product lines.
CREATE TABLE IF NOT EXISTS competitor_keyword_group_asins (
  group_id TEXT NOT NULL,
  asin TEXT NOT NULL,
  first_job_id TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (group_id, asin),
  FOREIGN KEY (group_id) REFERENCES competitor_keyword_groups(group_id),
  FOREIGN KEY (first_job_id) REFERENCES competitor_keyword_research_jobs(job_id)
);

CREATE INDEX IF NOT EXISTS idx_competitor_keyword_group_asins_recent
  ON competitor_keyword_group_asins(group_id, last_seen_at DESC);

-- Supports exact-keyword aggregation within a selected group without changing
-- the global canonical competitor_keywords table.
CREATE INDEX IF NOT EXISTS idx_competitor_keyword_job_items_keyword
  ON competitor_keyword_job_items(keyword_id, job_id);
