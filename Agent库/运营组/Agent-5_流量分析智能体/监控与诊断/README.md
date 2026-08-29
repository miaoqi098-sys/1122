# Agent-5｜监控与诊断范围

## 1. 核心诊断域
### A. 总流量趋势
识别总曝光、点击、sessions/page views等同口径趋势，区分短期波动与持续性变化。

### B. 来源结构
识别organic、paid、browse/recommendation、external、unknown等来源占比迁移、替代、集中与失衡。

### C. Query/关键词可见性
识别核心Query曝光、点击、排名/位置、organic/paid mix和份额变化。

### D. 流量集中度
识别流量是否过度依赖少量关键词、少量来源、少量入口，评估单点风险。

### E. 流量机会
识别增长Query、新增入口、恢复性机会、来源扩展和结构优化候选。

### F. 异常断点
识别商品不可售、购物车丢失、价格异常、库存、广告停止、Listing变更、数据源异常等导致的流量断点，但根因需交对应Agent确认。

## 2. 诊断状态
- observed / suspected / confirmed / recovering / resolved；
- severity: info / low / medium / high / critical；
- confidence: low / medium / high。

每个诊断必须带current_window、baseline_window、scope、source_refs、metric_deltas、possible_causes、excluded_causes、cross_agent_dependencies。

## 3. 证据门槛
不得仅凭单日或单一指标下确定性结论。流量下降至少应检查：数据完整性、来源拆分、Query变化、广告变化、商品状态、价格/促销、Listing变化、市场需求与竞争环境。

## 4. 机会门槛
增长机会必须区分“流量增长”与“有价值增长”。Agent-5可以证明流量侧机会，但是否值得投入需Agent-1结合Agent-6利润、Agent-7库存、Agent-9转化和Agent-13增长机会判断。

## 5. 输出
Agent-5输出流量事实、结构变化、诊断、confidence、evidence_refs和跨Agent请求，不直接给出最终经营动作。