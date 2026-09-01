# 06 指标与派生数据

派生指标必须由可追溯的原始事实计算，不能由 UI 临时拼接后成为事实来源。

## 核心目标表

`product_daily_state`

用于汇总每天每个产品的经营状态，服务：
- 7/30/90 天趋势；
- 生命周期分析；
- Agent 诊断；
- A1 决策；
- 阶段复盘。

## 计划派生指标

- Daily Sales Velocity（日均销量）
- Conversion Rate（转化率）
- Inventory Coverage Days（库存覆盖天数）
- Expected Stockout Date（预计断货日）
- ACOS / TACOS / ROAS
- Contribution Profit（贡献利润）
- Profit Margin（贡献利润率）
- Product Health Score（产品经营健康度，后续建立口径）

所有指标必须记录算法版本和依赖数据完整度。
