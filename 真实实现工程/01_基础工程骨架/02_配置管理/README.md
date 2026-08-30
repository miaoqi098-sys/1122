# 02 配置管理

## 职责
本文件夹负责第一批真实实现的**非敏感运行配置**，不保存任何 Secret 明文。

## V1配置范围
- `APP_ENV`：运行环境，默认 `development`；
- `SERVICE_NAME`：服务名；
- `LOG_LEVEL`：日志级别；
- `READ_ONLY_MODE`：第一批必须为 `true`；
- `DEFAULT_TIMEZONE`：默认业务时区，默认 `UTC`；
- `CONFIG_VERSION`：配置Contract版本。

## 安全边界
以下字段不得由本模块读取、保存、打印或回显：
- access token / refresh token；
- client secret；
- AWS secret/access key；
- password；
- private key；
- Amazon/Ads credential。

Secret 统一由后续 `04_Secret引用` 建立引用接口。

## Fail Closed
若 `READ_ONLY_MODE=false`，配置加载直接失败。第一批真实实现不允许通过普通环境变量配置打开经营写能力。

## 实现
- `src/configuration/settings.py`：Pydantic配置模型与环境读取；
- `tests/test_settings.py`：默认值、环境覆盖、只读保护与Secret拒绝检查。

## 当前验证
代码与测试已写入；机器测试由 `05_测试与CI` 统一执行并记录证据。
