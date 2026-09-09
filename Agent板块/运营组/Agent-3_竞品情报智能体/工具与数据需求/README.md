# Agent-3｜工具与数据需求

## 1. 数据需求
- 竞品商品详情页事实：标题、图片、价格、促销、变体、评分等；
- 搜索结果/类目可见性：关键词、位置、广告标记、观察时间；
- 竞品历史快照；
- 我方产品scope与关键词/类目关系；
- 合法第三方竞争数据及其来源、口径、更新时间；
- 人工指定竞品与关系依据。

## 2. 数据合同
每条事实至少保留：source_ref、source_type、observed_at、marketplace、scope/context、freshness、confidence或quality标记。估算/代理值必须显式标记，不能伪装为官方事实。

## 3. 工具能力需求
- 前台商品页读取；
- 搜索结果/类目页面采集；
- 结构化解析与标准化；
- 历史快照存储与读取；
- 差异比较；
- 竞品关系索引；
- 定时复核；
- Schema验证。

## 4. 降级
数据源不可用时：优先使用最近有效快照并标记stale；若已超出可用窗口则返回unknown/insufficient_evidence，不自动补值。

## 5. 当前运行依赖
- R02 Agent Runner
- R03 Schema Validator
- R06 长期记忆数据库
- R07 调度器
- R12 前台商品页状态采集与监控
- R13 竞品搜索与竞争情报采集（新增）

SIF 连接层已实现独立的竞品关键词研究链，包括批量 ASIN、分页流量词、D1 词库与来源追溯；该链目前是 Agent-3 的事实输入，不代表通用 CompetitorIdentity、CompetitorSnapshot、CompetitorEvent 或 Agent-3 自动投递已经运行。
