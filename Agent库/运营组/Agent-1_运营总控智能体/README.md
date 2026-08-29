# Agent-1｜运营总控智能体

所属：运营组  
阶段：V1.x 框架层  
角色：运营组**唯一最终经营决策中枢**。

## 1. 核心使命
在账户安全、权限、合规、利润、库存、价格体系、经营目标和长期增长等约束下，把来自专业Agent、人工和系统的经营事件转化为可追溯、可审批、可执行、可验证、可学习的经营决策。

Agent-1 不机械执行单个Agent的建议，也不采用永久固定的业务优先级链。它基于目标系统、经营状态、证据、硬约束、依赖和机会窗口动态判断。

## 2. Canonical业务主链

```text
Event
→ S01 EventValidation
→ S02 ContextLoading / ContextPackage
→ S03 ConflictDetection
→ DecisionItemBuilder
→ S04 DecisionPrioritization
→ S05 OptionGeneration
→ S06 RiskAssessment
→ DecisionSelector
→ FinalDecision
→ S07 TaskOrchestration
→ Scheduler / Approval / Executor（未来运行层）
→ ExecutionResultNormalizer
→ ExecutionResult
→ S08 OutcomeValidation
→ ValidationResult
→ S09 LearningWriteback
→ LearningRecord / memory_writes plan
→ LearningWriteExecutor（未来运行层）
```

S10 StrategyStabilization是横向策略稳定性控制，在策略反转、替代、观察窗口等场景介入，不是机械固定“第10步”。

## 3. 业务对象与追溯链

`event_id → decision_item_id → option_id → decision_id → task_plan_id → task_id → execution_result_id → validation_id → learning_id`

`strategy_chain_id`贯穿策略生命周期。

`run_id / trace_id / parent_run_id`只属于运行调用追踪，不替代业务主键。

## 4. 当前正式模块

### 身份与权限
定义Agent-1身份、唯一决策出口、权限边界、审批与禁止动作。

### 目标系统
定义核心目标、目标层级、约束与动态经营目标关系。

### 大脑
定义系统提示、分析框架、假设与方案比较等总控思维框架。

### 经营知识库
提供跨广告、价格、库存、利润、Listing、评价、竞品、市场、风险等经营知识。

### 经营状态识别
识别生命周期、经营情境、风险与机会状态，为上下文和动态判断提供状态语义。

### 经营指标库
统一流量、转化、广告、利润、库存、价格、体验、市场等指标和阈值/基线框架。

### 协作机制
定义Agent-1与Agent-2至Agent-13的请求、证据、冲突、追问和协作边界。专业Agent提供事件/证据，不成为新的最终决策出口。

### 技能模块
- S01 事件校验
- S02 上下文装载
- S03 冲突检测
- S04 决策排序
- S05 方案生成
- S06 风险评估
- S07 任务编排
- S08 结果验证
- S09 经验沉淀
- S10 策略防抖

统一接口和桥接组件已在框架层定义；真实Runner仍属于运行依赖。

### 决策模板库
提供广告、库存、价格促销、利润、Listing与转化、风险合规、评价体验、竞品市场、多Agent冲突和综合经营等标准决策结构。模板指导结构，不替代S04/S05/S06或DecisionSelector。

### 案例库
保存可追溯的成功、失败、冲突、异常、实验等案例，并定义适用范围、新鲜度、版本与复用边界；案例不直接形成FinalDecision。

### 工具与数据需求
定义各决策阶段需要的数据、工具、权限、新鲜度、降级和未来运行依赖，不实现真实API。

### 决策规则
定义硬约束资格门、动态优先级、风险资格、策略稳定、审批/信息不足和最终决策边界。**不使用永久固定的经营优先级链。**

### 输入规范
统一Event、专业Agent结果、人工/系统输入、scope和业务引用；recommendation不是Event硬必填。

### 输出规范
以`FinalDecision`为canonical决策输出；旧`决策指令.schema.json`仅保留兼容用途。

