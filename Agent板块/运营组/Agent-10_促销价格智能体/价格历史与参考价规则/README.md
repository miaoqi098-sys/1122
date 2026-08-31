# 价格历史与参考价规则

## 目的
把价格历史、参考价展示和活动资格相关窗口统一为“版本化规则 + 可追溯事实”，避免把经验规则写死。

## 价格历史对象
每个价格历史点至少记录：
- observed_at；
- price_type；
- amount/currency；
- marketplace；
- scope；
- source；
- promotion_context；
- buyer_condition；
- frontend_display；
- order_realized_price（如适用）；
- rule_version_ref。

## 历史窗口
系统允许维护多个窗口，如30日、60日、90日或平台规则指定窗口，但窗口本身只是配置参数，必须绑定具体规则来源和生效时间。

## 参考价判断
参考价/划线展示必须分别记录：
- 当前是否展示；
- 展示类型；
- 展示金额；
- 首次/最后观察时间；
- 与当前报价差距；
- 后台声明字段；
- 平台规则来源；
- 是否存在不确定性。

## 规则版本
任何平台规则使用：
- rule_id；
- marketplace；
- promotion_type/reference_price_type；
- effective_from；
- source_ref；
- window_definition；
- eligibility_requirements；
- status。

规则失效后保留历史，不覆盖旧判断依据。

## 历史价格风险
- 高频改价造成基线不稳定；
- 深折扣可能改变后续活动可用基线；
- 外部促销/特定买家优惠是否影响平台参考需按真实规则版本判断；
- 前台展示与订单实际成交价格可能不同；
- 平台规则变化可能使旧经验失效。

## 边界
Agent-10负责判断和记录价格历史/参考价事实；若缺少最新规则证据，输出 `needs_rule_verification`，不得自行补造规则。
