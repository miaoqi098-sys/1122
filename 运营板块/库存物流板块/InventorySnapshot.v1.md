# InventorySnapshot V1.3

## 目标

把库存从 `ProductIdentity` 的附属字段升级为独立经营对象，供库存物流中心、库存 Agent、A1 决策与 Task Center 统一使用。

## Canonical Object（规范对象）

```text
InventorySnapshot
├── snapshot_id
├── product_id
├── marketplace
├── marketplace_id
├── asin
├── seller_sku
├── fnsku
├── observed_at
├── source
├── total_quantity
├── fulfillable_quantity
├── inbound_working_quantity
├── inbound_shipped_quantity
├── inbound_receiving_quantity
├── inbound_total_quantity
├── inventory_state
└── freshness
```

## 字段说明

- `product_id`：与 ProductIdentity 的稳定关联键；
- `observed_at`：真实观察时间；
- `source`：当前为 Amazon FBA Inventory API；
- `inbound_total_quantity`：Working + Shipped + Receiving 的汇总，仅作为库存过程字段，不等于可售；
- `inventory_state`：V1.3 初期只允许 `observed`，不直接生成“缺货/安全/过量”等业务结论；
- `freshness`：当前记录数据新鲜度，后续由统一 freshness policy 计算。

## V1.3 安全边界

完整库存数量属于经营敏感数据：

- 只进入 Cloudflare KV 私有数据层；
- 不提交 Git；
- Web UI 身份认证完成前不返回 SKU / ASIN / 数量明细；
- 当前公开/未认证状态接口只允许返回：Snapshot 是否建立、记录数量、更新时间、数据源。

## V1.3 不做的事情

本阶段不直接计算：

- 库存覆盖天数；
- 预计断货日期；
- 补货数量；
- 安全库存；
- 库存健康分；
- 超龄风险。

这些必须等销售速度、补货周期、供应链约束等输入接入后再由库存专业 Agent 判断。

## 数据链

```text
Amazon FBA Inventory API
      ↓
ProductIdentity 标准化
      ↓
InventorySnapshot Builder
      ↓
Cloudflare KV
├── product-identities:US
├── inventory-snapshot:US
└── product-identity-status:US（只存聚合状态）
```

## V1.3 验收标准

1. 每个真实 ProductIdentity 可生成一个库存快照；
2. `product_id` 可追溯到同一商品；
3. Snapshot 与 ProductIdentity 分开持久化；
4. 公共状态接口只返回记录数量和时间，不返回库存数量；
5. Actions 日志不打印 SKU / ASIN / 库存单位数；
6. InventorySnapshot 能被后续库存 Agent 与 A1 复用。
