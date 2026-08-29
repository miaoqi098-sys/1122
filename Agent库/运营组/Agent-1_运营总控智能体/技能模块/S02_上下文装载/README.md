# S02｜上下文装载

## 技能定位
S02在S01事件校验通过后，围绕当前问题建立最小充分上下文（Minimum Sufficient Context）。

它不把全部历史、指标、知识和Agent结论塞进模型，而是判断：这次决策真正需要知道什么、哪些信息仍有效、哪些信息必须刷新、哪些缺失会改变决策。

## 正式输入来源
S02必须直接接收：
- `validated_event = S01.normalized_event`
- `s01_validation`
- `context_request`

禁止重新读取未经S01标准化的原始Event作为正式输入。

## 作用域
沿用S01标准scope：
- product
- parent_product
- sku
- account
- store
- global

S02不假设每个问题都必须绑定单ASIN。

## 正式调用位置
```text
S01 passed / passed_with_warnings
↓
S02 ContextLoading
↓
识别问题与决策依赖
↓
规划上下文域
↓
读取数据 / 历史 / 状态 / 目标 / Agent结论 / 知识 / 当前任务
↓
检查新鲜度、窗口、背景与缺口
↓
形成 ContextPackage
↓
ready / ready_with_gaps
→ 状态识别 / 必要指标与知识匹配 / S03

needs_information
→ 补数据后重跑S02

blocked
→ 暂停决策链
```

## 十个标准上下文域
- C01 产品身份
- C02 当前经营状态
- C03 当前经营目标
- C04 当前核心指标
- C05 经营事件与活动
- C06 产品历史
- C07 专业Agent结论
- C08 市场与竞品
- C09 经营知识
- C10 当前任务与限制

## ContextPackage唯一事实源
S02输出的`context_package`是S03-S06以及Agent-1后续推理的**唯一权威上下文事实源**。

后续如果为了性能生成：
- current_goals
- business_state
- constraints
- agent_analyses
- active_tasks

这些只能是ContextPackage的派生视图，不得形成第二套独立值。

## 核心原则
1. 先定义问题，再装载数据；
2. P0/P1优先于P2/P3；
3. 数据源失败不等于指标为0；
4. 活动期、正常期、断货期、改版期等必须区分；
5. 旧Agent结论必须检查freshness；
6. 无历史、无知识匹配不等于系统错误；
7. 缺失信息只有在可能改变决策时才值得优先补；
8. 不把“未知”包装成“已知”。

## 输出状态
- ready
- ready_with_gaps
- needs_information
- blocked

## 不负责
S02不负责：
- 最终经营状态裁决；
- 冲突解决；
- 方案生成；
- 风险评估；
- 最终决策；
- 执行经营动作。

## 与S03接口
S03正式消费：
- event_id
- scope
- context_package
- context_refs（可选）
- normalized_elements（可选派生视图）

## 当前版本
- 业务规则：V1.x冻结候选；
- 接口：V1.1，已正式承接S01 normalized_event并确立ContextPackage唯一事实源；
- 执行程序：待系统运行层实现ContextPlanner / Retriever / Validator / Compressor / Packager。