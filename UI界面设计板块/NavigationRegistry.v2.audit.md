# UI Navigation Registry V2｜Phase 1 审计报告

审计基线：`main` 的 `55bb6c57dce4122662befdc539d9e5c1449417cd`。本报告只覆盖 UI 导航登记、Router、Renderer、连接器登记和相关说明文档；不评估或变更任何业务规则、数据读写、审批或权限逻辑。

## 审计范围与方法

- 人工契约：`UI界面设计板块/NavigationRegistry.v2.json`
- 原运行时登记：`web-console/registry.js`
- Router：`web-console/app.js`
- Renderer：`web-console/*.js` 的 `renderers['route'] = ...` 注册
- 辅助读模型：`web-console/data/snapshots.js`、`web-console/data/system-catalog.js`
- CI：三个 UI/Web Console workflow 与原 `tools/verify-ui-registry.mjs`

审计使用静态路由收集、JSON/关联契约存在性检查和浏览器 IIFE 的 VM 执行检查。现有 Hash Router 的 query、anchor、产品动态路由和 Renderer 选择逻辑均作为既有语义保留。

## 实施前发现

| 范围 | 发现 | 风险 |
|---|---|---|
| 人工真值与前端 | JSON 被文档称为统一真值，但 `index.html` 实际加载手写 `registry.js`。 | 修改 JSON 不会影响前端，手写 JS 又会漂移。 |
| 路由覆盖 | 原 JSON 有 23 条静态导航和 2 条产品模板；旧 runtime 另有首页、两个连接器详情页、系统地图与 `/` 首页别名。 | 直接从旧 JSON 生成会丢失已可访问页面。 |
| 标识与展示 | `/governance` 的 ID、三个标签及运营子项顺序在 JSON 与 runtime 间不一致。 | 搜索、系统地图和后续契约比对会出现漂移。 |
| 影子副本 | snapshots 维护了过期导航树，system catalog 手写了模块身份字段。 | 新增入口容易只更新一处。 |
| 路由验证 | Router 以 Renderer 注册表决定可访问性；原校验未做 Registry 与 Renderer 双向验证。 | 未登记/无页面的路由可能静默进入发布物。 |
| CI | 旧校验直接读取 `registry.js`，且 UI Navigation V2 workflow 不在 PR 上运行。 | 生成物、Router 与 Renderer 漂移无法在 PR 阶段阻断。 |

## Phase 1 结果

`NavigationRegistry.v2.json` 已成为唯一人工维护源，并扩展为无损表达既有 UI 运行时所需的声明数据：

- 首页元数据、`/` 首页别名、产品模板路由和全部 12+1+1 导航层级；
- 两个已存在的连接器详情路由与隐藏的 `/system/overview` 路由；
- 既有模块展示元数据、连接器定义、快捷入口和授权展示边界；
- 原有 route 字符串保持不变，展示 ID/标签/顺序以正式 JSON 为准。

新增 `tools/generate-ui-registry.mjs` 将 JSON 生成 `web-console/registry.generated.js`。生成文件以浏览器 IIFE 暴露并深度冻结既有 `window.__1122_REGISTRY__` 形状，因此 `connectors-live.js`、页面 Renderer 与 Router 无需架构重写。

前端启动顺序已改为先加载生成 Registry，再加载 snapshot、system catalog、数据源、连接器、Renderer 和 Router。snapshot 的 navigation 从生成 Registry 派生；Data Layer 返回的 navigation 不再覆盖它；system catalog 的 `id`、`label`、`route`、`source_path`、`readiness` 从生成 Registry 派生，盘点专有字段保留为 `catalog_summary`、文件数、负责人和 surface 信息。

## 一致性结果

| 检查项 | 结果 |
|---|---|
| 运行时模块 | 27 条：首页、可见导航、连接器详情和系统地图均已声明 |
| 声明路由 | 30 条：27 条静态模块路由、2 条产品模板和 `/` 首页别名 |
| Renderer 注册 | 30 条；无重复、无遗漏、无未声明路由 |
| 连接器 | 6 个；每个 connector route 均有 Renderer |
| 导航根节点 | 13 个：首页加 12 个一级板块；嵌套顺序来自 JSON |
| UI 契约与 source path | 全部静态检查存在 |
| 快捷入口锚点 | `/command-center#human-tasks` 与 `/command-center#agent-activity` 均有页面 DOM 锚点 |

## 路由语义确认

本期没有改动 Renderer 选择规则或业务页面行为：

- `/operations` 继续复用既有产品 Renderer；
- `/products/:product_id` 与 `/products/:product_id/policy-impact` 继续由既有 Router 正则分派；
- `#/` 继续由 `home-live.js` 的既有首页 Renderer 处理；
- `/connectors/amazon-ads` 继续由既有 Ads Renderer 依据当前 route 区分设置页；
- query、anchor 和 Not Found 的已有处理逻辑不变；默认首页仅改为从生成 Registry 的 `home_route` 读取，缺失时仍回退到原 `/command-center`。

## 持续校验与 CI

本期新增 Node 单元测试和统一验证器，并在 PR CI 中执行：

```bash
node tools/generate-ui-registry.mjs --check
node tools/ui-navigation-registry.test.mjs
node tools/verify-ui-registry.mjs
```

验证器检查源 JSON → 生成文件 → VM 运行时对象 → Router / Renderer 的闭环，同时检查产物新鲜度、脚本加载顺序、旧手写 Registry 缺失、产品 HTML 覆盖、关联契约、source path、连接器、快捷锚点、snapshot 与 system catalog 派生关系。它是静态契约检查，不替代真实外部连接器请求或人工页面验收。
