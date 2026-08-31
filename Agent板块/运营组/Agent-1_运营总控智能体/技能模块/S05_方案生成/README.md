# S05｜方案生成

## 技能定位
针对S04已经排序的高优先级经营待决事项，生成多个真正有实质差异、可执行、可验证并能交给S06风险评估的候选方案。

S05不是“给一个建议换三种说法”，而是把“现在要解决什么”转换为“有哪些不同路径可以走”。

## 调用位置
```text
S04 ranked decision_item
↓
S05读取问题、目标、排序依据、冲突与约束
↓
生成候选路径
↓
硬约束过滤
↓
动作原子化
↓
方案去重与差异检测
↓
形成结构化options
↓
S06风险评估
```

## 输入承接S04
S05必须知道当前方案服务于哪个S04待决事项，至少保留：
- `decision_item_id`
- `business_priority`
- `problem_definition`
- `objective`
- `goal_layer`
- `priority_basis`
- `constraints`
- `conflict_refs`
- `business_state`

不得在S05重新无理由改变S04已经确认的问题优先级。

## 正式方案类型 option_type
- `conservative`：低风险、高可逆；
- `balanced`：兼顾目标与约束；
- `aggressive`：风险可控时追求更高收益；
- `experiment`：通过小范围动作验证关键假设；
- `observe`：暂不改变策略，继续观察既定窗口；
- `information_first`：先获取决定性信息，再决定是否行动。

不要求每次六种都生成。方案数量服务于决策质量，通常2-4个；只有一个可行路径时允许只输出一个。

## 动作原子化
每个action尽量描述：
- `action_id`
- `action_type`
- `target`
- `change`
- `scope`
- `intensity`
- `duration_or_window`
- `preconditions`

“优化广告”“改善Listing”“控制成本”不属于合格原子动作，除非进一步说明对象、改变内容和范围。

## 每个方案核心字段
- `option_id`
- `option_type`
- `objective`
- `rationale`
- `actions`
- `assumptions`
- `expected_benefit`
- `cost`
- `known_tradeoffs`
- `known_risk_signals`
- `reversibility`
- `time_to_effect`
- `data_needed`
- `success_criteria`
- `stop_conditions`
- `derived_from`
- `difference_dimensions`

## 方案生成依据
方案应来自：当前事实 + 经营状态 + 当前目标 + 指标 + S03冲突 + S04排序依据 + 经营知识 + 历史经验 + 专业Agent结论 + 当前约束。

`derived_from`用于记录知识、历史、Agent、冲突和证据引用，避免方案成为无法追溯的“模型灵感”。

## 方案差异检测
方案之间至少应在一个或多个维度存在实质差异：
- `action_direction`
- `action_strength`
- `scope`
- `resource_commitment`
- `time_horizon`
- `information_requirement`
- `reversibility`

仅把竞价从-10%、-15%、-20%拆成三个方案，通常属于同一策略族，应合并为一个方案或参数区间。

## 与S06的风险边界
S05只描述已知取舍和明显风险信号：`known_tradeoffs / known_risk_signals`。

S05不负责正式风险评级、概率、审批等级、剩余风险或最终风险裁决；这些由S06完成。

## 规则
- 不生成违反硬约束的方案；
- 不为了凑数量制造重复方案；
- 明确假设，不能把假设写成事实；
- 高不确定性问题优先考虑experiment或information_first；
- 每个行动方案必须有成功标准和停止条件；
- observe也必须说明观察什么、观察到什么时候、什么条件会结束观察；
- information_first必须说明要补什么信息以及该信息如何改变决策；
- S05不得宣称某方案最终最佳。

## 核心原则
S05负责创造“真正不同的可选路径”，S06负责风险评估，大脑负责最终比较与选择。

## 当前版本
V1.1：已加入S04 decision_item承接、option_type、动作原子化、方案差异检测、方案来源追溯以及S05/S06风险边界。