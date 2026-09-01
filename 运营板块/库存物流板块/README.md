# 库存物流板块

运营二级中心，负责库存、补货、在途、FBA 仓储与物流风险。

## 当前三级结构
- 库存总览
- 补货与断货风险
- 在途与入库
- FBA 仓储与物流风险

## 当前数据基础
Amazon FBA Inventory API 已真实接入基础字段：
- total quantity
- fulfillable quantity
- inbound working
- inbound shipped
- inbound receiving

下一阶段 V1.3 将这些字段从 ProductIdentity 附属字段升级为独立 `InventorySnapshot（库存快照）`。

## 页面入口
`运营驾驶舱 → 库存物流中心 → 对应三级页面`

任何补货、移除、库存写操作未来都必须经过 Agent-1 FinalDecision 与 Task Center，不从 UI 直接执行。
