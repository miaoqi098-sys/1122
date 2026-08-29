# S06｜风险评估

## 技能定位
S06对S05生成的每个Option建立结构化风险画像，判断原始风险、控制后风险、残余风险、最坏情况、审批要求与执行资格，为Agent-1最终方案选择提供风险侧证据。

## 正式调用位置
```text
S05 Option[]
+
S02 ContextPackage
↓
S06 RiskAssessment
↓
RiskAssessment[]
↓
DecisionSelector
↓
FinalDecision
```

S06正常完成后的正式路由：
`continue_to_decision_selector`。

S06不直接选择最终方案。

## 唯一上下文源
经营状态、目标、硬约束、历史和当前任务背景统一从`context_package`读取。

S06不再通过并列`business_state / constraints`建立第二事实源。

## 风险维度
- compliance_account
- sellability
- inventory
- cash_flow
- profit
- price_system
- advertising
- traffic_asset
- customer_experience
- execution
- data_uncertainty
- irreversibility

## 三层风险
```text
inherent_risk
↓ controls / mitigations
controlled_risk
↓ remaining uncertainty
residual_risk
```

不得因为有mitigation就删除或改写原始风险。

## 风险聚合
总体风险不得简单平均。

必须保留：
- aggregation_rule
- dominant_risk
- risk_drivers
- worst_case

合规、账户、不可售、禁止行为和重大不可逆风险允许dominant-risk override。

## eligibility
- eligible
- eligible_with_controls
- requires_approval
- requires_more_evidence
- prohibited

## 与S05边界
S05提供known_tradeoffs / known_risk_signals；S06负责正式风险等级、控制措施、审批与eligibility。

## 与DecisionSelector边界
S06只回答：
> 每个Option在当前ContextPackage下有多大风险、需要什么控制、是否具备进入最终比较的资格。

DecisionSelector才回答：
> Agent-1最终选择哪个Option，以及为什么。

`prohibited`不得进入最终选择；`eligible_with_controls`被选择时required_controls必须进入FinalDecision。

## 当前版本
- 业务规则：V1.1；
- 接口：V1.2，已统一ContextPackage并正式路由DecisionSelector；
- 执行程序：待系统运行层实现。