# 04 Secret引用

## 职责
建立 Secret 的**引用Contract与运行时解析接口**。本文件夹不保存任何真实Secret，不提供credential展示接口。

## V1原则
- Git中只保存 `SecretRef`，例如 provider + key/name；
- Secret值仅在运行时解析；
- Secret值使用 `SecretStr` 包装，repr/str默认遮罩；
- 默认Provider只提供环境变量引用适配器，后续可替换为受控Vault；
- 不允许列举全部Secret；
- 不允许把Secret值写入普通日志、异常文本、任务文件或UI响应；
- 本阶段只建立接口，不配置任何Amazon真实凭证。

## 实现
- `src/secrets_runtime/models.py`
- `src/secrets_runtime/provider.py`
- `tests/test_secret_refs.py`

## 后续
P3真实Amazon只读连接只能消费本模块的引用接口或等价受控Vault实现，不得直接从业务代码硬编码credential。
