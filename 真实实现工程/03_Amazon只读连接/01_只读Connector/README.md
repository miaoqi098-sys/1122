# REAL-P3-01｜Amazon只读Connector

## 目标

建立第一批 Amazon 只读连接的运行边界：SP-API 与 Ads API 只读 Operation Contract、SecretRef 引用、Transport 抽象、失败保护、限流/重试和 source trace。

本文件夹不包含真实 Amazon credential，不调用生产 Amazon API，不开放任何经营写操作。

## 只读原则

- Operation 必须进入显式只读 allowlist；
- 未知操作、写操作、权限不明操作全部 fail closed；
- Secret 只通过 P1 `SecretRef` / provider 边界引用；
- Connector 不记录或返回 Secret 明文；
- 认证失败不重试；
- 超时和限流只允许有限次数重试；
- 每次结果必须携带 source trace；
- Mock/CI PASS 不等于 AUTH_VERIFIED、READ_VERIFIED 或 LIVE_DATA_VERIFIED。

## 当前 V1 Operation

SP-API：
- `spapi.catalog.get_item`
- `spapi.listings.get_item`
- `spapi.inventory.get_summaries`

Ads API：
- `ads.campaigns.list`
- `ads.ad_groups.list`
- `ads.keywords.list`

这些名称只是内部只读 Contract，不表示已经取得对应生产权限。

## 目录

```text
01_只读Connector/
├── README.md
├── pyproject.toml
├── src/amazon_read_connector/
│   ├── __init__.py
│   ├── models.py
│   ├── policy.py
│   ├── transport.py
│   └── connector.py
├── tests/
│   ├── test_policy.py
│   └── test_connector.py
└── L1验收.md
```

## 依赖与Secret边界

P3 复用 P1 `secrets_runtime.SecretRef`，测试仅使用 dummy Secret。真实 Amazon Secret 和账号信息不得进入 Git、普通日志、测试 fixture 或施工文档。

## 成熟度

当前：`IMPLEMENTATION_IN_PROGRESS`

只有 P3 pytest 和独立 CI 机器门禁通过后，才能标记 `CONNECTOR_CONTRACT_VERIFIED`；没有真实授权时仍不得标记真实 Amazon 读取已验证。
