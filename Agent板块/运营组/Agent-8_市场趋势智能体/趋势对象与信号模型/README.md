# 趋势对象与信号模型

## 目标
统一 Agent-8 的趋势对象、信号来源和证据结构，避免把单点变化误判成市场趋势。

## 趋势对象
- 类目需求；
- 关键词/搜索主题热度；
- 价格带分布；
- 产品属性/功能偏好；
- 使用场景与消费场景；
- 季节/节日需求；
- 渠道与平台活动；
- 外部事件与宏观环境；
- 新兴子类目与替代品。

## 信号类型
1. `SEARCH_SIGNAL`：搜索量、关键词热度、主题扩散；
2. `CATEGORY_SIGNAL`：类目销量/排名/流量变化；
3. `PRICE_SIGNAL`：主流价格带与折扣强度变化；
4. `CONSUMER_SIGNAL`：评价/VOC/内容话题反映的偏好变化；
5. `SEASONAL_SIGNAL`：季节、节假日与固定周期；
6. `COMPETITIVE_SIGNAL`：竞品数量、上新、促销密度变化，由Agent-3提供事实；
7. `EXTERNAL_SIGNAL`：天气、政策、社会事件、媒体热度等外部因素；
8. `SUPPLY_SIGNAL`：供给紧张/泛滥等可能影响市场表现的信号。

## 标准信号字段
- signal_id；
- signal_type；
- subject；
- scope；
- observed_at；
- time_window；
- current_value；
- baseline_value；
- direction；
- magnitude；
- source；
- freshness；
- confidence；
- evidence_ref。

## 趋势对象
一个趋势不是一个信号。趋势至少由一个或多个信号聚合，并记录：
- trend_id；
- subject；
- direction；
- start_at；
- persistence；
- breadth；
- acceleration；
- seasonality_flag；
- event_driver；
- supporting_signals；
- conflicting_signals；
- confidence。

## 原则
单一来源、单一短窗口、单次峰值默认只算候选信号，不直接升级为“确认趋势”。