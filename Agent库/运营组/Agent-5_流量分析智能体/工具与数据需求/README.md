# Agent-5｜工具与数据需求

## 1. 核心数据需求
需要产品流量、搜索Query、来源结构、排名/可见性、会话及外部来源等数据。优先来源包括Amazon业务报表、Brand Analytics/Search Query Performance、搜索词/排名工具、可识别站外来源和内部历史快照。

## 2. 读取能力
- 按marketplace/product/query/window读取流量与搜索可见性；
- 读取organic/paid/other来源结构；
- 读取历史排名/份额/曝光/点击；
- 读取商品状态、价格促销、广告和竞品上下文引用；
- 识别数据延迟、采样和定义变化。

## 3. 数据合同
所有数据包至少带source_ref、source_system、generated_at、data_window、timezone、definition_version、sampling_method、freshness、completeness、missing_fields。

## 4. 降级
若来源无法精确拆分则保留unknown；排名来源不一致时不得拼接趋势；Query数据缺失时不能输出精细关键词机会；外部流量无法可靠归因时只标estimated。

## 5. 运行依赖
复用R04 Amazon SP-API Connector、R03 Schema Validator、R06长期记忆数据库；若未来Brand Analytics/Search Query Performance需要独立连接能力，应在运行层统一扩展数据接口而非在Agent-5内实现。