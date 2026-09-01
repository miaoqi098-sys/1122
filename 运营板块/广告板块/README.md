# 广告板块

运营二级中心，负责自有 Amazon 广告的结构、流量、花费、转化与受控优化。

## 当前三级结构
- 广告总览
- Campaign / Ad Group
- Keyword / Targeting
- Search Term
- Budget / Bid / Placement

## 主要数据源
Amazon Ads API（独立于 SP-API）。

## 主要 Agent
Agent-4 广告智能体；跨域最终经营决策仍由 Agent-1 输出。

## 当前状态
Ads API 已递交申请，当前页面只展示结构和接入状态，不使用模拟广告数据。

## 页面入口
`运营驾驶舱 → 广告中心 → 对应三级页面`

未来竞价、预算、暂停关键词、否定词、Campaign 状态变更等动作必须通过 Task Center 执行。
