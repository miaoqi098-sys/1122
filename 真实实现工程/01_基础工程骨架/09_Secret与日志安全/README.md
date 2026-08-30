# REAL-P1-FIX-04｜Secret与日志安全

## 目标

补强 P1 的 Secret 消费边界和日志 message 安全，避免业务模块长期持有 SecretProvider / SecretValue，或把凭据片段写入普通日志 message。

## Secret 消费

- RuntimeContainer 对业务侧暴露 `SecretUseBroker`，不直接暴露底层 Provider；
- `SecretUseBroker.use()` 在一次受控 callback 内解析并消费 Secret；
- callback 返回值不得是原始 SecretValue / SecretStr / 同值明文；
- 缺失 Secret 继续 fail closed；
- 不缓存 Secret 明文。

## 日志安全

- `safe_context` 继续按敏感 key 递归脱敏；
- SecretStr 值即使 key 看起来安全也必须脱敏；
- message 对 Bearer、password/token/secret/access_key/client_secret 等常见凭据形式进行过滤；
- Formatter 输出不得包含测试 Secret 明文。

## 边界

- 测试仅使用 dummy Secret；
- 无真实 Amazon credential；
- 不连接 Amazon；
- 不开放写能力；
- Python 无法保证对解释器内字符串做物理内存擦除，本项保证的是 API 生命周期、无缓存、无返回和日志边界。

## 完成门禁

- SecretUseBroker 真实实现并接入 RuntimeContainer；
- 普通 RuntimeContainer 不再暴露原始 SecretProvider；
- 日志 message/context 均有测试覆盖；
- P1 统一 CI 机器 PASS；
- L1 与 Git 证据存在。
