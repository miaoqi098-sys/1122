# REAL-P1-FIX-01｜运行时集成

## 目标

把 P1 已存在但彼此独立的 `FastAPI Application / Configuration / Observability / SecretProvider` 组装为一个统一 Runtime 入口。

本文件夹只负责“组装与依赖注入”，不把其他功能职责揉进来：
- 健康 / readiness / liveness 语义由 `07_健康与只读门禁` 负责；
- timezone 等强校验由 `08_配置强验证` 负责；
- Secret消费与日志安全由 `09_Secret与日志安全` 负责；
- 可安装 / 可启动 / Smoke CI 由 `10_集成安装与SmokeCI` 负责。

## 运行链

```text
Environment / Runtime Config
          ↓
    load_settings()
          ↓
  RuntimeContainer
    ├── RuntimeSettings
    ├── SecretProvider
    └── Logging Bootstrap
          ↓
      FastAPI App
          ↓
 app.state.runtime_container
```

## 边界

- 仍为 read-only；
- 不连接 Amazon；
- 不读取任何真实 Secret；
- 不引入数据库；
- 不实现 Executor；
- 不修改 P2。

## 完成门禁

- 存在真实 `RuntimeContainer`；
- `load_settings()` 在应用组装前执行；
- JSON Logging 在应用启动组装阶段配置；
- SecretProvider 通过容器注入，不由业务模块自行全局构造；
- FastAPI `app.state` 能读取同一个 RuntimeContainer；
- 对应 pytest 进入 P1 统一机器 CI。
