# 运营板块

负责产品进入运营阶段后的完整经营管理，是 1122 的业务工作台，不替代 Agent 决策层。

## 二级结构
- 产品板块
- 库存物流板块
- 站外推广板块
- 竞品板块
- 广告板块

产品板块三级入口：
- 流量与转化
- 价格与促销
- 利润与经营
- 消费者体验

## V2 建设原则

### 1. 运营板块是经营对象与状态入口
运营 UI 负责：
- 展示 Product / SKU / ASIN / Marketplace 等经营对象；
- 聚合销售、流量、广告、价格、库存、利润、评价等状态；
- 展示 Agent 诊断、异常事件、建议与任务；
- 向任务中心发起需要执行或审批的动作。

运营 UI 不直接承担跨域最终决策。

### 2. 数据来源分工
- Amazon SP-API：自有商品、价格、库存/FBA、订单/销售、财务等第一方经营数据；
- Amazon Ads API：自有广告 Campaign / Ad Group / Keyword / Targeting / Spend / Sales 等数据；
- Sif MCP：关键词市场、竞品、流量结构、竞品广告、ABA 与异常诊断等外部市场数据；
- 人工/内部数据：采购成本、头程、目标毛利、供应链计划、经营目标等。

### 3. Agent 分工
运营板块消费各专业 Agent 输出，由 Agent-1（运营总控智能体）负责跨域决策汇总。
典型关系：
- 商品状态 → Agent-2
- 竞品情报 → Agent-3
- 广告 → Agent-4
- 流量结构 → Agent-5
- 利润成本 → Agent-6
- 价格促销 → Agent-10
- 消费者体验 → Agent-11

### 4. 写操作边界
改价、改 Listing、调整广告竞价/预算、暂停关键词、删除 Listing 等高影响动作不得由公开运营页面直接执行。
统一链路：

```text
运营状态 / Agent 事件
  ↓
Agent-1 FinalDecision
  ↓
Task
  ↓
人工审批（需要时）
  ↓
受控 Executor
  ↓
ExecutionResult
  ↓
ValidationResult
  ↓
运营 UI / Memory 回写
```

## 当前建设阶段

Web Console V2 已统一到单一 Hash Router。运营板块与广告连接设置都在同一正式控制台中呈现，不再维护平行入口。

第一阶段以单产品作为纵向主线，将已有 `单产品纵向MVP/` 从静态对象链逐步升级到真实只读数据链；Amazon Ads 的第一批真实只读结构也已接入。

当前外部数据基础：
- Amazon SP-API：真实连接已验证；
- Sif MCP：真实连接与真实 ASIN 数据读取已验证；
- Amazon Ads API：NA 已连接，真实 Profiles = 4；当前真实 US Profile 返回 1 个 Campaign、2 个 Ad Groups；
- Email：`AUTH_REQUIRED`，尚不能记为可用连接；
- Cloudflare 数据层：D1 与 KV 可用，R2 未启用；
- Cloudflare Pages：当前采用本地手工部署。

以上状态必须分维度展示：连接成功不等于数据完整，数据返回不等于仍然新鲜，D1 可读不等于业务语义已验证，CORS 允许跨域更不等于用户已通过身份认证。

当前运营板块保持只读。Amazon Ads 仅开放 Profiles、Campaigns 与 Ad Groups 查询；预算、竞价、状态、关键词、否定词等写操作均未开放。任务中心的未来受控链路不代表当前已经具备写能力。

Cloudflare Access 或等价会话鉴权要等用户确认允许访问的身份后再配置；在此之前，不应把当前页面描述为已完成内部登录保护。
