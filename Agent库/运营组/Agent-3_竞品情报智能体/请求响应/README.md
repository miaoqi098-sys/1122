# Agent-3｜Agent-1请求响应接口

## 1. 输出合同
Agent-1定向请求由Agent-3返回：
`Agent-1_运营总控智能体/输入规范/专业Agent结果.schema.json`

固定 `source_agent=Agent-3`。

## 2. 典型请求
- 某ASIN当前主要直接竞品是谁，依据是什么；
- 某竞品最近价格/促销/Listing发生了什么；
- 某关键词上竞争实体结构是否变化；
- 某竞品变化是单次噪声还是持续信号；
- 某竞争信号的证据、置信度和缺失信息是什么；
- 某竞品是否应继续留在观察池。

## 3. analysis_scope至少说明
- marketplace；
- 我方scope；
- competitor_entity_ids或筛选规则；
- keyword/category context（如适用）；
- data_window；
- comparison_baseline。

## 4. 事实与解释分离
`facts`只放可追溯事实；`interpretation`放Agent-3的竞争解释；`conclusion`做专业结论；`recommendation`可选且不是FinalDecision。

## 5. status
- answered：证据足够；
- answered_with_gaps：可回答但存在缺口；
- insufficient_evidence：无法形成可靠结论；
- blocked：数据源/实体映射/关键前置不可用。

## 6. 请求越界
如果请求实质是：
- “要不要降价” → Agent-10/Agent-1；
- “这个趋势是不是类目趋势” → Agent-8；
- “该怎么改Listing” → Agent-9；
- “评论痛点是什么” → Agent-11；
- “最终要不要做这个增长动作” → Agent-13/Agent-1。

Agent-3返回已有竞争事实，并明确建议转交，而不是越权代答。