# 只读 UI 接口实现任务包 V1

> 覆盖：R-GP-025

## 1. 目标
为首页、产品状态卡、HumanTaskView 提供受权限控制的真实读取接口，但 M0 不开放经营写操作。

## 2. 最小接口
```text
GET /home-command-center
GET /products/{product_id}/status-card
GET /human-tasks?scope=mine
GET /events?product_id=...
GET /agent-activities?product_id=...
```
具体路径未来可调整，语义必须保持。

## 3. 权限
读取接口至少检查：seller_account、marketplace、product scope、module permission。
禁止前端通过传任意 product_id 越权读取其他账户数据。

## 4. 响应要求
- schema_version
- generated_at
- maturity_level
- freshness/degraded
- trace/request id
- 结构化View

## 5. M0写保护
- 不提供 approve/execute/update API；
- 即使UI出现占位按钮，后端也不得存在可绕过的写入口；
- 真实写接口只能在M1独立权限域中建立。

## 6. 失败语义
- 401/403：认证或授权不足
- 404：对象不存在或不可见
- 409：身份/版本冲突（如适用）
- 503：核心读模型不可用
- degraded成功响应：部分区域可用且明确标记

## 7. 验收条件
- UI可仅凭正式View接口渲染首页/产品卡；
- 权限检查在服务端；
- response可追踪版本与成熟度；
- M0无经营写能力；
- degraded状态可被UI正确展示。

## 8. 静态L1
只读接口语义、权限和写保护边界已明确。L1：PASS。