# 冲突：GitHub 公开仓与真实经营敏感数据隔离

## 基本信息

- 冲突ID：`CONFLICT-POLICY-DATA-001`
- 冲突名称：GitHub Public Repository（公开仓）与 1122 真实经营敏感数据存储需求冲突
- 当前状态：`暂缓`
- 严重级别：`P1`
- 发现日期：2026-09-01
- 发现来源：Amazon SP-API ProductIdentity V1.1 真实数据接入
- 主要问题路径：`政策边界板块/系统公共层`
- 关联路径：
  - `对外连接板块/02_1122连接亚马逊API/worker/`
  - `.github/workflows/`
  - `运营板块/产品板块/`
  - `index.html`
  - `系统冲突问题库/`

## 一、冲突描述

1122 当前 GitHub Repository（GitHub 仓库）为 Public（公开）状态，但系统已经从原型阶段进入真实 Amazon SP-API 数据接入阶段。

随着系统继续建设，后端会逐步接触以下非公开经营数据：

- Amazon LWA Client Secret（客户端密钥）
- Refresh Token（刷新令牌）
- Seller SKU / FNSKU
- ASIN 与店铺 SKU 的内部映射
- FBA 库存、在途库存、补货状态
- 广告花费、销售额、ACOS、ROAS
- 订单、财务、利润和费用数据
- 内部成本、供应链、经营目标
- 后续可能存在的任务审批、写操作凭证和审计信息

Public Repository 的所有代码、配置文件、提交历史以及大部分 GitHub Actions（自动化工作流）定义均可被外部查看，因此不能将真实经营数据或长期凭据直接写入仓库。

## 二、冲突双方

### A. 当前基础设施约束

`miaoqi098-sys/1122` 当前为 GitHub Public Repository（公开仓），便于当前网页展示、GitHub Pages 部署和快速工程迭代。

### B. 1122 真实运营系统要求

1122 正在升级为可以连接 Amazon、广告系统、Cloudflare、邮箱以及后续其他经营系统的真实内部经营智能体，需要处理大量不应公开的数据和凭据。

两者直接冲突：

```text
公开代码仓
    ↓
任何提交内容可被外部读取

VS

真实经营系统
    ↓
需要保存/处理私有经营数据与长期授权凭据
```

## 三、当前采取的临时安全方案

在 GitHub Repository 仍为 Public 的阶段，采用“公开代码层 + 私有运行数据层”隔离方案。

### 1. Secret（长期密钥）不进入 GitHub 代码

以下长期凭据只保存在 Cloudflare Worker Secret（Worker 后端密钥）或 GitHub Actions Secret（自动化密钥）中：

- Amazon LWA Client ID
- Amazon LWA Client Secret
- Amazon Refresh Token
- Cloudflare API Token
- 其他第三方长期访问凭据

禁止：

- 写入 `worker.js`
- 写入 `wrangler.toml`
- 写入 `index.html`
- 写入 README / Markdown
- 写入 Git commit（提交）
- 通过前端输入框长期保存

### 2. 真实经营数据不进入 GitHub Repository

Amazon SP-API 返回的真实 ProductIdentity 明细不写入 GitHub 文件。

当前真实链路：

```text
Amazon SP-API
      ↓
Cloudflare Worker
      ↓
标准化 ProductIdentity
      ↓
Cloudflare KV（私有状态存储）
```

当前 KV 私有快照可包含：

- Seller SKU
- FNSKU
- ASIN
- Product Name
- Condition
- FBA Inventory
- ProductIdentity 内部 ID

GitHub Repository 不保存这些真实明细。

### 3. Public UI（公开前端）只返回粗粒度状态

GitHub Pages 当前只允许读取：

- 产品数量
- 数据更新时间
- 数据源名称
- API 是否连接
- 非敏感运行状态

不允许公开 API 返回：

- 完整 SKU 清单
- FNSKU
- ASIN 与 SKU 内部映射
- 实时库存明细
- 财务数据
- 广告数据
- 订单信息
- 长期凭据

