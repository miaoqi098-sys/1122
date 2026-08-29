# 跨 Agent 协作路由 V1.0

## 1. 核心路由
跨 Agent 协作分四类：
1. **主动事件**：专业 Agent 将异常/机会规范化为 Canonical Event，提交 Agent-1。
2. **专业请求**：Agent-1 或经授权的专业 Agent 发起定向分析请求，响应最终规范化为 Agent-1 `专业Agent结果`。
3. **依赖补证**：一个专业 Agent 发现自己的结论依赖另一个领域事实，发出明确的数据/分析请求，不直接代替对方诊断。
4. **冲突升级**：两个或更多专业结论在事实、口径、时效、目标或风险上不一致，统一升级 Agent-1。

## 2. 通用闭环
`发现问题 → 确认主责Agent → 获取必要协作证据 → 专业结论 → Canonical Event/Response → Agent-1冲突与约束检查 → FinalDecision → Task → 验证/学习`

专业 Agent 之间可以互相补证，但最终经营动作不得在旁路中形成。

## 3. 典型协作路由
### 场景A｜广告高点击无订单
- A4：确认广告实体、点击/花费/订单及搜索词事实。
- A5：如需判断整体流量结构，补充自然/付费流量变化。
- A9：如怀疑详情页承接，分析内容/转化问题。
- A6：给出可承受CPC/ACOS/利润边界。
- A7：库存紧张时提供库存约束。
- A1：决定降竞价、否词、拉Exact、改Listing、继续观察或组合动作。

### 场景B｜促销/降价计划
- A10：生成价格/促销机制、资格、叠加和活动候选方案。
- A6：核算利润与盈亏边界。
- A7：判断库存压力和活动承接能力。
- A4/A5：提供流量与广告承接上下文。
- A12：如涉及平台资格/政策，提供风险资格状态。
- A1：在销量、利润、库存、价格体系和风险之间做最终决策。

### 场景C｜评价下降驱动Listing改进
- A11：确认Rating/Review/VOC/退货体验事实和问题聚类。
- A9：把已验证体验问题映射到卖点、图片、文案和内容承接方案。
- A12：检查改文案是否引入合规风险。
- A1：决定内容调整与验证窗口。

### 场景D｜竞品与市场趋势形成增长机会
- A3：提供具体竞品变化和竞争事实。
- A8：提供类目需求、季节、价格带和外部趋势。
- A13：组合成可验证增长机会，做去重、约束、验证设计。
- A6/A7/A12：分别提供利润、库存、风险约束。
- A1：决定是否进入实验/投入资源。

### 场景E｜合规硬约束阻断候选方案
- 任一Agent产生候选动作。
- A12：返回 hard_constraint / eligibility失败及证据。
- 该候选不能因为高增长、高利润或高紧急度绕过资格门。
- A1：选择替代方案、hold、needs_information或整改路径。

### 场景F｜多Agent冲突
例如 A4 建议增加预算、A6认为利润承受不足、A7认为库存仅够7天：
- 不允许三个Agent各自下任务；
- 各自只提交领域事实/约束/建议；
- A1 S03识别冲突，S04排序，S05生成组合方案，S06风险评估，最终由DecisionSelector形成FinalDecision。

## 4. 请求最小信息
跨Agent请求至少说明：
- request_id
- requester / responder
- analysis_scope
- business_question
- evidence_refs / known_facts
- required_output
- data_window / freshness要求
- deadline或urgency（如确有必要）

禁止“帮我看看这个产品”这种无scope、无问题、无输出要求的泛请求进入自动协作链。

## 5. 协作去重
相同 scope + business_question + data_window + responder 的活跃请求优先复用/更新；只有证据窗口、问题或目标发生实质变化才新建请求。

## 6. 冲突分类
- FACT_CONFLICT：同一事实值冲突。
- DEFINITION_CONFLICT：指标/口径不同。
- FRESHNESS_CONFLICT：数据窗口/新鲜度不同。
- CAUSAL_CONFLICT：原因解释不同。
- OBJECTIVE_CONFLICT：利润/增长/库存等目标冲突。
- CONSTRAINT_CONFLICT：候选动作触及硬约束。

前四类优先补证；后两类必须由Agent-1做跨目标判断。

## 7. 防旁路规则
- 专业 Agent 不得互相批准最终经营动作。
- A13不得把“机会组合”变成资源分配决策。
- A12资格结论不得被其他专业Agent覆盖。
- A1不得把缺少专业证据的问题假装成已有专业结论。
- 所有重要协作必须保留request/event/evidence引用链。

## 8. 运行边界
本文件只定义路由。真实Agent Runner、消息队列、异步请求、超时/重试属于R02/R07等运行依赖。