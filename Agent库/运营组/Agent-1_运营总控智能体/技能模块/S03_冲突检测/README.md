# S03｜冲突检测

## 技能定位
S03 接收 S02 形成的最小充分上下文，把其中的事实、分析、目标、任务、策略和约束标准化为可比较的“冲突元素”，识别真正会影响 Agent-1 决策的矛盾。

S03 不是“找不同”，而是判断：哪些信息不能同时成立、哪些动作不能同时执行、哪些目标存在张力，以及这些冲突是否足以改变决策。

## 调用位置
```text
S02 上下文装载
↓
上下文标准化
↓
S03 冲突检测
↓
冲突聚类与根因识别
↓
判断 decision_impact
├─ none / confidence_only → 可继续
├─ changes_ranking → 带冲突进入S04
├─ blocks_decision → 先补决定性证据
└─ requires_escalation → 升级复核/审批
```

## 冲突元素
进入检测前，将上下文尽量标准化为：
- `element_id`
- `element_type`：fact / analysis / recommendation / decision / task / constraint / hypothesis
- `source`
- `subject`
- `topic_or_metric`
- `value`
- `time_window`
- `as_of`
- `confidence`
- `goal`
- `action_direction`
- `status`

## 正式冲突类型
S03 V1.1 使用七种底层冲突类型：
1. `fact`：事实值、来源、口径、对象、时间不一致；
2. `interpretation`：事实基本一致，但原因解释或假设不同；
3. `goal`：增长、利润、库存、安全等优化目标存在张力；
4. `task`：两个任务无法同时执行或存在资源/依赖互斥；
5. `strategy`：新旧策略方向相反，且是否应反转尚未确认；
6. `time_horizon`：短期收益与中长期资产/目标冲突；
7. `constraint`：建议触碰硬约束、权限、审批、合规或经营底线。

> Agent 不再作为冲突类型。Agent 是冲突参与方，通过 `involved_agents` 记录。Agent-4 与 Agent-7 意见不同，真正原因仍应归入 goal、fact、strategy 等底层类型。

## 冲突严重度
- `critical`：涉及合规、不可售、硬约束、重大不可逆动作，或核心事实无法确认；
- `high`：很可能改变最终方案或任务方向；
- `medium`：影响判断质量或置信度，但通常可以继续；
- `low`：记录即可，不明显影响当前决策。

## 决策影响等级
严重度描述“冲突本身有多严重”；`decision_impact` 描述“它对当前决策造成什么影响”。

- `none`：不影响当前决策；
- `confidence_only`：只降低置信度；
- `changes_ranking`：可能改变S04排序或方案排名；
- `blocks_decision`：不解决就不能可靠继续；
- `requires_escalation`：需要人工/更高权限/专业复核。

## 冲突聚类
多个表面冲突可能来自同一个经营矛盾。S03 应使用：
- `conflict_group_id`
- `root_conflict`
- `related_conflicts`

例如“Agent-4建议扩量、Agent-6提示利润压力、Agent-7提示库存不足”可能共同属于：`增长目标 vs 当前资源承受能力`。

## 输出
每个冲突至少包含：
`conflict_id`、`conflict_group_id`、`type`、`involved_agents`、`parties`、`subject`、`shared_facts`、`disputed_points`、`root_conflict`、`evidence_needed`、`severity`、`decision_impact`、`resolution_status`、`recommended_next_step`。

整体状态：`clear / conflicts_found / needs_evidence / blocked`。

## 与S10的边界
- S03：发现“新旧策略打架”，说明冲突是什么、影响多大；
- S10：判断新证据是否足以提前推翻旧策略，决定 allow / hold / merge / escalate / override。

S03 不直接裁决观察窗口内是否反转策略。

## 不负责
S03 不负责：
- 用多数投票解决冲突；
- 平均多个Agent结论；
- 固定某个Agent拥有最高业务优先权；
- 生成最终经营方案；
- 决定最终优先级；
- 直接覆盖旧策略。

## 核心原则
冲突不是系统故障。真正危险的是系统没有发现冲突，却把局部正确当成整体正确。

## 当前版本
V1.1：已加入冲突元素标准化、Agent参与方模型、decision_impact、冲突聚类与根冲突结构。