# M0-A 实现任务包 V1

> 状态：规格化施工中
> 范围：R-GP-001～R-GP-007
> 目标：把“身份与事实数据地基”拆成未来工程实现可以直接领取的最小任务包。
> 边界：当前不实现数据库、Amazon API、部署或生产服务。

## 1. 任务包

1. `身份链任务包.md`：ProductIdentity 持久化、IdentityResolution、外部标识映射。
2. `事实数据链任务包.md`：MetricSnapshot 采集、标准化、持久化、修订历史。
3. `时间新鲜度与指标字典任务包.md`：业务时间、新鲜度、指标字典与计算引用。
4. `利润计算任务包.md`：成本版本、利润快照、完整度与缺失成本项。
5. `M0-A集成验收.md`：地基集成门禁。

## 2. 统一实现要求

每个真实服务未来必须具备：
- 明确输入/输出 Contract；
- product_id 关联；
- 幂等/去重规则；
- 错误分类；
- 可观测性；
- 权限边界；
- 数据血缘；
- 版本兼容策略；
- 测试；
- 机器可验证验收证据。

## 3. 交付顺序

```text
Identity Store
→ IdentityResolution
→ 外部标识映射
→ 只读数据采集
→ MetricSnapshot Store
→ Time/Freshness
→ Metric Registry
→ Profit Calculation
→ M0-A Integration Gate
```

## 4. 成熟度边界

这些任务包完成静态规格后仍只属于 `STATIC_CONTRACT_VERIFIED` 范围。未来真实实现和测试完成才能进入 `SERVICE_IMPLEMENTED`；真实授权数据进入后才可能达到 `LIVE_DATA_VERIFIED`。