### 事件处理
定义事件严重度、去重、合并、关联、生命周期、异常与升级；Event severity不等于S04 business_priority。

### 任务调度
定义Task/TaskPlan/TaskGraph、审批、观察、失败、取消、回滚和共享调度边界；真实Scheduler/Executor不属于Agent-1本体。

### 历史记忆
定义经营事实、Decision、Task/ExecutionResult、ValidationResult、LearningRecord的长期历史、新鲜度、版本和复用边界。

### 工作流
定义S01-S09主链、S10横向控制、桥接组件、异常回路、断点与重入。

### 自主循环
用“观察、思考、计划、行动、验证、学习”解释持续经营循环，但全部映射canonical业务对象和Skill，不形成第二套流程。支持等待、休眠、唤醒、幂等和循环熔断。

### 配置
定义配置合同、canonical引用、覆盖层级、版本和运行边界；不复制业务规则或固定阈值。

### 日志规范
定义事件、决策、任务执行、验证学习、版本证据的append-only审计链。

### 测试
静态框架测试与动态运行测试严格分层。当前静态测试可验收；Runner/API/Scheduler/Executor/持久化等动态测试仍为`BLOCKED_RUNTIME`。

### 示例
提供canonical智能事件、完整决策链、任务验证学习链和多Agent综合场景示例。

## 5. 核心原则
1. Agent-1是运营组唯一最终经营决策出口。
2. 原始输入必须经S01校验后才能进入后续上下文。
3. ContextPackage是后续经营判断的权威上下文事实源。
4. 硬约束/资格门和S04动态business_priority分离，不使用永久固定业务优先级链。
5. 专业Agent建议是证据/意见，不自动成为FinalDecision。
6. prohibited方案不可选；eligible_with_controls必须传递controls。
7. 策略反转/替代必须经过S10稳定性门。
8. FinalDecision在S07之前形成，S07不重新选择经营方案。
9. Task创建、审批、执行成功、经营验证成功必须严格区分。
10. 没有真实ExecutionResult不得宣称执行成功；没有S08 ValidationResult不得宣称经营目标成功。
11. S09只生成LearningRecord/memory_writes plan，真实长期记忆写入等待R10回执。
12. 业务主键、scope、证据、版本和strategy_chain必须可追溯。
13. 信息不足时允许needs_information/blocked/hold，不为保持流程活跃而强行下结论。
14. 高风险、不可逆或越权动作必须遵守approval和权限边界。

## 6. 当前框架状态
Agent-1 的一级模块已完成框架层逐模块 L3 验收，并已完成 Agent 级 L4 一致性回顾。

当前 Agent库 已进入 L5 全库一致性验收。Agent-1 在 L5 中继续作为以下公共规则的权威来源：
- 唯一最终经营决策出口；
- `智能事件包.schema.json` 作为专业Agent主动事件进入总控的 Canonical Event；
- `专业Agent结果.schema.json` 作为专业请求响应进入总控的 Canonical Response；
- Event → Decision → Task → Execution → Validation → Learning 的业务主链；
- run_id / trace_id 等运行追踪字段不替代业务主键。

跨 Agent 领域事件/响应的规范化、职责覆盖和协作路由统一见：`../公共协议/`。

Agent-1 的静态框架已通过 L4；真实Runner、API、数据库、Scheduler、Executor、持久化和运行期动态测试仍属于共享运行依赖，不影响其框架层完成状态。

## 7. 与运行层的关系
当前阶段完成的是Agent库静态框架，不实施真实运行层。

未来运行能力包括：Skill Runner、Agent Runner、Schema Validator、Amazon SP-API/Ads API、长期记忆数据库、Scheduler、Executor、ExecutionResultNormalizer、LearningWriteExecutor、StrategyChain持久化、专业Agent事件/响应Normalizer等，统一在运行依赖中挂账。

**框架层完成 ≠ 动态运行完成。**