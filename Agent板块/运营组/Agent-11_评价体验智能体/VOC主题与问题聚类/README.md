# VOC主题与问题聚类

## 目标
把评论、Q&A、退货原因和反馈文本归一为稳定的消费者体验主题，并识别主题是偶发、持续还是恶化。

## 一级主题
- 产品质量/耐用性；
- 尺寸/适配/兼容性；
- 功能表现；
- 易用性/操作；
- 外观/颜色/材质感知；
- 配件/缺件；
- 包装/运输损坏；
- 配送/履约；
- 内容与实际预期差异；
- 安全/气味/过热/伤害等风险主题；
- 售后/退款体验；
- 其他。

## 聚类字段
- theme_id；
- parent_theme；
- subtheme；
- keywords/examples；
- affected_variations；
- first_seen_at；
- current_share；
- trend；
- severity；
- source_mix；
- confidence。

## 聚类原则
- 同义表达归一，但保留原始证据；
- 不因单条文本自动创建长期主题；
- 变体差异明显时不得强行合并；
- 多语言文本可统一主题，但必须保留locale；
- 高风险安全/合规主题即使频率低也可提高severity并转Agent-12。

## 责任映射
- 内容预期差异 → Agent-9；
- 产品状态/履约异常 → Agent-2；
- 财务影响 → Agent-6；
- 合规/安全风险 → Agent-12；
- 最终处理优先级 → Agent-1。
