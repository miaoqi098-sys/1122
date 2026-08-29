# 评价与体验指标口径

## 核心指标
- `rating`：当前平均评分；
- `rating_distribution`：1-5星分布；
- `review_count`：累计评论量；
- `review_velocity`：单位时间新增评论数；
- `negative_review_share`：低星评论占比；
- `theme_share`：某VOC主题占比；
- `theme_velocity`：主题新增速度；
- `return_rate`：退货率；
- `refund_rate`：退款率；
- `repeat_issue_rate`：重复问题出现比例；
- `issue_severity_score`：问题严重度综合分；
- `experience_recovery`：问题在修复后的回落程度。

## 口径原则
1. 平均评分必须结合评论量和星级分布解释；
2. 新品少量评论时，不宜对单条低星过度反应；
3. 评论速度必须绑定时间窗和销量/订单背景；
4. 退货/退款存在成熟期，近期数据需标记未成熟；
5. 主题占比应区分变体、时间、语言和marketplace；
6. 评价数量变化不等同销售变化；
7. 评分下降需要区分真实体验问题、内容预期、物流履约和异常评价风险。

## 观察窗口
建议同时保留7/14/30/90日及长期基线；新品、活动期和大促需单独标记。

## 数据不足
样本量过低、评论文本不可得、退货原因模糊或变体归属不清时，降低confidence，避免生成确定性原因结论。
