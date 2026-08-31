# 政策规则与版本管理

## 目标
把平台政策、合规要求和风险规则视为可变化的外部规则对象，而不是永久写死在Agent逻辑中的常量。

## 标准规则对象
- `rule_id`；
- `rule_domain`；
- `marketplace/region`；
- `source_type`；
- `source_ref`；
- `title/summary`；
- `applicable_scope`；
- `requirements`；
- `prohibitions`；
- `required_evidence`；
- `effective_from`；
- `effective_to`；
- `rule_version`；
- `last_verified_at`；
- `status`；
- `confidence`。

## 来源优先级
优先使用平台官方政策、官方通知、官方账户健康/合规页面和可信监管/认证来源。社区经验、历史案例和第三方文章只能作为辅助背景，不可替代正式规则证据。

## 版本规则
1. 新政策/规则变化创建新版本，不覆盖旧版本；
2. 风险结论必须引用当时生效的规则版本；
3. 规则来源无法访问或版本过期时，结论降级；
4. marketplace间规则不得默认共用；
5. 规则适用对象不明时，不得机械套用。

## 规则状态
`draft_reference / verified_active / superseded / expired / unavailable`

只有 `verified_active` 可作为高影响资格门的直接规则依据；其他状态需补证据或审批。

## 规则变更影响
规则更新后必须检查：
- 既有高风险内容claim；
- 当前商品/账户资格；
- 待提交申诉/整改材料；
- 已建立的风险模板；
- Agent-1资格门引用。

## 边界
当前只定义规则对象和版本治理。真实自动抓取/同步最新政策属于运行依赖，不在Agent框架中实现。
