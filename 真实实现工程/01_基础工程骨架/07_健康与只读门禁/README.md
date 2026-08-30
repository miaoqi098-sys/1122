# REAL-P1-FIX-02｜健康与只读门禁

## 目标

修复 P1 原始健康检查“进程活着就永远返回 ok”和只读保护依赖调用者手动 assert 的问题。

## 三类状态

```text
/live
= 进程是否存活，不代表依赖可用

/ready
= 当前 Runtime 是否具备安全接收请求的条件

/health
= Runtime + 依赖总体健康快照
```

## 只读原则

第一批真实实现中：
- `write_capability` 只能为 `false`；
- `READ_ONLY_MODE=false` 在 Runtime 构造前失败；
- 健康对象不能被构造成 `write_capability=true`；
- 健康接口只报告能力，不授予能力。

## 依赖探针

RuntimeHealthProvider 通过显式 `DependencyProbe` 获取依赖状态。探针异常必须 fail closed，转换为 `unavailable`，不得因为探针报错而继续返回 ready。

当前没有真实 Amazon 授权时，不建立 Amazon 真实探针；P3 恢复后可通过同一 Protocol 注入 SP-API / Ads API 只读依赖探针。

## 完成门禁

- `/live`、`/ready`、`/health` 语义分离；
- 未安装 HealthProvider 时 `/ready` 和 `/health` 不得假绿；
- `write_capability=true` 在模型构造阶段失败；
- RuntimeContainer 注入统一 HealthProvider；
- dependency degraded/unavailable/异常时 readiness fail closed；
- pytest 纳入 P1 统一机器 CI。
