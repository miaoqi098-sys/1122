# Agent-4｜监控与诊断范围

## 1. 定位
Agent-4负责广告系统内部的异常、机会与结构性问题诊断。诊断结论必须基于统一广告实体、指标口径、时间窗口和证据引用，不直接替代Agent-1的最终经营决策。

## 2. 诊断对象
- campaign / ad_group / ad / target / search_term；
- Sponsored Products / Sponsored Brands / Sponsored Display；
- keyword、product targeting、auto targeting及其搜索词表现；
- bid、budget、placement、status、serving与流量分配。

## 3. 六类核心诊断域
### A. 流量获取
关注 impressions、clicks、CTR、top-of-search/placement exposure、流量集中度。典型问题：曝光不足、点击不足、点击异常增长、流量过度集中、优质流量缺失。

### B. 成本效率
关注 spend、CPC、ACOS、ROAS及其趋势。典型问题：CPC抬升、花费增长但销售不增长、高消耗低产出、低效目标持续吞预算。

### C. 广告转化
关注 attributed_orders、attributed_sales、广告CVR。典型问题：高点击无订单、CVR显著下降、订单集中于少量搜索词/target、广告转化与Listing整体转化方向冲突。

### D. 预算与投放节奏
关注 budget utilization、budget cap、日内耗尽、预算闲置、预算向低效实体倾斜。诊断只说明广告侧现象；是否追加总预算需结合Agent-6利润、Agent-10促销和Agent-1目标。

### E. 广告结构健康度
关注实体冗余、同词内耗、重复target、混合意图、变体混投、不同生命周期/目标被混在同一组、测试与成熟流量未隔离。

### F. 搜索词与Target质量
关注search_term与target映射、匹配方式、迁移机会、否定机会、意图漂移、低相关点击、优质搜索词未沉淀。

## 4. 诊断状态
每个问题至少标记：
- status: observed / suspected / confirmed / recovering / resolved；
- severity: info / low / medium / high / critical；
- confidence: low / medium / high；
- current_window；
- baseline_window；
- evidence_refs；
- affected_entities；
- metric_deltas；
- possible_causes；
- excluded_causes；
- recommended_next_check。

## 5. 证据门槛
不得仅凭单一指标直接下原因结论。例如：
- ACOS升高不等于竞价过高；需同时检查CPC、CVR、搜索词结构、归因销售和时间窗口；
- 点击增加不等于流量改善；需检查相关性、CVR和订单质量；
- 预算耗尽不等于必须加预算；需先判断耗尽部分是否有效率。

## 6. 短期波动与结构性问题
- 短期波动：窗口短、样本不足、无稳定基线，只能输出观察/疑似；
- 结构性问题：跨多个窗口持续、证据稳定、可定位到实体或流量来源，可升级为confirmed；
- 策略变更后必须留观察窗口，避免变更后立即反向操作。

## 7. 跨Agent升级
- 总流量/自然流量结构 → Agent-5；
- 利润承受能力/边际利润 → Agent-6；
- 库存约束 → Agent-7；
- Listing整体转化 → Agent-9；
- 促销与价格影响 → Agent-10；
- 增长扩量机会 → Agent-13；
- 多目标冲突与最终优先级 → Agent-1。

## 8. 输出原则
诊断输出是“广告专业判断 + 证据 + 建议动作候选 + 风险/观察窗口”，不得伪装为FinalDecision。