### 4. 内部刷新接口使用短期授权

ProductIdentity 私有刷新接口采用临时随机 `OPERATIONS_REFRESH_TOKEN`（运营刷新令牌）。

执行过程：

```text
生成随机 Token
    ↓
写入 Worker Secret
    ↓
执行一次私有刷新
    ↓
Token 立即轮换
```

避免长期内部操作令牌固定存在于公开 Workflow（工作流）代码中。

### 5. GitHub Actions 日志最小化

公开 Actions 日志不得主动打印：

- Token
- Secret
- SKU / ASIN 明细清单
- 库存明细
- 财务/订单数据

允许输出的验收信息应尽量限制为：

- success / failure
- 数据条数
- Marketplace
- 更新时间
- 非敏感错误类型

## 四、当前方案的局限

当前方案可以有效降低风险，但它属于“在公开仓约束下的安全补偿措施”，不是最终理想架构。

主要局限：

1. Backend Worker 源代码仍公开，攻击者可以研究接口结构和安全策略；
2. GitHub Actions Workflow 定义公开，内部部署流程和基础设施形态可被观察；
3. 任何未来开发者如果误把真实数据写入文件并 commit，Git 历史可能永久保留该数据；
4. 一旦增加订单、财务、广告、客户相关数据，公开仓带来的操作失误风险显著上升；
5. 后续开启 Amazon 写操作后，公开代码面会增加攻击研究价值；
6. 公开 GitHub Pages 本身不等于内部系统身份认证，不能作为真实经营后台最终入口。

## 五、后续优化建议

### 方案 A：将 1122 主仓库改为 Private Repository（私有仓）

**建议优先级：高。**

适合 1122 逐步成为纯内部经营系统后的阶段。

优点：

- 源代码、Workflow、工程结构不再公开；
- 显著降低误提交经营数据后的公开暴露概率；
- 更符合内部经营系统定位；
- 可以继续保留 Secret / KV / 数据库与代码分离原则。

注意：即使变为 Private，仍然禁止把 Token、Secret 直接写入代码；Private Repository 只是增加一层访问控制，不是 Secret Manager（密钥管理器）。

执行前应确认当前 GitHub 套餐下 Private Repository 与 GitHub Pages 的部署行为是否满足需要。

### 方案 B：拆成 Public Frontend + Private Backend 两个仓库

**建议优先级：最高，长期推荐。**

```text
1122-web-public
├── 静态 UI
├── 公共说明
└── 不含任何内部业务实现

1122-core-private
├── Agent Runtime
├── API Bridge
├── Task Center
├── Policy / Permission
├── Workflows
└── 私有工程逻辑

Cloudflare
├── Worker Secret
├── KV / D1 / R2
└── Access / Zero Trust
```

优点：

- 即使需要保留一个公开展示网页，也不会暴露内部 Worker 与 Agent 实现；
- 前后端安全边界清楚；
- 后续更容易为内部后台增加登录、权限和审批。

### 方案 C：完全迁移公开网页部署到 Cloudflare Pages，GitHub 后端仓保持 Private

GitHub 仅作为私有源码仓；Cloudflare Pages / Workers 承担网页与后端部署。

适合后续希望统一：

- Domain（域名）
- Pages（网页托管）
- Workers（后端）
- Access（访问控制）
- KV / D1 / R2（数据层）

的架构。

### 方案 D：增加 Cloudflare Access / Zero Trust（身份访问控制）

在任何经营明细进入网页前，应增加真正的用户身份认证，而不是依赖：

- Origin Header
- 隐藏 URL
- 前端按钮
- 随机页面路径

未来内部 API 应验证实际登录身份、权限和任务审批状态。

### 方案 E：建立 Repository Data Classification（仓库数据分级）

建议建立统一分级：

