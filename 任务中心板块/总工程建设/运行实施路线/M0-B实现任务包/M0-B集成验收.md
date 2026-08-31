# M0-B 状态/事件集成验收 V1

## 1. 验收目标
确认 M0-A 标准事实可以稳定推进为状态、阶段、目标、事件、活动和记忆，并为 ProductStateAggregator 提供结构化输入。

## 2. 集成门禁
- [ ] BusinessState 只读取标准事实/规则版本，不直接依赖Raw API。
- [ ] ProductStage 与 BusinessState 分离，阶段定义来自版本化字典。
- [ ] Goal事实由Repository持久化，Agent-1只负责选择/排序/切换逻辑。
- [ ] Signal通过Normalizer进入唯一Canonical Event体系。
- [ ] Event生命周期独立于Task完成状态。
- [ ] AgentActivity来自结构化对象变化，不是debug日志。
- [ ] Memory/Timeline只引用真实对象，不保存私有链式思考。
- [ ] StageSummary不覆盖历史。
- [ ] 所有对象可按product_id关联。
- [ ] stale/insufficient/conflict 均有降级路径。

## 3. 最小样例
```text
MetricSnapshot
→ BusinessState
→ ProductStage
→ Signal
→ Canonical Event
→ AgentActivity
→ Memory/Timeline
→ ProductStateAggregator input
```

Goal允许在该样例中已有既定active Goal；不要求M0阶段运行Agent自主生成新目标。

## 4. 静态验收结论
M0-B 实现任务包 V1：**PASS（静态规格）**。

下一阶段进入 M0-C：ProductStateAggregator、HomeCommandCenterAggregator、只读UI接口实现任务包规格化。