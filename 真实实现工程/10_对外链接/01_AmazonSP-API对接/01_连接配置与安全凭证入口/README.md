# 01_连接配置与安全凭证入口

## 目标
建立 Amazon SP-API 真实对接所需的非敏感连接配置、SecretRef 引用和凭证存在性预检。此文件夹不保存真实 Secret，不执行生产 SP-API 调用。

## 当前官方连接基线
- LWA token endpoint：`https://api.amazon.com/auth/o2/token`
- SP-API endpoints：NA / EU / FE 固定 Amazon 官方 host
- 第一真实只读探针：Sellers API `GET /sellers/v1/marketplaceParticipations`
- 请求使用 LWA access token，并携带 `x-amz-access-token`、`x-amz-date`、`user-agent`

## 受保护凭证引用
- `SPAPI_LWA_CLIENT_ID`
- `SPAPI_LWA_CLIENT_SECRET`
- `SPAPI_LWA_REFRESH_TOKEN`

这些名称可以出现在代码和文档中，但对应值不得进入 Git、聊天、普通日志和运行证据。

## 状态
`IMPLEMENTATION_IN_PROGRESS`
