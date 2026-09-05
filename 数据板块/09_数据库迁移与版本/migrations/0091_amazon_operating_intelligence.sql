-- 1122 Amazon operating intelligence persistence V1.
-- Persists APR/AOM current source records and seeds current APB source-only cases.
-- No Amazon/Ads execution authority is granted by these tables.

CREATE TABLE IF NOT EXISTS amazon_adversarial_pattern_ref (
  apr_id TEXT NOT NULL,
  record_version INTEGER NOT NULL DEFAULT 1,
  is_current INTEGER NOT NULL DEFAULT 1,
  domain_no TEXT NOT NULL,
  domain TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  pattern_name_cn TEXT NOT NULL,
  business_goal TEXT NOT NULL,
  observation_status TEXT NOT NULL,
  policy_relation TEXT NOT NULL,
  business_value_signal TEXT NOT NULL,
  confidence TEXT NOT NULL,
  observed_structure TEXT,
  observed_effect TEXT,
  observed_duration_json TEXT NOT NULL DEFAULT '{}',
  detection_signals_json TEXT NOT NULL DEFAULT '[]',
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  exploration_scope TEXT NOT NULL DEFAULT 'BROAD_DISCOVERY',
  ui_visibility INTEGER NOT NULL DEFAULT 1,
  operationalization_mode TEXT NOT NULL DEFAULT 'NON_EXECUTABLE_REFERENCE',
  execution_authorized INTEGER NOT NULL DEFAULT 0,
  production_write_authorized INTEGER NOT NULL DEFAULT 0,
  source_payload_json TEXT NOT NULL,
  source_version TEXT NOT NULL,
  effective_from TEXT NOT NULL DEFAULT (datetime('now')),
  superseded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (apr_id, record_version),
  CHECK (is_current IN (0,1)),
  CHECK (ui_visibility IN (0,1)),
  CHECK (execution_authorized = 0),
  CHECK (production_write_authorized = 0),
  CHECK (operationalization_mode = 'NON_EXECUTABLE_REFERENCE')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_apr_one_current_version
  ON amazon_adversarial_pattern_ref(apr_id)
  WHERE is_current = 1;
CREATE INDEX IF NOT EXISTS idx_apr_domain_marketplace
  ON amazon_adversarial_pattern_ref(domain_no, marketplace, is_current, created_at);
CREATE INDEX IF NOT EXISTS idx_apr_policy_value
  ON amazon_adversarial_pattern_ref(policy_relation, business_value_signal, is_current);

CREATE TABLE IF NOT EXISTS amazon_operating_method (
  method_id TEXT NOT NULL,
  record_version INTEGER NOT NULL DEFAULT 1,
  is_current INTEGER NOT NULL DEFAULT 1,
  domain_no TEXT NOT NULL,
  domain TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  method_name_cn TEXT NOT NULL,
  method_name_en TEXT,
  objective TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  execution_mode TEXT NOT NULL,
  applicable_conditions_json TEXT NOT NULL DEFAULT '[]',
  not_applicable_conditions_json TEXT NOT NULL DEFAULT '[]',
  steps_json TEXT NOT NULL DEFAULT '[]',
  cost_model_json TEXT NOT NULL DEFAULT '{}',
  expected_impact_json TEXT NOT NULL DEFAULT '{}',
  measurement_json TEXT NOT NULL DEFAULT '[]',
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  source_urls_json TEXT NOT NULL DEFAULT '[]',
  affected_product_refs_json TEXT NOT NULL DEFAULT '[]',
  last_verified_at TEXT,
  execution_authorized INTEGER NOT NULL DEFAULT 0,
  source_payload_json TEXT NOT NULL,
  source_version TEXT NOT NULL,
  effective_from TEXT NOT NULL DEFAULT (datetime('now')),
  superseded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (method_id, record_version),
  CHECK (is_current IN (0,1)),
  CHECK (execution_authorized = 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aom_one_current_version
  ON amazon_operating_method(method_id)
  WHERE is_current = 1;
CREATE INDEX IF NOT EXISTS idx_aom_domain_marketplace
  ON amazon_operating_method(domain_no, marketplace, is_current, created_at);
CREATE INDEX IF NOT EXISTS idx_aom_objective_policy
  ON amazon_operating_method(policy_status, risk_level, is_current);

INSERT OR IGNORE INTO amazon_adversarial_pattern_ref (
  apr_id, record_version, is_current, domain_no, domain, marketplace,
  pattern_name_cn, business_goal, observation_status, policy_relation,
  business_value_signal, confidence, observed_structure, observed_effect,
  observed_duration_json, detection_signals_json, evidence_refs_json,
  source_refs_json, exploration_scope, ui_visibility, operationalization_mode,
  execution_authorized, production_write_authorized, source_payload_json, source_version
) VALUES (
  'APR-01-0001', 1, 1, '01', 'Review', 'US',
  '跨商品身份/变体关系的评论聚合模式',
  '快速提升主卖商品的可见Review数量与社会证明',
  'DISCOVERED', 'NONCOMPLIANT', 'POSITIVE', 'LOW',
  '市场中存在通过不匹配的商品身份、目录关系或变体关系使原有Review显示到另一主卖商品上的现象。',
  '短期可能出现Review数量集中、社会证明增强和转化表现变化；实际效果、持续性和后续平台处理需要持续观测。',
  '{"status":"UNKNOWN","note":"需要重复观测与案例时间线验证"}',
  '["商品历史与当前商品身份明显不一致","变体成员在核心功能/商品类型上不一致","Review内容与当前商品存在明显语义错位","目录属性历史出现异常跨度变化"]',
  '[]', '[]', 'BROAD_DISCOVERY', 1, 'NON_EXECUTABLE_REFERENCE', 0, 0,
  '{"apr_id":"APR-01-0001","domain_no":"01","domain":"Review","pattern_name_cn":"跨商品身份/变体关系的评论聚合模式","business_goal":"快速提升主卖商品的可见Review数量与社会证明","marketplace":"US","observation_status":"DISCOVERED","policy_relation":"NONCOMPLIANT","business_value_signal":"POSITIVE","confidence":"LOW","exploration_scope":"BROAD_DISCOVERY","ui_visibility":true,"operationalization_mode":"NON_EXECUTABLE_REFERENCE","execution_authorized":false,"production_write_authorized":false}',
  'APRCurrentIndex.v1'
);

INSERT OR IGNORE INTO amazon_operating_method (
  method_id, record_version, is_current, domain_no, domain, marketplace,
  method_name_cn, method_name_en, objective, policy_status, risk_level,
  execution_mode, applicable_conditions_json, not_applicable_conditions_json,
  steps_json, cost_model_json, expected_impact_json, measurement_json,
  evidence_refs_json, source_urls_json, affected_product_refs_json,
  last_verified_at, execution_authorized, source_payload_json, source_version
) VALUES
(
  'AOM-01-0001',1,1,'01','Review','US','Amazon Vine 新品评价加速','Amazon Vine Review Acceleration',
  '在合规前提下加速新品获得真实高质量Review','VERIFIED_ALLOWED','LOW','AMAZON_PROGRAM',
  '["Professional selling account","Eligible FBA offer","Product detail page has fewer than 30 reviews","Brand Registry role when required or eligible generic product"]',
  '["Adult products","Digital products","Bundled products","ASIN already has 30 or more reviews"]',
  '["Check Vine eligibility in Seller Central","Choose eligible ASIN","Enroll units up to current program limit","Monitor claimed units and published reviews","Use review themes to improve listing/product experience"]',
  '{"type":"amazon_program_fee_plus_units","note":"Current fee depends on enrollment tier and marketplace; verify in Seller Central before action."}',
  '{"primary":"Increase authentic review count and review depth during launch","guaranteed":false}',
  '["new_review_count","review_velocity","star_rating","CVR_before_after","organic_rank_before_after"]',
  '["APB-01-PE-0001"]','["https://sell.amazon.com/programs/vine"]','[]','2026-09-05',0,
  '{"method_id":"AOM-01-0001","domain_no":"01","domain":"Review","method_name_cn":"Amazon Vine 新品评价加速","objective":"在合规前提下加速新品获得真实高质量Review","marketplace":"US","policy_status":"VERIFIED_ALLOWED","risk_level":"LOW","execution_mode":"AMAZON_PROGRAM","execution_authorized":false}',
  'PositiveOperatingMethodIndex.v1'
),
(
  'AOM-01-0002',1,1,'01','Review','US','Seller Central Request a Review 标准邀评','Seller Central Request a Review',
  '通过Amazon官方邀评功能提高已成交订单产生Review的概率','VERIFIED_ALLOWED','LOW','SELLER_CENTRAL_FEATURE',
  '["Eligible completed order","Order Detail page exposes Request a Review feature"]',
  '["Trying to request only positive reviews","Offering incentives, refunds, rebates, gifts or compensation for a review","Asking buyers to change or remove negative reviews"]',
  '["Open eligible Order Details","Use Amazon''s Request a Review feature","Do not add selective positive-review language or incentives","Measure review request coverage and downstream review rate"]',
  '{"type":"no_direct_program_fee"}',
  '{"primary":"Increase compliant review-request coverage across eligible orders","guaranteed":false}',
  '["eligible_orders","request_sent_count","request_coverage_rate","new_review_count","review_rate"]',
  '["APB-01-PE-0001"]','[]','[]','2026-09-05',0,
  '{"method_id":"AOM-01-0002","domain_no":"01","domain":"Review","method_name_cn":"Seller Central Request a Review 标准邀评","objective":"通过Amazon官方邀评功能提高已成交订单产生Review的概率","marketplace":"US","policy_status":"VERIFIED_ALLOWED","risk_level":"LOW","execution_mode":"SELLER_CENTRAL_FEATURE","execution_authorized":false}',
  'PositiveOperatingMethodIndex.v1'
),
(
  'AOM-01-0003',1,1,'01','Review','US','Review主题驱动的产品体验修复循环','Review-Led Product Experience Improvement Loop',
  '通过减少缺陷、误解和体验落差，提升自然好评率和长期星级稳定性','VERIFIED_ALLOWED','LOW','SYSTEM_RECOMMENDATION_ONLY',
  '["Enough authentic review or return-reason data exists","Recurring complaint themes can be mapped to controllable product/listing causes"]',
  '["Manipulating, suppressing, removing or selectively diverting negative reviews"]',
  '["Cluster recurring negative review themes","Map each theme to product defect, packaging, instructions, listing expectation or fulfillment cause","Prioritize high-frequency/high-severity controllable causes","Create product/listing improvement task","Measure complaint-theme recurrence and star-rating trend after change"]',
  '{"type":"depends_on_corrective_action"}',
  '{"primary":"Improve natural review quality and reduce negative review drivers","guaranteed":false}',
  '["negative_theme_rate","return_rate","defect_rate","star_rating","review_rate","CVR"]',
  '[]','[]','[]','2026-09-05',0,
  '{"method_id":"AOM-01-0003","domain_no":"01","domain":"Review","method_name_cn":"Review主题驱动的产品体验修复循环","objective":"通过减少缺陷、误解和体验落差，提升自然好评率和长期星级稳定性","marketplace":"US","policy_status":"VERIFIED_ALLOWED","risk_level":"LOW","execution_mode":"SYSTEM_RECOMMENDATION_ONLY","execution_authorized":false}',
  'PositiveOperatingMethodIndex.v1'
);

INSERT OR IGNORE INTO amazon_boundary_result_case (
  case_id, domain_no, domain, marketplace, result_type, status, title_cn,
  confidence, affected_product_refs_json, policy_evidence_refs_json,
  observed_evidence_refs_json, execution_authorized
) VALUES
('APB-01-PE-0001','01','Review','US','POLICY_EVIDENCE','SEEDED','评论操纵与激励评价官方政策入口已建立','MEDIUM','[]','[]','[]',0),
('APB-02-PE-0001','02','Variation','US','POLICY_EVIDENCE','SEEDED','变体创建与更新官方政策入口已建立','MEDIUM','[]','[]','[]',0),
('APB-06-PD-0001','06','Pricing','US','POLICY_DIFF','SEEDED','2026 List Price 验证规则变化已进入政策变化中心','MEDIUM','[]','[]','[]',0),
('APB-06-PD-0002','06','Pricing','US','POLICY_DIFF','SEEDED','2026 Typical/Was Price 计算变化已进入政策变化中心','MEDIUM','[]','[]','[]',0),
('APB-07-PE-0001','07','Promotion','US','POLICY_EVIDENCE','SEEDED','促销质量与历史价格相互作用入口已建立','MEDIUM','[]','[]','[]',0),
('APB-08-PE-0001','08','Advertising','US','POLICY_EVIDENCE','SEEDED','Amazon Ads 全球广告政策与禁限投入口已建立','MEDIUM','[]','[]','[]',0);
