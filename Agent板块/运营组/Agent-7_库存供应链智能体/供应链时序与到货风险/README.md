# 供应链时序与到货风险

## 目标
把供应链从一个“预计到货日”拆成可审计的时序链，识别延迟到底发生在哪一段，并判断是否会穿透安全库存。

## 标准时序链
`采购确认 → 生产/备货 → 出库 → 国内运输 → 报关/清关 → 国际运输 → 到港/提货 → FBA预约 → 入仓 → 接收 → 可售`

## 每段至少记录
- planned_start / planned_end；
- actual_start / actual_end；
- expected_end；
- status；
- delay_days；
- source；
- confidence；
- exception_reason。

## 风险类型
- 供应商延迟；
- 生产延期；
- 舱位/运输延迟；
- 清关异常；
- FBA预约推迟；
- 到仓接收异常；
- 货件数量差异；
- 部分到货；
- ETA反复变化；
- 物流信息长时间无更新。

## 风险传播
任何环节延迟都必须重新计算：
- expected_available_at；
- stockout_date；
- gap_days；
- safety_stock_consumption；
- 是否需要请求Agent-1调整广告/促销/价格节奏。

## ETA可信度
ETA必须带 `confidence`。历史供应周期偏差大、物流状态长时间不更新、首次供应商或旺季时应降低置信度，并优先使用区间而非单点日期。

## 升级
若预计到货时间晚于预计断货时间，形成高优先级库存事件；若影响促销/广告计划，向Agent-1升级并请求Agent-4/10提供当前计划信息。
