# 运行实施路线 V1

> 状态：V1 静态路线已完成，等待真实实现
> 目的：把 R-GP-001～R-GP-026 从“运行依赖清单”转成可实施的分层建设顺序与验收门禁。
> 边界：本目录只设计实施路线，不在当前自动施工中接真实 API、数据库、Runner、Scheduler、Executor 或生产写权限。

## 一、正式成果

- `依赖DAG与关键路径.md`：R-GP-001～026 的前后置依赖、关键路径、并行支路和硬前置。
- `M0只读链最小实现集.md`：第一个真实只读系统的最小能力集合与门禁。
- `M1人工审批与执行边界.md`：Task→Approval→Permission→Executor→Validation 的受控边界。
- `真值等级与验收门禁.md`：STATIC 到 BUSINESS_LOOP 的分级证据与降级规则。
- `物理目录建设决策.md`：先实现能力、后迁移目录；当前不做大规模根目录重构。

## 二、依赖分层

### M0-A｜身份与事实数据地基
- R-GP-001 ProductIdentity持久化
- R-GP-002 IdentityResolution
- R-GP-003 外部标识映射
- R-GP-004 MetricSnapshot采集持久化
- R-GP-005 业务时间/新鲜度
- R-GP-006 指标字典
- R-GP-007 利润计算服务

### M0-B｜状态、目标、事件只读链
- R-GP-008 BusinessState Engine
- R-GP-009 阶段定义字典
- R-GP-010 ProductStage判定
- R-GP-011 Goal Repository
- R-GP-012 Goal评估器
- R-GP-014 Event Normalizer/Repository/Signal Detector
- R-GP-019 AgentActivity Repository
- R-GP-020 Memory/Timeline/StageSummary

### M0-C｜只读聚合与UI接口
- R-GP-021 ProductStateAggregator运行服务
- R-GP-022 HomeCommandCenterAggregator运行服务
- R-GP-025 首页/产品卡真实读取接口

完成 M0 后目标是验证：真实数据 → 状态/Event → 产品卡/首页，只读，不执行经营写动作。

### M1-A｜任务与权限
- R-GP-015 TaskCenter Repository/状态机
- R-GP-016 Policy/Permission/审批服务
- R-GP-013 目标切换审计活动

### M1-B｜执行与验证
- R-GP-017 Executor/ExecutionResult Normalizer
- R-GP-018 Validation Service

### M1-C｜Agent运行与外部平台
- R-GP-023 Amazon SP-API / Ads API真实接入
- R-GP-024 Agent Runtime / Scheduler / Queue
- R-GP-026 真实单产品MVP验收环境

## 三、推荐建设顺序

```text
ProductIdentity + 数据采集
→ MetricSnapshot
→ 状态/阶段/Goal/Event Repository
→ ProductStateAggregator
→ HomeCommandCenterAggregator
→ 只读UI
→ TaskCenter
→ Policy/Permission + Approval
→ Agent Runtime / Scheduler
→ Executor
→ Validation
→ 单产品受控写操作验收
```

原则：先证明“系统看得对”，再证明“系统想得对”，最后才证明“系统能安全地做”。

## 四、真值等级

正式门禁读取 `真值等级与验收门禁.md`：

```text
STATIC_CONTRACT_VERIFIED
→ SERVICE_IMPLEMENTED
→ READ_MODEL_VERIFIED
→ LIVE_DATA_VERIFIED
→ AGENT_RUNTIME_VERIFIED
→ HUMAN_APPROVAL_VERIFIED
→ EXECUTION_VERIFIED
→ VALIDATION_VERIFIED
→ BUSINESS_LOOP_VERIFIED
```

任何阶段不得跨级声称成熟度；历史验证与当前成熟度分开保存。

## 五、目录策略

当前不执行大规模目录迁移。真实实现时按 `物理目录建设决策.md` 的门禁逐个建立必要工程域；`数据接口层/`、`记忆与数据层/` 的目标拆分只保留映射，待接口稳定和用户授权后迁移。

## 六、下一阶段

进入 `M0-A 实现任务包规格化`：把身份与事实数据地基拆成工程团队可以直接实现和验收的最小任务包、接口契约、依赖和验收条件，但本自动施工仍不实施真实数据库/API。