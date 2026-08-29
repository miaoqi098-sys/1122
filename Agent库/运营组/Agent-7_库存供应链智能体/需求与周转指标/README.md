# 需求与周转指标

## 定位
本模块定义 Agent-7 用于库存覆盖、周转和补货判断的需求侧指标。所有指标必须绑定时间窗、scope、数据成熟度与异常活动标记。

## 核心指标
- `sales_velocity`：单位时间销量；
- `weighted_sales_velocity`：近期加权销量；
- `days_of_cover` / DOH：库存覆盖天数；
- `inventory_turnover`：库存周转；
- `sell_through_rate`：售罄/消化速度；
- `aged_inventory_ratio`：库龄库存占比；
- `stockout_days`：断货天数；
- `lost_supply_days`：因库存不可售或接收异常造成的供给损失天数；
- `demand_volatility`：需求波动程度；
- `forecast_error`：历史预测与实际销量偏差。

## 销售速度
默认不得只使用单一7日均值。建议至少同时保存 7/14/30 日窗口，并标记：
- 促销日；
- 广告异常扩量；
- 断货/低库存日；
- Listing不可售或购物车异常日；
- 节假日/季节性。

被供给约束的销量不能直接作为真实需求上限。

## 库存覆盖天数
基础表达：`effective_sellable / normalized_daily_demand`。

未来供给覆盖可另算：
`(effective_sellable + qualified_inbound + qualified_upstream) / normalized_daily_demand`。

必须分别输出当前覆盖和未来覆盖，不能混为一个数字。

## 周转与库龄
周转快不一定代表库存健康；若库存过低可能意味着断货风险。库龄高也不自动等于应清仓，需要结合利润、季节性和未来需求，由Agent-6/8/10/1协同判断。

## 数据异常
当销量窗口内存在断货、重大促销、价格突变或广告扩量时，需求基线必须标记 `distorted=true`，补货模型不得直接机械使用。
