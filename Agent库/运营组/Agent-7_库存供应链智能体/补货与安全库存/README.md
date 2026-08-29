# 补货与安全库存

## 定位
本模块定义库存补货判断的框架规则。Agent-7 可以计算补货需求、补货窗口和安全库存区间，但不直接创建采购单或调拨单。

## 核心概念
- `lead_time_days`：从下单到库存真正可售的总供应周期；
- `review_period_days`：补货复核周期；
- `safety_stock`：用于吸收需求和供应波动的安全库存；
- `reorder_point`：触发补货评估的库存位置；
- `target_cover_days`：期望补货后的库存覆盖天数；
- `qualified_inbound`：满足到货时间和可信度条件、可计入未来供给的在途库存。

## 供应周期拆解
总lead time不得只用一个固定数字，应拆成：
`采购确认 → 生产/备货 → 国内运输 → 出口/清关 → 头程 → 入仓预约 → FBA接收 → 可售`

每一段允许独立记录：计划值、实际值、P50/P90、最近异常。

## 补货点
基础框架：
`reorder_point = expected_demand_during_lead_time + safety_stock`

其中需求必须使用校正后的需求基线，不能直接使用被断货、促销、广告突发扩量扭曲的销量。

## 安全库存
安全库存必须考虑：
- 需求波动；
- 供应周期波动；
- 供应商稳定性；
- 旺季/节假日；
- FBA接收不确定性；
- 业务风险偏好。

默认不得永久固定一个“安全库存天数”；应保留计算依据和版本。

## 补货建议输出
- scope / sku / asin；
- current_sellable；
- qualified_inbound；
- demand_baseline；
- lead_time_assumption；
- safety_stock；
- reorder_point；
- recommended_order_window；
- recommended_quantity_range；
- expected_cover_after_arrival；
- risk_if_delay；
- assumptions；
- confidence。

## 抑制条件
以下情况不得直接给确定性补货数量：
- 需求基线严重失真；
- 供应周期数据过期；
- 当前在途状态不可信；
- 价格/促销/广告计划会显著改变需求但尚未确认；
- 存在产品下架/合规/生命周期重大变化。

此时应输出 `needs_information` 或区间建议，并向 Agent-1 升级。
