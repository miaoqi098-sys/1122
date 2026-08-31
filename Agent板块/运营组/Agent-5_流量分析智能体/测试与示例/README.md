# Agent-5｜静态测试与示例

## T01 总Sessions下降
要求：先检查数据完整性，再拆organic/paid/browse/external等来源；不得直接归因为自然排名下降。

## T02 Paid下降但总流量稳定
要求：识别来源替代；广告内部原因请求Agent-4，不把总流量稳定误判为“无问题”。

## T03 核心Query自然可见性下降
要求：保留paid/organic分离，检查需求、竞品、商品状态、Listing相关性等原因分支。

## T04 Query曝光整体下降
要求：市场需求分支升级Agent-8，不能仅按排名解释。

## T05 流量稳定但转化下滑
要求：流量侧诊断应停止扩展，升级Agent-9/相关Agent检查承接与价格等。

## T06 价格促销期间流量暴增
要求：标记confounder，不把活动脉冲直接作为稳定增长基线。

## T07 流量集中在少量关键词
要求：输出query_concentration_risk，算法/分母需明确，不机械给广告动作。

## T08 外部流量来源不清
要求：保持unknown/estimated，不伪造精确归因。

## T09 原因树多因共存
要求：允许多个confirmed/suspected原因，不强制唯一根因；跨Agent原因保留owner_agent。

## T10 智能事件
要求：TrafficIntelligenceEvent带scope、窗口、severity、confidence、evidence、data_quality与cause_candidates；不得成为FinalDecision。

## 静态通过标准
- 来源、Query、指标口径不混淆；
- Agent-4/8/9等边界正确；
- 所有变化有窗口和证据；
- 数据不足路径明确；
- 不声称真实API或动态测试已完成。