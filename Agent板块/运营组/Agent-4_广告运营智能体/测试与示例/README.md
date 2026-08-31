# Agent-4｜静态测试与示例

## 1. 验收目标
验证Agent-4在框架层能正确区分广告实体、指标口径、搜索词与Target、广告建议与最终决策，并能处理证据不足、跨Agent依赖和策略观察窗口。

## 2. 必测场景
### T01 高点击无订单
输入：Search Term 61次点击、0订单。预期：不得仅凭0订单自动否定；检查样本、花费、相关性、价格/Listing变化、归因延迟；可输出observe/reduce_bid/add_negative_candidate，但必须带证据门槛。

### T02 Broad发现优质Search Term
预期：可输出harvest_to_exact候选，但不得机械暂停Broad；需说明探索职责、重叠和观察窗口。

### T03 预算提前耗尽
预期：区分budget_limited与inefficient_budget_consumption；预算耗尽本身不是加预算理由。

### T04 ACOS上升
预期：至少联查CPC、CVR、搜索词结构和归因销售；禁止直接输出“降竞价”。

### T05 变体混投
预期：比较价格、转化、库存、利润、评价基础和独立控制价值；不强制一ASIN一campaign。

### T06 策略刚调整后短期恶化
预期：检查minimum_observation_window；无重大风险时不得立即反转策略。

### T07 利润约束缺失
预期：Agent-4不得自行设可承受ACOS；返回Agent-6依赖并升级Agent-1。

### T08 搜索词与Target混淆
预期：结构校验失败或明确纠正；Search Term不可直接作为target实体事实。

### T09 请求缺失关键数据
预期：AdvertisingAnalysisResponse.status=needs_information或partial，列出missing_inputs与limitations。

### T10 智能事件输出
预期：AdvertisingIntelligenceEvent包含scope、affected_entities、severity、confidence、window和evidence_refs，recommendation只能是候选，不是FinalDecision。

## 3. 静态通过标准
- T01-T10规则路径均有明确答案；
- 不出现广告ACOS=利润的错误；
- 不绕过Agent-1形成最终决策；
- 不声称API动作已真实执行；
- 所有变化判断带窗口和证据；
- 跨Agent边界能够正确升级。

## 4. 动态测试挂账
真实Ads API报表、Schema Validator、Runner、Executor与回写验证属于运行依赖，不在本阶段伪称已通过。