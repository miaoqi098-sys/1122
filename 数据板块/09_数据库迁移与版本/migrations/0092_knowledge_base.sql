-- 1122 Knowledge Base persistence V1.
-- Read-mostly reusable cognition layer. No production execution authority.

CREATE TABLE IF NOT EXISTS knowledge_items (
  knowledge_id TEXT NOT NULL,
  record_version INTEGER NOT NULL DEFAULT 1,
  is_current INTEGER NOT NULL DEFAULT 1,
  knowledge_type TEXT NOT NULL,
  domain TEXT NOT NULL,
  subdomain TEXT,
  marketplace TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  keywords_json TEXT NOT NULL DEFAULT '[]',
  applicable_conditions_json TEXT NOT NULL DEFAULT '[]',
  not_applicable_conditions_json TEXT NOT NULL DEFAULT '[]',
  related_product_refs_json TEXT NOT NULL DEFAULT '[]',
  related_knowledge_refs_json TEXT NOT NULL DEFAULT '[]',
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  source_urls_json TEXT NOT NULL DEFAULT '[]',
  truth_class TEXT NOT NULL,
  confidence TEXT NOT NULL,
  freshness_status TEXT NOT NULL DEFAULT 'UNKNOWN',
  effective_at TEXT,
  last_verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  ui_visibility INTEGER NOT NULL DEFAULT 1,
  execution_authorized INTEGER NOT NULL DEFAULT 0,
  production_write_authorized INTEGER NOT NULL DEFAULT 0,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  source_version TEXT,
  effective_from TEXT NOT NULL DEFAULT (datetime('now')),
  superseded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (knowledge_id, record_version),
  CHECK (is_current IN (0,1)),
  CHECK (ui_visibility IN (0,1)),
  CHECK (execution_authorized = 0),
  CHECK (production_write_authorized = 0),
  CHECK (knowledge_type IN ('POLICY','OPERATING_METHOD','MARKET_PATTERN','PRODUCT_KNOWLEDGE','ADVERTISING_KNOWLEDGE','PRICING_KNOWLEDGE','CONTENT_KNOWLEDGE','CASE_LESSON','SYSTEM_ENGINEERING','DATA_DEFINITION','DECISION_RULE')),
  CHECK (truth_class IN ('SOURCE_ONLY','OBSERVED','DERIVED','VALIDATED','CONFIRMED','CONFLICTING','UNKNOWN')),
  CHECK (confidence IN ('HIGH','MEDIUM','LOW','UNVERIFIED')),
  CHECK (freshness_status IN ('FRESH','LAGGED','STALE','UNKNOWN')),
  CHECK (status IN ('ACTIVE','DRAFT','SUPERSEDED','ARCHIVED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_one_current
  ON knowledge_items(knowledge_id)
  WHERE is_current = 1;
CREATE INDEX IF NOT EXISTS idx_knowledge_type_domain
  ON knowledge_items(knowledge_type, domain, is_current, status);
CREATE INDEX IF NOT EXISTS idx_knowledge_truth_confidence
  ON knowledge_items(truth_class, confidence, is_current, status);
CREATE INDEX IF NOT EXISTS idx_knowledge_marketplace
  ON knowledge_items(marketplace, is_current, status);

INSERT OR IGNORE INTO knowledge_items (
  knowledge_id, record_version, is_current, knowledge_type, domain, title,
  summary, content, keywords_json, related_knowledge_refs_json,
  source_refs_json, truth_class, confidence, freshness_status,
  last_verified_at, status, execution_authorized, production_write_authorized,
  source_payload_json, source_version
) VALUES
(
  'KB-SYS-0001',1,1,'SYSTEM_ENGINEERING','System','知识与记忆的边界',
  '知识保存可复用认知；记忆保存具体对象过去发生过什么。',
  '知识回答系统普遍知道什么；记忆回答某个具体产品、任务或决策过去发生过什么。知识可以被多个产品和Agent重复使用，记忆通常绑定具体对象和时间线。',
  '["知识库","记忆","Knowledge","Memory"]','[]','["知识板块/README.md"]',
  'CONFIRMED','HIGH','FRESH','2026-09-05','ACTIVE',0,0,
  '{"principle":"knowledge_vs_memory"}','KnowledgeBase.v1'
),
(
  'KB-SYS-0002',1,1,'SYSTEM_ENGINEERING','Truth Boundary','技术可行不等于政策允许',
  'TECHNICALLY_POSSIBLE、POLICY_ALLOWED、NOT_CURRENTLY_PUNISHED、LONG_TERM_SUSTAINABLE 必须分开判断。',
  '1122 不得因为某操作技术上能够执行、市场上存在、或者暂时未被处罚，就推导为政策允许或长期可持续。边界结论需要独立证据与验证。',
  '["policy boundary","technically possible","sustainable","fail closed"]','[]','["亚马逊政策边界/README.md"]',
  'CONFIRMED','HIGH','FRESH','2026-09-05','ACTIVE',0,0,
  '{"principle":"truth_boundary"}','KnowledgeBase.v1'
),
(
  'KB-OPS-0001',1,1,'OPERATING_METHOD','Review','Amazon Vine 新品评价加速',
  '在符合 Vine 条件时，可用于新品期加速真实 Review 积累。',
  'Vine 是 Amazon 平台原生 Review 方法。是否适用必须先判断当前项目资格、FBA状态和 Review 数量等条件。结果不保证正面评价。',
  '["Vine","Review","新品","评价"]','["KB-POL-0001"]','["AOM-01-0001","APB-01-PE-0001"]',
  'SOURCE_ONLY','MEDIUM','FRESH','2026-09-05','ACTIVE',0,0,
  '{"aom_ref":"AOM-01-0001"}','KnowledgeBase.v1'
),
(
  'KB-MKT-0001',1,1,'MARKET_PATTERN','Review','跨商品身份/变体关系的评论聚合模式',
  '市场中存在通过不匹配商品身份或变体关系形成 Review 集中的现象；该记录仅用于识别与研究。',
  '该模式可能带来短期社会证明变化，但与 Amazon 目录/Review 政策存在明显冲突风险。知识库只保存识别信号、商业目标与风险判断，不提供执行步骤。',
  '["APR","Review aggregation","Variation","Catalog"]','["KB-SYS-0002"]','["APR-01-0001"]',
  'OBSERVED','LOW','UNKNOWN','2026-09-05','ACTIVE',0,0,
  '{"apr_ref":"APR-01-0001","operationalization_mode":"NON_EXECUTABLE_REFERENCE"}','KnowledgeBase.v1'
),
(
  'KB-POL-0001',1,1,'POLICY','Review','Review 操纵与激励评价边界',
  'Review 获取必须与激励、补偿、正向筛选、差评删除要求等操纵方式保持边界。',
  '1122 的 Review 方法必须经过 APB 证据检查。补偿换评价、退款换评价、只向满意客户邀评、要求更改或移除差评、通过不相关变体聚合 Review 等模式不得进入可执行 AOM。',
  '["Review policy","incentive","manipulation","APB"]','["KB-SYS-0002"]','["APB-01-PE-0001"]',
  'SOURCE_ONLY','MEDIUM','FRESH','2026-09-05','ACTIVE',0,0,
  '{"apb_ref":"APB-01-PE-0001"}','KnowledgeBase.v1'
);
