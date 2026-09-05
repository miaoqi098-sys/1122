# 亚马逊政策边界

## 正式定位

本板块作为 1122 的根级一级板块，专门承载 **Amazon 平台政策、Amazon 经营动作边界、Amazon 合规要求、官方政策证据、平台规则版本与变更影响**。

它与现有 `政策边界板块/` 并列但职责不同：

- `政策边界板块/`：负责 1122 系统自身的权限、安全、审批、自动化治理、敏感数据与公共运行边界。
- `亚马逊政策边界/`：负责 Amazon 平台本身规定“什么允许、什么禁止、什么受条件限制、什么需要人工复核，以及政策变化会影响哪些商品和经营动作”。

## 当前一级职责

后续内容统一归入本板块，包括但不限于：

- Listing / Detail Page 政策
- Pricing / Reference Price / Promotion 政策
- Advertising 政策
- Inventory / FBA / Removal / Disposal / Liquidation 政策
- Reviews / Customer Communication 政策
- Product Compliance / Restricted Products 政策
- Intellectual Property / Trademark / Copyright / Patent 边界
- Account Health / Performance / Enforcement 政策
- Deals / Coupons / Prime Discounts / BD 等活动政策
- Amazon API 可执行动作的业务政策限制
- Marketplace / Country / State 差异化要求
- 官方政策来源、版本、生效时间、更新时间与证据
- Policy Diff（政策变化）与商品 / ASIN / Task / Decision 的影响映射

## 核心原则

1. Amazon 官方政策事实与 1122 内部系统权限规则必须分离保存，禁止混为一套规则。
2. 平台政策只描述 Amazon 允许/禁止/限制什么，不自动授予 1122 执行权限。
3. 即使 Amazon 平台允许某动作，仍必须经过 1122 的 `Approval Gate`、`Permission Boundary` 与内部 Action Authority 控制。
4. 平台政策不明确、证据过期、存在冲突或无法确认适用范围时，必须 fail-closed，进入人工复核或补充证据流程。
5. 政策记录必须尽可能保留官方来源、版本、生效时间、适用站点、适用对象与最后验证时间。
6. 不得用模型推测替代 Amazon 官方规则；无法确认时必须标记为未知或待验证。

## 与系统链路的关系

```text
Amazon 官方政策 / Seller Central / API Docs
                    ↓
              亚马逊政策边界
                    ↓
          Policy Evidence / Policy Diff
                    ↓
      Agent-12 / Agent-1 / Decision / Task
                    ↓
              政策边界板块
      （内部权限 / 审批 / Action Authority）
                    ↓
             Permission Boundary
                    ↓
                 Executor
```

本板块本身不执行 Amazon 写操作，也不直接授予生产权限。
