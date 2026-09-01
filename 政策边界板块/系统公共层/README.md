# 系统公共层

本目录提供所有 Agent 和系统模块共用的基础能力，避免配置、日志、权限、监控和测试分散重复建设。

## 规划子模块
- 配置
- 日志
- 权限
- 监控
- 测试
- 数据安全与仓库可见性

## 当前正式规则

- `仓库可见性与敏感数据安全边界.md`
  - 定义 Public / Internal / Confidential / Secret 四级数据边界；
  - 规定 GitHub Public Repository（公开仓）阶段真实经营数据不得落仓；
  - 规定 Worker Secret、KV / D1 / R2 与 Public UI 的职责边界；
  - 定义未来 Private Repository（私有仓）或 Public Frontend + Private Backend 分仓的升级门槛。

## 原则
- 公共规则统一维护，业务 Agent 只引用，不重复复制。
- 配置与代码分离。
- 数据与代码分离。
- Secret（密钥）与代码分离。
- 所有关键运行行为必须可记录、可监控、可追溯。
- 公共权限规则优先于单个 Agent 的局部配置。
- 仓库为 Public 时，所有 tracked file（被 Git 跟踪的文件）默认按“外部可读取”处理。
