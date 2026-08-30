# Amazon SP-API 对接施工

## 目的
把已存在的只读 Connector 能力推进到真实 Amazon SP-API 对接：LWA 授权、真实 endpoint、首个生产只读探针、账号/Marketplace 映射与运行证据。

## 与 P3 的关系
- P3 当前原地暂停，不删除、不回退。
- P3 已完成的 Connector / SP-API Transport / LWA 刷新能力可作为可复用底层代码。
- 本队列负责“真实对接与验证”，不得把 Mock/CI PASS 冒充 AUTH_VERIFIED / READ_VERIFIED / LIVE_DATA_VERIFIED。

## 正式工程位置
`真实实现工程/10_对外链接/01_AmazonSP-API对接/`

## 施工规则
1. 一个功能一个文件夹，完成后才进入下一文件夹。
2. Secret 不得进入 Git、聊天、普通日志、测试 fixture 或任务文件。
3. 第一阶段只读，禁止任何 listings/price/inventory/order 写操作。
4. 真实生产调用只允许显式 allowlist 探针。
5. 每个真实调用必须保存 sanitized request id、HTTP status、endpoint、operation、observed_at；不得保存 access token/refresh token/client secret。
6. 没有真实账号授权时，必须明确标记 BLOCKED_CREDENTIALS，不伪造成功。

## 队列
1. `01_连接配置与安全凭证入口`
2. `02_LWA真实认证`
3. `03_SPAPI首个真实只读探针`
4. `04_账号与Marketplace映射`
5. `05_对接验收与运行证据`

当前只施工第 1 项。