ALTER TABLE competitor_keyword_research_asins
  ADD COLUMN next_page_num INTEGER NOT NULL DEFAULT 1;

ALTER TABLE competitor_keyword_research_asins
  ADD COLUMN processing_page_num INTEGER;

ALTER TABLE competitor_keyword_research_asins
  ADD COLUMN processing_started_at TEXT;

ALTER TABLE competitor_keyword_research_asins
  ADD COLUMN processing_token TEXT;

CREATE INDEX IF NOT EXISTS idx_competitor_keyword_asins_fetch_claim
  ON competitor_keyword_research_asins(job_id, asin, status, next_page_num, processing_started_at);
