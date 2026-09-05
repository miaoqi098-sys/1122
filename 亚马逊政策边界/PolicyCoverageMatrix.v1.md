# Amazon Policy Coverage Matrix V1

状态定义：

- `DISCOVERY`：已进入官方来源发现阶段，不代表政策已完整对接。
- `SEEDED`：已取得至少一条可验证 Amazon 官方来源，但该 Domain 仍可能缺少子政策。
- `VERIFIED`：来源、版本、Marketplace、适用范围和关键规则已经完成证据化验证。
- `CONFLICT`：官方证据之间存在冲突，必须人工复核。
- `UNKNOWN`：当前没有足够官方证据。

| Domain | 当前状态 | 首批对接范围 | Expected State 来源 |
|---|---|---|---|
| Review | SEEDED | Customer Product Reviews / review manipulation | Amazon official policy/help/official announcement |
| Variation | SEEDED | variation relationship / creation / updates | Amazon official help |
| Catalog | DISCOVERY | ASIN creation / detail page / catalog contribution | Amazon official help |
| Offer | DISCOVERY | offer eligibility / offer state | Amazon official help/API docs |
| Featured Offer | DISCOVERY | Featured Offer eligibility/state | Amazon official help/API docs |
| Pricing | SEEDED | List Price / Was or Typical Price / reference price / price history | Amazon official policy/announcement |
| Promotion | SEEDED | Deals / coupons / price discounts / promotion quality / stacking | Amazon official policy/help/announcement |
| Advertising | SEEDED | global ad policy / restricted-prohibited / claims / moderation | Amazon Ads official policy |
| Search | DISCOVERY | search/indexing discoverability policy-facing states | Amazon official help/API docs |
| BSR | DISCOVERY | sales rank policy-facing definitions/states | Amazon official help |
| Brand | DISCOVERY | Brand Registry / brand ownership / brand content | Amazon official help |
| Content | DISCOVERY | detail page content / claims / images / titles / A+ | Amazon official help |
| Inventory | DISCOVERY | inventory/FBA eligibility/state | Amazon official help/API docs |
| Logistics | DISCOVERY | inbound/FBA/removal/disposal/liquidation | Amazon official help/API docs |
| Returns | DISCOVERY | returns/refunds/customer return policy | Amazon official help |
| Account | DISCOVERY | seller code of conduct / account health/performance | Amazon official policy/help |
| Compliance | DISCOVERY | restricted products / product compliance / safety | Amazon official policy/help |
| Enforcement | DISCOVERY | policy violation / listing/account enforcement / appeals | Amazon official policy/help |

## 首批已验证的官方入口

### Advertising

- Amazon Ads Worldwide Ad Policies quick reference guide.
- Amazon Ads prohibited products and services across all supply.
- Amazon Ads restricted categories and content.
- Amazon Ads moderation guidance and policy change-log guidance.

### Pricing

- Amazon 2026 reference-pricing update: List Price validation changes effective 2026-04-23.
- Amazon 2026 Typical Price / Was Price calculation changes effective 2026-05-18.
- Reference-price rules must remain marketplace/version aware.

### Promotion

- Amazon promotion quality guidance: recent price history can constrain promotional pricing; current promotions can influence future promotional benchmarks.
- Deals / reference prices / stacked promotions must be represented as separate but related policy evidence, not collapsed into one inferred rule.

### Review

- Amazon official seller communication reiterates zero tolerance for customer review manipulation, including incentives for reviews and requests to change existing reviews.

### Variation

- Amazon official help entry points include variation creation/update guidance and ASIN creation policy references.

## 对接规则

1. `SEEDED` 绝不等于 Domain 已完整覆盖。
2. 每条政策必须拆成独立 `PolicyEvidence`，不得只保存网页摘要。
3. Marketplace 必须显式保存；US 规则不得静默当成全球规则。
4. 政策发布时间、生效时间、抓取时间、最后验证时间必须分开。
5. Seller Forums 只有在 Amazon 官方账号发布/回复且可验证时才可作为 `AMAZON_OFFICIAL_ANNOUNCEMENT` 证据；普通卖家帖子不得进入 Expected State。
6. 第三方博客、服务商文章、社区经验只能作为 discovery hint，不得成为 Policy Evidence。
7. 未取得完整官方规则时状态保持 `DISCOVERY/UNKNOWN`，禁止模型补齐。
8. 所有 Domain 最终都要进入 Policy Diff、Observed State comparison 与 Boundary Evidence Gate，而不是静态文档存档。
9. 本矩阵不授予任何 Amazon 写权限：`execution_authorized=false`。
