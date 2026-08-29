# 监控与诊断范围

## 核心异常类型
1. `RATING_DROP`：评分显著下降；
2. `NEGATIVE_REVIEW_SURGE`：低星评论速度异常上升；
3. `NEW_VOC_THEME`：出现新的高频体验主题；
4. `VOC_THEME_WORSENING`：既有问题持续恶化；
5. `RETURN_RATE_SPIKE`：退货率显著上升；
6. `REFUND_REASON_SHIFT`：退款原因结构变化；
7. `VARIATION_EXPERIENCE_GAP`：特定变体体验显著更差；
8. `EXPECTATION_MISMATCH`：内容与实际体验预期差异；
9. `SAFETY_EXPERIENCE_SIGNAL`：安全/伤害/过热/异味等风险主题；
10. `REVIEW_ANOMALY_SIGNAL`：评价时间/文本等出现异常模式；
11. `EXPERIENCE_IMPROVEMENT`：修复后体验主题明显改善；
12. `DATA_QUALITY_RISK`：评论/退货/变体归属数据不足。

## 诊断顺序
- 检查评分与星级分布变化；
- 检查评论速度与销量背景；
- 聚类VOC主题；
- 检查变体差异；
- 检查退货/退款成熟数据；
- 请求Agent-9检查内容预期；
- 请求Agent-2检查商品/履约状态；
- 高风险安全/异常评价信号转Agent-12；
- 需要跨域处理时上报Agent-1。

## 输出要求
记录scope、时间窗、基线、主题、严重度、频率、变体、原始证据、潜在责任域、置信度和建议验证方式。

## 禁止事项
- 不因一条差评认定产品存在系统性缺陷；
- 不因短期评论集中就认定评价操纵；
- 不把所有退款都归因产品质量；
- 不删除冲突证据或只选支持当前观点的评论。
