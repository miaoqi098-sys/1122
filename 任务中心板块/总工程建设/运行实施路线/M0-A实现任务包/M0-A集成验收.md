# M0-A 地基集成验收 V1

## 1. 验收目标
确认身份、事实数据、时间/新鲜度、指标字典和利润计算在未来实现后能够共同为 M0-B 提供可靠输入。

## 2. 集成门禁
- [ ] 外部产品记录可唯一解析到 product_id；歧义时 fail closed。
- [ ] MetricSnapshot 必须绑定 product_id。
- [ ] business_date/window 使用 marketplace 时区。
- [ ] source、collected_at、effective_at、freshness、quality 可追溯。
- [ ] metric_code 来自统一 Registry。
- [ ] 计算指标保留 calculation_version。
- [ ] 利润结果保留 cost_model_version 和 completeness。
- [ ] 重复采集具备幂等语义。
- [ ] 修订事实不覆盖历史解释链。
- [ ] M0-B 不需要直接读取 Raw API/报表即可获取标准事实。
- [ ] 数据缺失/延迟不会被伪装成正常完整数据。

## 3. 最小集成样例

未来至少以一个真实授权 product_id 验证：
```text
外部 ASIN/SKU
→ IdentityResolution
→ product_id
→ sales MetricSnapshot
→ ad_spend MetricSnapshot
→ freshness/quality
→ Profit calculation
→ M0-B BusinessState input
```

## 4. 成熟度

当前本文件通过仅表示 M0-A **实现规格**静态完整，不表示上述组件已经 SERVICE_IMPLEMENTED。

## 5. 静态验收结论

M0-A 实现任务包 V1：**PASS（静态规格）**。

下一阶段可进入 M0-B“状态、阶段、Goal、Event、Activity、Memory”实现任务包规格化。