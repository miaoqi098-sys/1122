# 1122 Web Console V1

这是 1122 当前正式 Web UI 实现。

## 当前能力

- 经营指挥中心首页
- 12 个一级导航入口
- 运营二级入口
- APR 市场玩法探索
- AOM 正向运营方法
- APB 政策与边界证据
- Agent 中心
- 任务中心
- 沙盘演练
- 数据中心
- 系统政策边界
- 全局 APR/AOM/APB 搜索
- 移动端响应式侧栏

## 本地运行

本项目无第三方依赖，可以直接用任意静态服务器运行。

例如：

```bash
cd web-console
python3 -m http.server 8080
```

然后打开：

```text
http://localhost:8080
```

## 路由

当前使用 Hash Router，避免静态托管环境需要额外 rewrite 配置。

- `#/command-center`
- `#/operations/products`
- `#/amazon-boundary/apr`
- `#/amazon-boundary/aom`
- `#/amazon-boundary/apb`
- `#/sandbox`
- `#/agents`
- `#/tasks`
- `#/data`

## 数据源状态

V1 使用 `web-console/data/snapshots.js` 中的仓库快照数据。

它当前同步：

- APRCurrentIndex V1
- PositiveOperatingMethodIndex V1
- CurrentResultIndex V1
- 18-domain coverage snapshot

这属于 `SOURCE_ONLY / read-only` UI 数据，不代表已经接入实时 Amazon/D1 API。

后续正式运行时，将数据读取层替换为 1122 的只读 API / D1 Aggregator，页面与路由结构无需推翻。

## 权限边界

Web Console 本身不拥有生产写权限。

任何真实 Amazon / Ads 写动作仍必须走：

`Agent-1 → Task → Approval Gate → Permission Boundary → Executor`
