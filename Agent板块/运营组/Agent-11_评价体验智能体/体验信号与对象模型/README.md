# 体验信号与对象模型

## 目标
统一消费者体验相关信号，区分“评分事实”“评论文本”“VOC主题”“退货原因”“异常评价模式”等对象。

## 核心对象
- `rating_snapshot`：当前评分与星级分布；
- `review`：单条评论及其时间、星级、文本、变体；
- `review_theme`：评论/VOC聚类主题；
- `qa_signal`：Q&A中的疑问和高频信息缺口；
- `return_reason`：退货原因；
- `refund_signal`：退款相关体验信号；
- `customer_feedback`：客服/售后/其他反馈；
- `experience_issue`：综合多个信号形成的问题对象；
- `review_anomaly_signal`：时间、文本、账号/购买标记等异常模式，仅作为风险信号。

## 标准体验信号字段
- signal_id；
- signal_type；
- scope / asin / variation；
- observed_at；
- source；
- rating（如适用）；
- text/theme；
- severity；
- frequency；
- first_seen_at；
- last_seen_at；
- confidence；
- evidence_ref。

## 体验问题对象
一个experience_issue至少记录：
- issue_id；
- theme；
- affected_scope；
- issue_type；
- severity；
- prevalence；
- trend；
- supporting_signals；
- conflicting_signals；
- potential_owner_agents；
- confidence。

## 规则
单条评论不自动形成产品结论；需要结合频率、时间、变体、退货/VOC等多证据。异常评价信号不等于违规结论。
