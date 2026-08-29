# S01｜事件校验

## 技能定位
S01是Agent-1接收标准事件后的第一道质量门，只判断事件是否具备进入后续决策链的最低条件，不提前做经营决策。

## 调用位置
```text
标准Event
↓
S01 EventValidation
↓
passed / passed_with_warnings
→ normalized_event
→ S02

needs_information
→ 补信息后重跑S01

rejected
→ 终止当前事件链或人工复核
```

## 正式事件作用域
S01 V1.1不再假设所有事件都是单ASIN事件。

`scope_type`支持：
- product
- parent_product
- sku
- account
- store
- global

规则：
- product / parent_product / sku：必须提供有效`product_id`；
- account / store / global：`product_id`允许为null；
- 具体影响对象可通过`scope_id`与`scope_objects`表达；
- 禁止为账户级或店铺级事件伪造ASIN。

## 核心职责
1. 结构与必填字段校验；
2. 作用域与业务对象校验；
3. 来源校验；
4. 时间有效性校验；
5. 基础事实质量检查；
6. severity一致性检查；
7. 重复/近重复事件初筛；
8. 输出Canonical `normalized_event`。

## 不负责
S01不负责：
- 判断根因；
- 判断最终经营状态；
- 生成候选方案；
- 风险评估；
- 调整广告、价格、库存等策略；
- 决定是否执行。

## 输出状态
- `passed`
- `passed_with_warnings`
- `needs_information`
- `rejected`

## S01→S02正式接口
S02必须直接消费：
- `S01.normalized_event`
- `S01.status`
- `warnings`
- `duplicate_signal`

S02不得重新使用未经标准化的原始event。

## 阻断示例
- event不存在；
- event_id/source_agent/event_type/occurred_at缺失；
- product作用域却没有product_id；
- account/store/global作用域没有任何可解释scope信息；
- occurred_at不可解析且无法修复；
- 来源完全无法识别；
- 事实与对象严重矛盾且不可解释。

## 非阻断警告示例
- recommendation缺失；
- facts可验证性偏弱；
- severity与事实可能不一致；
- 旧事件仍具有历史价值；
- possible duplicate；
- 来源合法但超出专业边界。

## 成功标准
S01成功不是尽可能拒绝事件，而是：
1. 阻止脏数据进入后续链；
2. 不误伤可修复或非产品级有效事件；
3. 明确告诉上游缺什么；
4. 输出可被S02和Skill Runner直接消费的标准事件。

## 当前版本
- 业务规则：V1.x冻结候选；
- 接口：V1.1，已支持product/account/store/global作用域并正式输出normalized_event；
- 执行程序：待系统运行层实现。