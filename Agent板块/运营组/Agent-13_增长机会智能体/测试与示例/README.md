# 测试与示例

## 静态验收目标
验证 Agent-13 能从专业信号生成可验证机会、检查硬约束、去重组合机会并设计可停止实验，同时不抢占Agent-1最终决策权。

## 必测场景
1. 市场上涨+广告词高转化+库存充足+利润为正：可形成qualified扩量机会；
2. 高流量机会但库存15天后断货：存在hard inventory constraint，不得直接ready；
3. 高利润机会但Agent-12=prohibited：机会blocked；
4. Agent-4和Agent-5分别提出同一关键词扩量：按指纹去重并合并证据；
5. 促销机会与内容实验同时改变CVR：识别conflict/mutual exclusion或设计顺序；
6. 季节窗口只剩两周但需要60天补货：机会可能因依赖不可行而关闭；
7. 历史同一实验失败且条件未变：不得重复测试；
8. 实验成功但利润恶化：不能仅因订单增长标记可scale；
9. 实验期间发生大促/断货：标记invalidated/inconclusive；
10. 多个机会总分接近：Agent-13保留多维差异，由Agent-1目标系统/S04最终排序。

## 示例A｜增长词扩量
Agent-5发现自然流量缺口，Agent-4发现该词Exact转化稳定，Agent-6确认利润空间，Agent-7库存可承接，Agent-12 eligible。正确：生成一个跨域TRAFFIC_EXPANSION机会，设计小预算验证，不创建两个重复机会。

## 示例B｜旺季机会受供给限制
Agent-8确认季节上升，但Agent-7预计库存无法承接。正确：机会保留但constraint=hard/not_ready，不能因趋势强就要求立即扩量。

## 验收判定
- 机会对象可验证/证伪；
- 评分维度透明；
- 专业约束齐全；
- 指纹去重防无限任务；
- 实验有成功/停止/失效条件；
- 历史失败可防重复测试；
- 事件/响应可供Agent-1消费；
- FinalDecision仍只属于Agent-1。
