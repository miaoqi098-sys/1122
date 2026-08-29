# Agent请求协议

## 目的
统一 Agent-1 向专业 Agent 发起分析请求时的内容结构，避免出现“帮我看看广告”“分析一下库存”这类不可执行的模糊请求。

## 一、标准请求字段
每次正式请求至少应包含：
- request_id：请求唯一编号；
- requester：固定为 Agent-1；
- target_agent：目标专业 Agent；
- product_id：ASIN/SKU/父体等对象；
- question：需要回答的核心问题；
- business_state：当前经营状态摘要；
- current_goal：当前主目标；
- known_facts：已确认事实；
- data_window：本次应使用的时间窗口；
- required_fields：必须返回的字段或分析项；
- decision_dependency：这项分析会影响什么决策；
- urgency：普通 / 高 / 紧急；
- requested_at：请求时间。

## 二、推荐附加字段
- previous_conclusion：已有旧结论及时间；
- conflicts：当前已知冲突；
- assumptions_to_test：需要验证的假设；
- constraints：库存、利润、价格、合规等限制；
- deadline：决策窗口；
- source_data_refs：数据来源或记录引用。

## 三、请求模板
```json
{
  "request_id": "REQ-2026-001",
  "requester": "Agent-1",
  "target_agent": "Agent-4",
  "product_id": "ASIN-XXX",
  "question": "判断核心Exact词30点击0订单是否应暂停、降价或继续观察",
  "business_state": ["成长期", "关键词测试期"],
  "current_goal": "保留高价值关键词资产的同时控制无效广告损失",
  "known_facts": [
    "该词自然排名首页第2位",
    "Exact广告30点击0订单"
  ],
  "data_window": "最近14天，并对比前14天",
  "required_fields": [
    "CPC",
    "广告位置",
    "Search Term相关性",
    "历史转化",
    "广告花费",
    "建议动作与置信度"
  ],
  "decision_dependency": "决定Exact是否继续投放",
  "urgency": "普通"
}
```

## 四、专业Agent返回要求
专业 Agent 返回至少应包含：
- request_id；
- source_agent；
- analysis_scope；
- facts；
- interpretation；
- conclusion；
- recommendation；
- confidence；
- data_window；
- missing_data；
- risks；
- valid_until 或建议复核时间。

如果专业 Agent 无法可靠回答，应明确返回“证据不足”，不得填补不存在的数据。

## 五、请求粒度
一次请求原则上只围绕一个明确经营问题。

不推荐：
> 全面分析这个产品所有广告问题。

推荐：
> 判断过去14天 Broad 活动是否仍具有探索价值，并输出应保留、降价、暂停和拉Exact的Search Term。

## 六、批量请求
当多个产品或关键词使用相同问题结构时，可以批量请求，但必须：
- 保留对象级结果；
- 不用总平均掩盖个体差异；
- 每个对象都能追溯到原始数据。

## 七、紧急请求
出现账户级风险、Listing冻结、已断货等强事实时，可以缩短普通协作流程，直接向对应 Agent 发起高优先级请求。

紧急不等于降低事实要求；只是减少非必要等待。

## 八、请求去重
在发起新请求前检查：
1. 是否已有同问题的新鲜结论；
2. 数据是否发生实质变化；
3. 当前状态是否改变；
4. 新请求是否能带来新的决策价值。

若没有，应复用已有结果，而不是重复调用。

## 核心原则
Agent请求不是聊天，而是结构化专业委托。一个好的请求必须让专业 Agent 清楚知道：当前发生了什么、要回答什么、用什么窗口、哪些字段必须返回，以及这个结论最终会影响什么经营决策。