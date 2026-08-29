# 专业 Agent 响应交接协议 V1.0

## 1. 定位
Agent-1 请求专业 Agent 分析时，各专业 Agent 可以使用自己的领域响应 Schema，但交回 Agent-1 时必须能够规范化为：
`Agent-1_运营总控智能体/输入规范/专业Agent结果.schema.json`。

## 2. 两层响应
`Domain Analysis Response → 规范化 → 专业Agent结构化结果 → Agent-1`

领域响应用于保留专业诊断细节；Agent-1 标准结果用于统一消费、冲突检测与决策。

## 3. 必须映射的核心字段
- request_id：必须沿用原请求，不得新造无关联 request_id。
- source_agent：由领域 `responder_agent / agent_id` 规范化。
- analysis_scope：由领域 scope 映射。
- facts：只保留可证实事实；领域对象 facts 如果是结构化对象，应转为事实文本并把原对象保留在 metadata.domain_payload。
- interpretation：领域 diagnoses / interpretations 的解释性内容。
- conclusion：专业 Agent 当前证据下的结论摘要；不得伪装为 Agent-1 FinalDecision。
- recommendation：可选候选建议。
- confidence：统一 0–1；标签型 low/medium/high 按事件协议相同代表值规范化，并保留原标签。
- data_window：分析数据窗口摘要。
- evidence_refs：证据引用。
- missing_data：领域 missing_inputs / gaps 映射。
- risks：限制、风险和重要不确定性。
- status：统一为 answered / answered_with_gaps / insufficient_evidence / blocked。

## 4. Status映射
推荐默认：
- completed → answered
- partial → answered_with_gaps
- needs_information → insufficient_evidence
- unsupported → insufficient_evidence
- blocked → blocked

原领域状态写入 metadata.original_status。

## 5. 诊断与事实分离
例如 Agent-4 `AdvertisingAnalysisResponse`：
- facts[] 的结构化观测 → canonical facts 文本；
- diagnoses[] → interpretation；
- recommendation_candidates → recommendation 或 metadata；
- data_quality / limitations → risks / metadata；
- missing_inputs → missing_data；
- cross_agent_dependencies → metadata.cross_agent_dependencies。

## 6. 置信度聚合
若一个领域响应包含多个 diagnosis 且每个 confidence 不同：
- 标准结果 confidence 表示整个响应结论的整体可信度，而不是机械取最高值；
- 默认不得高于关键结论中最低的证据充分度；
- 各诊断原 confidence 保留在 metadata.domain_payload。

## 7. 时间与新鲜度
领域 `generated_at` 不直接替代 data_window。分析窗口必须能说明事实对应的数据时期；生成时间可放 metadata.generated_at，必要时结合 `valid_until / review_at` 管理复用。

## 8. 运行边界
本协议只定义静态映射。真实 Response Normalizer、校验器和调用编排属于未来运行层。