# 1122连接亚马逊 API

## 定位
负责网页版智能体 1122 与 Amazon 官方 API 体系之间的连接建设。

## 主要连接范围
- Amazon Selling Partner API（SP-API）
- Amazon Ads API
- Seller Central 相关授权、数据读取与后续合规执行接口

## 目标
为 1122 提供商品、订单、库存、广告、价格、促销、绩效等运营数据，并在权限与审批边界允许时承接后续执行能力。

## 安全原则
Client Secret、Refresh Token、Access Token、AWS/应用凭据等敏感信息不得直接提交到 GitHub，应通过安全凭据存储或环境变量管理。