# S06｜风险评估

## 技能定位
对S05生成的每个候选方案逐一建立结构化风险画像，判断原始风险、控制措施、剩余风险、最坏情况、审批要求和执行资格，为Agent-1最终方案比较提供风险侧证据。

S06不是简单列“可能有风险”，而是回答：风险从哪里来、什么时候发生、最坏会怎样、能否发现、能否回滚、加保护措施后还剩多少风险，以及方案当前是否有资格继续。

## 调用位置
```text
S05 structured options
↓
S06读取option/actions/assumptions/known risk signals
↓
逐动作、逐方案识别风险
↓
评估 inherent risk
↓
设计/读取 controls & mitigations
↓
评估 controlled risk
↓
评估 residual risk
↓
识别 dominant risk / worst case
↓
确定 eligibility / approval
↓
交Agent-1进行收益-风险综合比较
```

## 风险维度
- compliance_account：合规/账户；
- sellability：可售；
- inventory：库存；
- cash_flow：现金流；
- profit：利润；
- price_system：价格体系；
- advertising：广告；
- traffic_asset：流量/关键词资产；
- customer_experience：消费者体验；
- execution：执行；
- data_uncertainty：数据/假设不确定性；
- irreversibility：不可逆性。

## 单条风险结构
每个risk至少尽量描述：
- `risk_id`
- `category`
- `source`
- `trigger`
- `affected_object`
- `likelihood`
- `impact`
- `time_horizon`
- `detectability`
- `reversibility`
- `exposure`
- `evidence_strength`
- `mitigation_actions`
- `inherent_risk_level`
- `controlled_risk_level`
- `residual_risk_level`
- `worst_case`

## 风险等级
- `R0`：低风险；
- `R1`：可控风险；
- `R2`：显著风险；
- `R3`：高风险，通常需要审批/强化保护；
- `R4`：禁止执行或必须升级到授权层处理。

## 三层风险
### inherent_risk
不考虑新增保护措施时，方案天然携带的风险。

### controlled_risk
假设已配置且能够执行明确的控制措施后，风险降到什么水平。

### residual_risk
控制措施执行后仍无法消除的剩余风险。

不得因为存在mitigation就删除或改写原始风险。

## 风险聚合
总体风险不得简单平均。

需要记录：
- `aggregation_rule`
- `dominant_risk`
- `risk_drivers`

合规、账户、不可售、明确禁止行为、重大不可逆风险等允许触发dominant-risk override，直接主导总体等级。

## 最坏情况
每个重要风险和方案整体都应尽量回答 `worst_case`。

最坏情况不是夸大灾难，而是描述在合理风险边界内如果判断失败，可能造成的最大经营损失或不可逆后果。

## 执行资格 eligibility
- `eligible`：可进入正常方案比较；
- `eligible_with_controls`：只有落实指定保护措施后才可执行；
- `requires_approval`：风险允许讨论，但必须审批；
- `requires_more_evidence`：关键风险因证据不足无法可靠判断；
- `prohibited`：触碰禁止行为/硬约束，当前不得执行。

## 与S05的边界
S05只提供known_tradeoffs和known_risk_signals；S06负责正式风险识别、等级、控制后风险、审批与资格判断。

## 与Agent-1的边界
S06不以“风险最低”直接选最终方案。Agent-1仍需综合目标、预期收益、风险、状态、资源和长期影响。

## 核心原则
S06不是让系统变胆小，而是让系统知道自己在冒什么险、最坏会怎样、保护措施是否真的有效，以及风险是否值得承担。

## 当前版本
V1.1：加入S05 option完整承接、结构化risk、dominant-risk聚合、inherent→controlled→residual三层风险、worst_case和多状态eligibility。