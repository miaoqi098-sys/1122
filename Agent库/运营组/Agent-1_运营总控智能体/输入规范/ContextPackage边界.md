# Event 与 ContextPackage 边界

## 1. 正式链路
```text
原始Event
→ S01 校验/标准化
→ S01.normalized_event
→ S02 ContextLoading
→ ContextPackage
```

S02 不得绕过 S01 使用未经标准化的原始 Event 作为正式事实源。

## 2. ContextPackage职责
ContextPackage 是 S03-S06 与 Agent-1 后续推理的唯一权威上下文事实源，负责装载：
- 当前事件；
- 产品/账户/店铺身份；
- 经营状态；
- 目标；
- 指标；
- 历史；
- 专业Agent结果；
- 市场竞品；
- 知识；
- 当前任务与限制。

## 3. 输入规范不负责
输入规范不直接定义 ContextPackage 的全部内部结构，也不重复维护 current_goals/business_state/constraints 等第二套值。

如果后续为性能生成这些字段，只能作为 ContextPackage 派生视图。

## 4. 专业Agent结果进入上下文
专业Agent返回可被S02装载，但必须保留：
- request_id；
- source_agent；
- data_window；
- confidence；
- evidence_refs；
- missing_data；
- valid_until/review_at。

旧结论必须做 freshness 检查，不能因为“来源是专业Agent”永久有效。

## 5. 人工/系统输入进入上下文
- 人工目标/约束/审批：按其真实语义装载；
- 系统状态/错误：作为状态或缺失信息装载；
- 执行回执：优先进入 ExecutionResult 链，再由S02按需读取历史；
- 不得把授权、失败、日志等转写成未经证据支持的经营事实。

## 6. 缺失处理
S02可输出：ready / ready_with_gaps / needs_information / blocked。输入缺失只有在可能改变当前决策时才升级补数优先级。