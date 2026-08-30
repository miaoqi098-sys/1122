# 运行依赖 DAG 与关键路径 V1

> 对应任务：RI-01
> 目标：把 R-GP-001～R-GP-026 从分组清单提升为可实施依赖图。
> 边界：只定义建设顺序和门禁，不实施真实运行服务。

## 1. 总原则

- 先建立稳定身份与真实事实，再建立状态判断。
- 先完成只读链，再进入任务、审批和真实执行。
- Agent Runtime 不能替代数据、任务、权限或执行系统。
- Executor 不得在 Policy/Permission/Approval 未满足时提前建设成可生产写入能力。
- UI 只能声明它真正读取到了哪个成熟度等级的数据。

## 2. 主关键路径

```text
R-GP-001 ProductIdentity持久化
  ↓
R-GP-002 IdentityResolution
  ↓
R-GP-003 外部标识映射
  ↓
R-GP-023 Amazon只读数据接入
  ↓
R-GP-004 MetricSnapshot采集持久化
  ├─→ R-GP-005 时间/新鲜度
  ├─→ R-GP-006 指标字典
  └─→ R-GP-007 利润计算
          ↓
R-GP-008 BusinessState Engine
  ├─→ R-GP-009 阶段定义字典
  ├─→ R-GP-010 ProductStage判定
  ├─→ R-GP-011 Goal Repository
  ├─→ R-GP-012 Goal评估器
  └─→ R-GP-014 Event Normalizer/Repository/Signal Detector
          ↓
R-GP-019 AgentActivity Repository
R-GP-020 Memory/Timeline/StageSummary
          ↓
R-GP-021 ProductStateAggregator
          ↓
R-GP-022 HomeCommandCenterAggregator
          ↓
R-GP-025 首页/产品卡真实读取接口
          ↓
========== M0 只读门禁 ==========
          ↓
R-GP-015 TaskCenter
          ↓
R-GP-016 Policy/Permission/Approval
          ↓
R-GP-024 Agent Runtime/Scheduler/Queue
          ↓
R-GP-017 Executor
          ↓
R-GP-018 Validation Service
          ↓
R-GP-013 目标切换审计活动
          ↓
R-GP-026 单产品真实MVP验收环境
```

## 3. 可并行支路

### 数据规则支路
R-GP-005、006、007 可在 R-GP-004 实现前并行完成静态/服务接口定义，但真实验证依赖 MetricSnapshot。

### 产品阶段支路
R-GP-009 可独立由业务侧定义；R-GP-010 的真实判定必须等待 R-GP-008 与 R-GP-009。

### Goal支路
R-GP-011 可先实现 Repository；R-GP-012 必须等待 MetricSnapshot 和 Goal Repository。

### 业务活动/记忆支路
R-GP-019、020 可以在只读链中先消费结构化对象变化，不必等待 Executor；但执行类活动只有 M1 后才能出现真实记录。

## 4. 硬前置约束

| 下游 | 硬前置 |
|---|---|
| MetricSnapshot | ProductIdentity、数据源接入、时间规则 |
| BusinessState | MetricSnapshot、规则版本 |
| ProductStage | BusinessState、阶段定义字典 |
| ProductStateAggregator | ProductIdentity、MetricSnapshot、BusinessState；其余对象允许降级缺失 |
| HomeCommandCenterAggregator | ProductStateAggregator、HumanTask/Activity/Event读取能力；M0允许任务区为空 |
| TaskCenter | ProductIdentity、Event/Decision引用契约 |
| Approval | TaskCenter、Policy/Permission |
| Executor | Task + Permission + Approval/auto-authority |
| Validation | ExecutionResult + MetricSnapshot + observation window |
| BUSINESS_LOOP_VERIFIED | 上述全链真实证据 |

## 5. 关键禁止项

- 不允许先做“漂亮首页”再补数据血缘。
- 不允许让 Agent 直接把自然语言写成 Task/Action 事实。
- 不允许执行服务将“API成功”解释为“业务成功”。
- 不允许用 ASIN/SKU 替代 product_id 作为系统唯一关联键。
- 不允许用静态示例证明 LIVE_DATA_VERIFIED。

## 6. L1结论

依赖分层已经从列表提升为 DAG，主关键路径、可并行支路、硬前置和禁止项均明确。未新增运行依赖，未越界实施运行层。L1：PASS。