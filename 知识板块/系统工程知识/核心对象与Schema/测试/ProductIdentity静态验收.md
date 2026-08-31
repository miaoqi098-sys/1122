# ProductIdentity V1 静态验收

## 验收范围

验证 `ProductIdentity.schema.json`、引用规则和示例在静态 Contract 层是否一致。

## 正向场景

### CASE-PID-001｜ASIN + SKU 完整身份
期望：PASS
- schema_version = 1.0
- product_id 非空
- seller_account_id 非空
- marketplace_id 非空
- asin 非空
- sku 非空
- identity_status 为允许枚举
- created_at / updated_at 为 date-time

对应示例：`../示例/ProductIdentity.example.json`

### CASE-PID-002｜只有 ASIN
期望：PASS

适用于尚未取得 Seller SKU、但已经确定 Amazon Catalog 身份的临时/导入场景。

### CASE-PID-003｜只有 SKU
期望：PASS

适用于已经存在 Seller SKU、但 ASIN 尚未解析或暂时缺失的场景。

## 反向场景

### CASE-PID-004｜ASIN 与 SKU 都为空
期望：FAIL

原因：无法形成最低可解析外部身份。

### CASE-PID-005｜缺 product_id
期望：FAIL

原因：全系统内部主键缺失。

### CASE-PID-006｜使用未定义字段作为主键替代 product_id
期望：FAIL / 不允许作为 Canonical Contract。

### CASE-PID-007｜identity_status 为自由文本
期望：FAIL

### CASE-PID-008｜同一 active SKU 组合映射到多个 product_id
期望：Schema 单记录层无法判断，必须由未来 Identity Registry / 唯一性校验层阻止。

唯一性判断键：
`seller_account_id + marketplace_id + sku`

## 跨模块验收

必须满足：
- MetricSnapshot 未来引用 product_id；
- Event 未来可回指 product_id；
- Task / Action / Memory 未来可回指 product_id；
- UI 产品状态卡以 product_id 作为内部路由/查询锚点；
- ASIN、SKU 仅作为外部展示与解析标识，不替代内部主键。

## L1结论

当前 ProductIdentity V1 静态 Contract：**PASS（框架级）**。

仍需后续运行层实现：
- 唯一性数据库约束；
- IdentityResolution；
- 外部标识映射持久化；
- 冲突隔离与人工解析。
