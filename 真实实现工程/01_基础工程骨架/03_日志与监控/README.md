# 03 日志与监控

## 职责
提供第一批只读运行时的结构化日志、敏感字段脱敏和最小健康监控对象。

## V1能力
- JSON结构化日志；
- request/correlation id 字段承载；
- Secret-like字段自动脱敏；
- 最小运行状态 `ServiceHealth`；
- 依赖状态允许 `ok/degraded/unavailable/unknown`；
- 监控对象不产生任何经营写动作。

## 安全规则
普通日志禁止输出 token、password、secret、authorization、cookie、private key 等敏感值。日志只允许记录安全元数据、状态、计数和引用ID。

## 实现
- `src/observability/logging.py`
- `src/observability/health.py`
- `tests/test_observability.py`

机器执行证据由 `05_测试与CI` 统一取得。
