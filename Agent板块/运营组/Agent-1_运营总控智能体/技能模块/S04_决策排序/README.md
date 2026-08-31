# S04｜决策排序

## 技能定位
当同时存在多个经营问题、目标或待处理方向时，S04负责确定“先处理什么、什么可以等待、什么暂时暂停”，形成可解释、可追溯、会随经营状态动态变化的业务优先级。

S04排序的是“经营待决事项”，不是具体执行步骤。具体任务拆解、串并行和执行顺序由S07任务编排负责。

## 调用位置
```text
S03 冲突检测
↓
S04 Priority Gate
↓
标准化 decision_items
↓
业务优先级排序
↓
记录升降级原因
↓
S05 方案生成
```

## Priority Gate
进入正常P0-P3排序前先检查：
- `normal`：进入正常排序；
- `protected`：允许继续，但增长类事项受保护约束限制；
- `blocked`：存在必须先解决的硬阻断，相关事项不得继续正常竞争；
- `escalated`：需要人工、专业复核或更高权限处理。

Gate不是第五级优先级，而是排序前的经营保护机制。

## 标准决策事项 decision_item
每个待排序对象至少描述：
- `item_id`
- `item_type`
- `subject`
- `problem`
- `goal_layer`
- `severity`
- `urgency`
- `deadline`
- `state_relevance`
- `dependency_count`
- `blocked_items`
- `opportunity_window`
- `reversibility`
- `evidence_strength`
- `resource_cost`
- `conflict_refs`
- `constraint_refs`
- `previous_priority`

## 排序维度
1. Priority Gate / 硬约束；
2. 目标层级；
3. 当前经营状态；
4. 风险严重度与发生时间；
5. 目标偏离程度；
6. 机会窗口时效；
7. 依赖与阻塞影响；
8. 动作可逆性；
9. 证据强度；
10. 资源与执行容量。

## 四级业务优先级
- `P0`：必须立即处理的安全、可售、经营底线或即将造成重大损失的问题；
- `P1`：当前经营周期核心问题；
- `P2`：重要但可以等待；
- `P3`：观察项、低影响事项或机会池。

## 结构化排序依据
每个结果除了priority/rank，还必须解释：
- `priority_basis`
- `priority_factors`
- `promotion_reasons`
- `demotion_reasons`
- `goal_layer`
- `urgency`
- `dependency_impact`
- `confidence`

## 动态优先级
S04必须能够回答：为什么昨天P2，今天变成P0？

记录：
- `previous_priority`
- `current_priority`
- `priority_change`：promoted / demoted / unchanged / new
- `change_trigger`

优先级变化应来自新事实、状态变化、目标变化、风险窗口、机会窗口、依赖或资源变化，而不是模型无理由重新排序。

## 与S07的边界
S04输出 `business_priority` 和必要的阻塞/前置关系，但不负责完整执行顺序。

- S04：哪个经营问题更重要；
- S07：决定后的任务具体怎么拆、谁先做、谁并行、谁审批。

## 核心原则
优先级服务于整体经营结果，不机械套固定排序表；同一事项的优先级变化必须有可追溯触发原因。

## 当前版本
V1.1：加入标准decision_item、Priority Gate、结构化priority_basis、业务优先级与执行顺序分离、优先级变化追踪。