- `PUBLIC`：允许进入公开 GitHub / Pages
- `INTERNAL`：仅内部仓和受控后台
- `CONFIDENTIAL`：经营敏感数据，只进入受控数据库/对象存储
- `SECRET`：Token / Password / API Secret，只进入 Secret Manager

自动化提交前应根据数据等级进行拦截。

### 方案 F：增加 GitHub 安全治理

后续建议逐步启用：

- Secret Scanning（密钥扫描）
- Push Protection（推送保护）
- Branch Protection（分支保护）
- CODEOWNERS / 审批规则
- Workflow 最小权限
- 日志脱敏
- 定期 Secret Rotation（密钥轮换）

## 六、推荐最终架构

长期推荐：**代码私有化 + 前后端分仓 + Secret/Data 永不落 Git + Cloudflare 身份保护**。

```text
GitHub Private Core Repo
        │
        ├── Agent / Skill / Policy / Task
        ├── Worker Source
        └── CI/CD
                │
                ↓
Cloudflare Runtime
├── Access（身份认证）
├── Workers（业务后端）
├── Secret（长期凭据）
├── KV / D1（状态/结构化数据）
└── R2（文件/原始数据）
                │
                ↓
1122 Internal Web UI
```

如果需要保留公开官网或产品介绍页，则将其放入单独 Public Frontend Repository，不与内部经营系统共仓。

## 七、升级触发条件

以下任一条件成立时，不应继续仅依赖当前公开仓补偿方案，应启动仓库私有化或前后端分仓：

1. 开始接入 Amazon Orders / Finance 等订单或财务数据；
2. Ads API 开始返回真实广告账户经营数据；
3. 1122 开始保存完整 SKU / ASIN / 库存历史并在 UI 展示；
4. 开始接入客户个人信息或售后信息；
5. 开始启用价格、Listing、广告、库存等真实写操作；
6. Task Center 开始具有真实执行权限；
7. 系统增加新的内部使用人员或多人权限体系。

其中第 4、5、6 项应视为**强制安全门槛**：未完成真实身份认证和私有后端隔离前，不得上线相应能力。

## 八、解决方案状态

### 已完成的风险缓解

- [x] Amazon 长期凭据迁移到 Worker Secret
- [x] ProductIdentity 明细进入 Cloudflare KV 私有数据层
- [x] 公开产品页只显示聚合状态
- [x] 内部刷新使用临时 Token 并在操作后轮换
- [x] 高影响 Amazon 写操作保持关闭

### 尚未完成的根问题

- [ ] GitHub 主仓库仍为 Public
- [ ] 内部经营 UI 尚未建立真实登录身份保护
- [ ] 前端公开代码与内部 Backend 代码尚未分仓
- [ ] 尚未形成统一的数据分级与自动泄露防护机制

因此本冲突当前标记为 `暂缓`，而不是 `已解决`。

## 九、验证方法

当前阶段每次真实数据接入需检查：

1. GitHub 搜索确认不存在新增 Token / Secret；
2. GitHub 文件中不存在真实经营明细快照；
3. Public API 响应不包含禁止公开字段；
4. Worker Secret 仍承担长期凭据保存；
5. KV / D1 / R2 等数据层与 Public Repository 保持隔离；
6. GitHub Actions 日志未输出真实明细；
7. 所有新增写接口经过身份、权限与 Task Center 设计审查。

## 十、验证结果

2026-09-01 ProductIdentity V1.1 验证：

- 真实 Amazon 产品身份已由 Worker 获取；
- 完整 ProductIdentity Snapshot 未写入 GitHub；
- 真实明细保存在 Cloudflare KV；
- Public UI 仅暴露产品数量、更新时间和数据源；
- 当前安全补偿方案有效；
- 根问题“主仓仍为 Public”尚未消除。

## 十一、解决日期

未解决。

## 十二、备注

本问题不是要求未来将所有数据写入 Private GitHub Repository。即使仓库改为 Private，经营数据库、Token、Secret 仍应继续保存在专用运行数据层和 Secret Manager 中，保持“代码与数据、代码与密钥分离”。
