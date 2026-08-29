# 库存状态模型

## 目标
把“库存”拆成可用于诊断和补货的状态，而不是只看一个总库存数字。

## 核心库存状态
- `sellable`：当前可售库存；
- `reserved`：预留库存，需区分订单预留、FC转运、处理中；
- `unfulfillable`：不可售库存；
- `inbound_shipped`：已发运在途；
- `inbound_receiving`：到仓接收中；
- `inbound_working`：已建货件但尚未发运；
- `upstream_available`：海外仓/AWD/本地仓或其他上游可调拨库存；
- `production_committed`：已下单/生产中但尚未进入物流；
- `available_to_promise`：在明确假设下可用于未来承诺的库存。

## 统一计算原则
不得把所有状态简单相加当成“可卖库存”。库存总量必须同时保留：
- location；
- status；
- ownership；
- expected_available_at；
- confidence；
- source；
- last_updated_at。

## 可售库存
`effective_sellable` 默认以实际可售为主。预留、在途和上游库存只能进入未来覆盖预测，不得伪装成当前可售。

## 在途库存
在途库存必须绑定：
- shipment_id / purchase_order_ref；
- quantity；
- shipped_at；
- expected_arrival_at；
- expected_receiving_complete_at；
- latest_status；
- delay_days；
- confidence。

## 不可售与异常库存
不可售库存应区分损坏、客户退货、仓库处理、调查中等原因；原因未知时必须标记数据质量风险。

## FBA / AWD / 上游关系
若未来接入 AWD、3PL 或海外仓，Agent-7 只在确认调拨lead time与可调拨数量后，将其纳入未来供给。不同库存池必须保留独立scope，避免重复计算。

## 库存快照
标准库存快照至少包含：
- snapshot_at；
- asin / sku；
- marketplace；
- sellable；
- reserved；
- unfulfillable；
- inbound；
- upstream；
- total_physical；
- effective_sellable；
- source_refs；
- freshness；
- confidence。

## 边界
库存状态模型描述“货的事实状态”；是否补货、是否促销、是否降广告由后续诊断与 Agent-1 决策链处理。
