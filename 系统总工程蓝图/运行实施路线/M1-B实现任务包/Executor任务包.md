# Executor 实现任务包 V1

> 覆盖：R-GP-017（执行部分）

## 1. 执行前硬检查
Executor执行任一Action前必须重新确认：
- Task当前版本和状态可执行；
- action_type在allowlist；
- target scope与product/account/marketplace匹配；
- Policy/Permission当前判定允许；
- required_controls满足；
- 需要审批时Approval有效且未过期；
- 幂等键未消费；
- 执行前状态已保存；
- 风险阈值未触发停止。

## 2. Adapter边界
不同外部平台/动作使用独立Executor Adapter，例如AdsBudgetAdapter。公共Executor负责控制面，Adapter只负责具体平台调用。

## 3. 幂等与防重放
- 每个执行请求有execution_request_id/idempotency_key；
- 网络超时后先查询结果再决定重试；
- 不允许用户重复点击造成重复写；
- 同一Approval不可授权超出原scope的不同动作。

## 4. 执行前快照与回滚
可逆动作必须尽量保存before_value / platform_state_ref。
回滚不是默认成功路径，必须独立形成Action/ExecutionResult并受权限控制。

## 5. fail-closed
以下任一情况拒绝执行：权限服务不可用、Task版本变化、Approval失效、target不一致、unknown action、幂等状态不明、高风险规则命中。

## 6. 第一版动作范围
真实MVP阶段只允许一个经过明确授权的低范围动作类型。扩展新的action_type必须单独验收，不允许通配执行。

## 7. 验收条件
- 无有效控制链时零副作用；
- 重复请求最多产生一次业务写；
- 平台调用可追溯到Task/Approval/Action；
- 执行失败/部分成功不会被记录成success；
- Adapter不能绕过公共权限控制面。

## 8. 静态L1
Executor控制面、Adapter、幂等、回滚和fail-closed已明确；未实施真实写操作。L1：PASS。