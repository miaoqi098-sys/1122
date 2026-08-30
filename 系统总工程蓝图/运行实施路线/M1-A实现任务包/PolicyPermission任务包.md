# Policy / Permission 实现任务包 V1

> 覆盖：R-GP-016

## 1. 目标
为读取、建议、建任务、审批、执行分别提供独立权限判定，默认 fail closed。

## 2. 最小判定输入
- actor_type / actor_id
- seller_account_id
- marketplace_id
- product_id / resource scope
- action_type
- requested_operation
- risk_level
- required_controls
- current policy version

## 3. 最小输出
```text
allow
allow_with_controls
require_approval
deny
unknown_fail_closed
```
并返回 policy_refs、permission_refs、required_controls、reason_code、evaluated_at。

## 4. 权限层次
必须区分：
- read
- recommend
- create_task
- approve
- execute
- administer_policy

读取权限不能推导出执行权限；审批权限不能推导出策略管理权限。

## 5. 规则版本与审计
Policy变化必须版本化；Task/Approval/Execution必须记录当时使用的policy_version，后续政策变化不能改写历史解释。

## 6. fail-closed场景
- 身份无法验证；
- scope不明确；
- policy服务不可用；
- required_control未知；
- 高风险动作没有明确授权；
- approval已过期或scope不匹配。

## 7. 验收条件
- 相同输入+相同policy version判定一致；
- 无权限服务时写操作默认拒绝；
- 可解释为什么允许/拒绝；
- 不允许Agent Prompt覆盖系统权限判定；
- 所有执行候选都能生成机器可消费的authority result。

## 8. 静态L1
权限输入输出、层次、版本和fail-closed边界已明确。L1：PASS。