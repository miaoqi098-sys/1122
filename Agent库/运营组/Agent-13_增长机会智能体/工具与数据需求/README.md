# 工具与数据需求

## 目标
Agent-13 本身不需要重新采集所有原始业务数据，而是优先消费 Agent-3 至 Agent-12 的标准事件、响应、历史基线与约束结果，再补充必要的实验/机会状态数据。

## 核心输入
- 专业Agent事件/响应与evidence refs；
- Agent-1目标系统、经营状态与当前strategy_chain；
- 财务约束、库存约束、风险eligibility；
- 市场/竞品/流量/广告/转化/价格/VOC信号；
- 已有机会对象、机会组合与历史验证结果；
- 当前任务/执行/验证状态，用于避免重复实验。

## 最低字段
- source_agent；
- source_event/response ref；
- scope；
- observed_at；
- evidence_refs；
- confidence；
- freshness；
- constraints；
- applicable_window；
- strategy_chain_id（如适用）。

## 降级规则
- 缺关键专业Agent输入：机会保持evidence_gathering；
- 风险资格未知：不得进入ready；
- 财务/库存约束过期：不得直接scale；
- 历史机会/实验状态不可得：增加重复测试风险并降低confidence；
- 多Agent对象scope不一致：先请求对齐，禁止强行合并。

## 未来工具能力
- 多Agent事件/响应聚合；
- 机会指纹去重；
- 关系图/依赖图；
- 机会portfolio比较；
- 实验状态读取；
- 历史机会检索；
- Schema验证与持久化。

## 运行依赖
主要复用R02 Agent Runner、R03 Schema Validator、R06长期记忆数据库、R07调度器、R08执行器、R09执行结果标准化、R10学习写入、R11策略链持久化。不新增独立外部数据连接器。
