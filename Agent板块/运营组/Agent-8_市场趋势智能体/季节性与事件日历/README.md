# 季节性与事件日历

## 目标
把固定季节、节假日、平台大促和外部事件纳入趋势解释与提前准备窗口，避免临近事件才反应。

## 日历类型
- 固定节日：Christmas、Halloween、Thanksgiving、Valentine's Day等；
- 平台活动：Prime Day、黑五网一等；
- 季节：春夏秋冬、开学季、毕业季、婚礼季、露营季等；
- 类目事件：行业展会、赛事、文化事件；
- 外部事件：天气异常、政策、媒体事件等不固定事件。

## 标准事件字段
- event_id；
- event_name；
- event_type；
- region/marketplace；
- event_date或窗口；
- historical_lift；
- lead_time_before_event；
- cooldown_after_event；
- affected_categories/keywords；
- confidence；
- evidence_refs。

## 前置窗口
Agent-8不仅识别“事件正在发生”，还要给出预热窗口。例如需求高峰在12月，库存/广告/内容准备可能需要提前数周或数月。具体动作仍由Agent-1协调Agent-7/4/9/10执行。

## 季节性判断
至少对比：
- 同比同周期；
- 事件前后窗口；
- 当前趋势与历史季节曲线；
- 是否有新增外部驱动。

## 禁止事项
- 不把每年固定季节上涨误判为新增长趋势；
- 不因一次异常天气直接永久修改季节基线；
- 不用事件日历直接创建促销/补货动作。
