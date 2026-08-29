# 机会对象与分类模型

## 目标
把“增长机会”定义成可验证、可约束、可追踪的对象，而不是泛化的建议或灵感。

## 一级机会类型
- `TRAFFIC_EXPANSION`：新增关键词/流量入口/搜索可见性；
- `ADVERTISING_EFFICIENCY`：广告结构、词路或预算存在可验证增量空间；
- `CONVERSION_LIFT`：内容/页面/购买体验存在转化提升机会；
- `PRICING_PROMOTION`：价格/促销窗口可能带来增量；
- `MARKET_TREND`：市场上升、季节窗口或结构变化带来的机会；
- `INVENTORY_UTILIZATION`：库存结构允许扩量、清理或更优承接；
- `MARGIN_EXPANSION`：成本、价格或组合使利润改善；
- `EXPERIENCE_RECOVERY`：解决VOC问题后恢复转化/复购/评价；
- `CROSS_DOMAIN_SYNERGY`：多个专业域组合才能释放的机会；
- `OTHER_VALIDATABLE_GROWTH`：其他可验证增长假设。

## 标准机会对象
- opportunity_id；
- opportunity_type；
- scope；
- hypothesis；
- source_signals；
- evidence_refs；
- expected_impact；
- confidence；
- feasibility；
- urgency/window；
- estimated_effort；
- dependencies；
- constraints；
- required_agent_inputs；
- validation_plan；
- status；
- invalidation_conditions。

## 生命周期
`candidate → evidence_gathering → qualified → proposed → testing → validated / rejected / inconclusive → scaled / closed`

## 原则
机会必须能被验证或证伪；“销量要增长”“广告要优化”这类抽象目标不是机会对象。一个机会若没有清晰scope、证据、假设和验证方式，不得升级qualified。
