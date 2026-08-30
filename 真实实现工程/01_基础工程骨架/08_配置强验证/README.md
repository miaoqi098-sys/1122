# REAL-P1-FIX-03｜配置强验证

## 目标

在 P1 `RuntimeSettings` 基础解析之上增加运行级语义验证，避免“字符串能通过 Pydantic，但运行环境实际不可用”的假配置。

## 当前验证范围

- `APP_ENV`：只允许 `development / test / staging / production`；
- `DEFAULT_TIMEZONE`：必须是 Python `zoneinfo` 可解析的 IANA timezone；
- `CONFIG_VERSION`：当前第一批只接受 `1.0`；
- `SERVICE_NAME`：去除首尾空白后不能为空；
- 第一批仍强制 `READ_ONLY_MODE=true`。

## 运行链

```text
load_settings()
    ↓
validate_runtime_settings()
    ↓
RuntimeContainer
```

## 边界

- 不读取 Secret；
- 不连接 Amazon；
- 不引入部署平台配置；
- 不处理 Secret 消费或日志 message 安全（属于 09）；
- 不开放写能力。

## 完成门禁

- 存在真实运行级 validator；
- RuntimeContainer 构造前执行强验证；
- 非法 timezone/env/config version 均 fail closed；
- 对应 pytest 纳入 P1 统一 CI 并机器 PASS；
- L1 与 Git 证据存在。
