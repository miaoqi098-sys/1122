# Event 与 Signal 实现任务包 V1

> 覆盖：R-GP-014
> Canonical边界：继续复用 Agent-1 `智能事件包.schema.json` 与 `ProcessedEvent.schema.json`，本任务包不新增第二套核心 Event Schema。

## 1. Signal Detector
输入：MetricSnapshot、baseline/threshold/trend rules。
输出：候选 Signal，不直接等于 Canonical Event。

候选至少含：product_id、signal_type、observed_at、metric_refs、severity_hint、detector_version。

## 2. Event Normalizer
职责：
- Domain Signal / 专业 Agent Event → Canonical Event；
- 统一 Scope、证据、严重度、时间、来源；
- 拒绝缺 product/scope/evidence 的不可消费事件；
- 生成稳定 fingerprint。

## 3. Event Repository
至少支持：
- create/update/get/list；
- exact/near duplicate 处理；
- relation/merge；
- monitoring/resolved/closed/reopen；
- evidence append；
- product_id 查询；
- 决策/任务/Action引用查询。

## 4. 状态推进
Task完成不能自动让Event resolved。
Event resolved 必须满足明确 resolution_basis 与 resolution_evidence_refs。

## 5. 最小Detector范围
M0第一版只需实现一个可解释 Detector，例如广告花费异常或转化异常。
不追求复杂ML异常检测，优先确保可解释、可回放、可版本化。

## 6. 失败路径
- 数据 stale → signal suppressed/degraded
- detector规则缺失 → not_evaluated
- 证据不足 → candidate_only
- duplicate → 更新 canonical event，不新建刷屏事件
- 多产品范围不清 → reject/requires_resolution

## 7. 验收条件
- 相同事实不会无限生成重复Event；
- Event可回指Metric/evidence；
- Event生命周期独立于Task；
- 专业Agent输出可通过Normalizer进入Agent-1 Canonical协议；
- 首页 ImportantEvents 可按 importance/visibility 查询。

## 8. 静态L1
Signal→Normalizer→Repository→生命周期的实现边界已明确，并保持现有Canonical Event唯一性。L1：PASS。