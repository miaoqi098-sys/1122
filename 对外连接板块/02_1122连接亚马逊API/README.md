# 1122连接亚马逊 API

## 定位
负责网页版智能体 1122 与 Amazon 官方 API 体系之间的连接建设。

## 当前路线
- Developer Type：Private Developer（私有开发者）
- Amazon Selling Partner API（SP-API）：第一阶段主通道
- Amazon Ads API：后续单独授权接入
- Seller Central：仅连接本公司已授权账户

## SP-API 认证凭据
普通需要 Seller 授权的 SP-API 调用，不是只靠一个 Client Secret。

1122 至少需要：
1. `AMAZON_LWA_CLIENT_ID`：LWA Client ID（客户端 ID）
2. `AMAZON_LWA_CLIENT_SECRET`：LWA Client Secret（客户端密钥）
3. `AMAZON_LWA_REFRESH_TOKEN`：Self-Authorization（自授权）后生成的 Refresh Token（刷新令牌）

运行时由后端使用上述三项向 `https://api.amazon.com/auth/o2/token` 换取短期 LWA Access Token（访问令牌），然后调用对应区域的 SP-API Endpoint（端点）。

## 当前进度
- [x] Private Developer（私有开发者）资料审核完成
- [x] LWA App Client（应用客户端）已创建
- [ ] Self-Authorization（自授权）
- [ ] 获取 Refresh Token（刷新令牌）
- [ ] 后端 Secret（加密密钥）存储
- [ ] 第一条只读 SP-API 真机调用
- [ ] Listing / Pricing / Inventory 等写操作接入任务中心审批

## 目标能力
为 1122 提供商品、Listing、订单、库存、FBA、价格、财务、销售表现等运营数据，并在权限与审批边界允许时承接标题、五点、描述、图片、价格、库存、上下架等执行能力。

## 安全原则
- Client Secret、Refresh Token、Access Token 等敏感信息不得直接提交到 GitHub。
- 不把长期凭据写入公开网页、JavaScript 常量、localStorage 或普通日志。
- 前端只负责一次性录入/状态展示；长期凭据迁移至 Backend Secret（后端加密密钥）。
- 第一条真实调用必须先走只读验证；高影响写操作必须进入权限校验、日志和审批边界。