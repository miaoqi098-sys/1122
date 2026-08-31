# 多Agent综合场景示例｜增长机会与利润/库存/合规冲突

## 1. 输入事件
同一scope短时间内到达：
- Agent-4：广告转化改善，建议加预算；
- Agent-6：边际利润接近底线；
- Agent-7：库存覆盖仅10天；
- Agent-12：某资质文件进入复核，但尚未形成禁止销售结论。

各来源保留独立event_id/source/evidence refs，不在入口阶段把多个结论压成一句“风险最高”。

## 2. S02/S03
ContextPackage装载当前目标、利润、库存、资质、活动和StrategyChain。

S03识别：
- 增长目标与利润/库存约束冲突；
- 合规证据存在不确定性；
- 当前已有一条“稳步扩量”的StrategyChain正在观察窗口。

## 3. DecisionItem
形成一个综合经营DecisionItem，而不是让四个Agent分别下最终决策。

## 4. S04动态排序
S04根据当前目标和事实形成business_priority。

如果资质证据足以构成hard constraint，则相关Option在资格门被禁止；若尚未达到禁止条件，则不能机械地因为“合规”标签就永久压过所有其他目标。

## 5. S05/S06
可能方案：
- A：大幅加预算；
- B：小幅扩量并限制高成本流量；
- C：维持预算，等待资质/库存证据；
- D：收缩流量。

风险评估示例：
- A可能因利润/库存guardrail成为prohibited或requires_approval；
- B可能eligible_with_controls；
- C可能eligible；
- D可能与当前StrategyChain方向冲突。

## 6. S10
如果D或其他Option构成策略反转，触发S10。

若新证据不足以支持反转：`hold`。
若关键合规事实升级：可`override/escalate`，并保留旧Decision/Task历史。

## 7. DecisionSelector
示例选择B，但要求：
- 日预算增幅受控；
- 触发利润/库存stop condition即暂停扩量；
- 资质状态变化立即重新评估；
- 若动作超出Agent-1权限，进入request_approval_context/pending_approval。

## 8. 阻塞场景
若资质状态的关键事实无法从现有来源确认，DecisionSelector可返回`request_more_evidence`或`blocked`。

blocked必须记录：
- blocked_reason；
- required_information；
- resume_from；
- 相关event/decision_item/strategy refs。

不能为了“必须输出一个动作”而猜测资质结论。

## 9. 关键验收点
- 多Agent只能提供专业事件/证据，不成为多个最终决策出口；
- hard constraint与S04动态优先级分离；
- 利润/库存/合规都不被简化成永久固定排序；
- S10控制策略反转；
- approval是正式路由，不等于执行；
- blocked可以停住当前链，但不删除证据或历史。