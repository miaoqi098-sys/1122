# Agent-5｜流量归因与原因树

## 1. 目的
把“流量涨了/跌了”拆成可验证的原因分支，避免把相关性当因果。Agent-5负责组织原因树和证据，不越权替其他专业Agent确认其域内根因。

## 2. 一级原因分支
### A. 市场需求变化
搜索需求、季节性、趋势、类目热度变化。专业确认：Agent-8。

### B. 搜索可见性变化
自然排名、Query份额、搜索曝光位置、索引/相关性变化。Agent-5负责流量侧证据，Listing相关性需Agent-9补充。

### C. 广告流量变化
广告覆盖、预算、竞价、Search Term结构变化。专业确认：Agent-4。

### D. 商品状态与可售性
不可售、购物车、配送承诺、价格显示、变体状态等。专业确认：Agent-2；库存原因交Agent-7。

### E. 价格与促销
售价、Coupon、Deal、参考价、促销窗口变化影响CTR和流量获取。专业确认：Agent-10。

### F. Listing内容与承接
主图、标题、A+、评价展示等影响点击与转化。专业确认：Agent-9/Agent-11。

### G. 竞争变化
竞品价格、促销、排名、内容、广告/份额变化。专业确认：Agent-3。

### H. 外部流量变化
站外活动、达人、社媒、联盟等入口变化；若数据不足保持estimated/unknown。

### I. 数据异常
报表延迟、采样变化、来源定义变化、缺失字段、时间区间错误。

## 3. 原因状态
每个cause_candidate记录：cause_type、status(suspected/confirmed/excluded)、confidence、evidence_refs、counter_evidence_refs、owner_agent、next_check。

## 4. 归因规则
- 一次变化可以有多个原因，不强制单一根因；
- 先检查数据异常和重大断点，再分析渐进性原因；
- 不能仅因时间上同时发生就认定因果；
- 若某原因需要其他Agent确认，保持suspected并生成cross_agent_request；
- 已排除的原因保留证据，避免后续重复排查。

## 5. 结束条件
当主要流量变化能够被一个或多个已确认原因解释、剩余不确定性被记录且不影响当前决策时，原因树可标记resolved_for_current_decision；不要求理论上解释100%的流量波动。