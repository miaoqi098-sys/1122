-- 1122 Amazon Policy Boundary persistence contract.
-- SOURCE ONLY until separately applied/verified against D1 1122-core.
-- Append-only evidence/result storage; no production Amazon/Ads authority.

CREATE TABLE IF NOT EXISTS amazon_policy_evidence (
  evidence_id TEXT PRIMARY KEY,
  domain_no TEXT NOT NULL,
  domain TEXT NOT NULL,
  subdomain TEXT,
  marketplace TEXT NOT NULL,
  source_class TEXT NOT NULL,
  source_title TEXT,
  source_url TEXT NOT NULL,
  published_at TEXT,
  effective_at TEXT,
  retrieved_at TEXT NOT NULL,
  last_verified_at TEXT,
  policy_state TEXT NOT NULL,
  expected_state_json TEXT,
  policy_summary TEXT,
  provenance_json TEXT NOT NULL,
  confidence TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (domain_no GLOB '0[1-9]' OR domain_no GLOB '1[0-8]'),
  CHECK (confidence IN ('HIGH','MEDIUM','LOW','UNVERIFIED')),
  CHECK (policy_state IN ('ACTIVE','UPCOMING','SUPERSEDED','UNKNOWN','CONFLICTING_EVIDENCE'))
);

CREATE TABLE IF NOT EXISTS amazon_observed_state_evidence (
  observation_id TEXT PRIMARY KEY,
  domain_no TEXT NOT NULL,
  domain TEXT NOT NULL,
  subdomain TEXT,
  marketplace TEXT NOT NULL,
  product_ref TEXT,
  asin TEXT,
  observed_at TEXT NOT NULL,
  source_class TEXT NOT NULL,
  evidence_ref TEXT NOT NULL,
  observed_state_json TEXT NOT NULL,
  freshness TEXT NOT NULL,
  repeat_group_id TEXT,
  read_only INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (read_only = 1),
  CHECK (freshness IN ('FRESH','LAGGED','STALE','UNKNOWN'))
);

CREATE TABLE IF NOT EXISTS amazon_boundary_result_case (
  case_id TEXT PRIMARY KEY,
  domain_no TEXT NOT NULL,
  domain TEXT NOT NULL,
  subdomain TEXT,
  marketplace TEXT NOT NULL,
  result_type TEXT NOT NULL,
  status TEXT NOT NULL,
  title_cn TEXT,
  title_en TEXT,
  expected_state_json TEXT,
  observed_state_json TEXT,
  difference_summary TEXT,
  confidence TEXT NOT NULL,
  persistence_status TEXT,
  alternative_explanation_status TEXT,
  policy_allowed TEXT,
  technically_possible TEXT,
  not_currently_punished TEXT,
  long_term_sustainable TEXT,
  first_observed_at TEXT,
  last_verified_at TEXT,
  affected_product_refs_json TEXT NOT NULL DEFAULT '[]',
  policy_evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  observed_evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  agent12_event_ref TEXT,
  sandbox_run_ref TEXT,
  execution_authorized INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (execution_authorized = 0),
  CHECK (result_type IN ('POLICY_EVIDENCE','POLICY_DIFF','BOUNDARY_SIGNAL','BOUNDARY_CANDIDATE','CONFIRMED_BOUNDARY_RESULT','PRODUCT_IMPACT')),
  CHECK (confidence IN ('HIGH','MEDIUM','LOW','UNVERIFIED'))
);

CREATE INDEX IF NOT EXISTS idx_policy_evidence_domain_marketplace ON amazon_policy_evidence(domain_no, marketplace, retrieved_at);
CREATE INDEX IF NOT EXISTS idx_observed_state_domain_marketplace ON amazon_observed_state_evidence(domain_no, marketplace, observed_at);
CREATE INDEX IF NOT EXISTS idx_boundary_result_domain_type ON amazon_boundary_result_case(domain_no, result_type, updated_at);
CREATE INDEX IF NOT EXISTS idx_boundary_result_status ON amazon_boundary_result_case(status, updated_at);
