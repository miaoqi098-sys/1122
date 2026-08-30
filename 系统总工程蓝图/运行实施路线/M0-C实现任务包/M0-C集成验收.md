# M0-C 只读聚合与 UI 集成验收 V1

## 1. 验收目标
确认 M0-A/M0-B 的真实对象在未来实现后，可通过两个聚合器和只读接口形成首页/产品卡，不引入经营写权限。

## 2. 集成门禁
- [ ] ProductStateAggregator 只读取源对象，不改写业务事实。
- [ ] HomeCommandCenterAggregator 只组合读模型，不直接驱动 Agent/Executor。
- [ ] 产品卡与首页使用既有 Canonical View Schema。
- [ ] 各区域支持独立 degraded/freshness。
- [ ] View字段能追溯源对象/版本。
- [ ] UI API服务端执行scope权限检查。
- [ ] M0接口不存在 approve/execute/update 经营写能力。
- [ ] 单模块故障不会导致整个首页无条件失败。
- [ ] 真实运行时必须有机器证据才能声明 READ_MODEL_VERIFIED。
- [ ] 真实授权外部数据进入后才能声明 LIVE_DATA_VERIFIED。

## 3. 最小真实只读验收链
```text
ProductIdentity
→ MetricSnapshot
→ BusinessState / Event
→ ProductStatusCardView
→ HomeCommandCenterView
→ ReadOnly UI API
→ UI
```

## 4. M0总里程碑
M0-A + M0-B + M0-C 未来真实实现并通过运行证据后，系统首次能够稳定回答：

> “这个授权产品现在怎么样、数据有多新、当前状态/阶段/目标是什么、有什么重要异常、系统最近记录了什么？”

但仍不能执行经营写动作。

## 5. 静态验收结论
M0-C 实现任务包 V1：**PASS（静态规格）**。

至此 M0 实现任务包的静态规格已经闭合。下一阶段可进入 M1-A：TaskCenter + Policy/Permission + Approval 实现任务包规格化。