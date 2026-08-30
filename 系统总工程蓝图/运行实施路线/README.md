# 运行实施路线 V1

> 状态：分析施工中
> 目的：把 R-GP-001～R-GP-026 从“运行依赖清单”转成可实施的分层建设顺序与验收门禁。
> 边界：本目录只设计实施路线，不在当前自动施工中接真实 API、数据库、Runner、Scheduler、Executor 或生产写权限。

## 一、依赖分层

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

完成 M0 后可目标性验证：真实数据 → 状态/Event → 产品卡/首页，只读，不执行经营写动作。

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

## 二、推荐建设顺序
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

## 三、里程碑真值等级
- STATIC_CONTRACT_VERIFIED：Schema/规则/静态验收通过。
- READ_MODEL_VERIFIED：聚合读模型有真实持久化数据支撑。
- LIVE_DATA_VERIFIED：真实授权数据源读取并可追溯。
- AGENT_RUNTIME_VERIFIED：Agent真实运行并产出结构化对象。
- HUMAN_APPROVAL_VERIFIED：真实人工审批链可审计。
- EXECUTION_VERIFIED：受控动作真实执行且有ExecutionResult。
- VALIDATION_VERIFIED：真实效果验证完成。
- BUSINESS_LOOP_VERIFIED：完整 Data→Event→Decision→Task→Approval→Action→Validation→Memory→UI 闭环有机器可验证证据。

不得跨级声称成熟度。

## 四、当前下一分析
1. 定义 M0 只读链最小实现集；
2. 定义每个里程碑输入/输出/门禁；
3. 明确哪些目标根目录需要先物理建立，哪些仍只保留映射；
4. 保持大规模目录迁移为高影响动作，不自动执行。