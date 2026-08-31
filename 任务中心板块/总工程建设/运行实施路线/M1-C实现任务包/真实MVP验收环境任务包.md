# 真实单产品 MVP 验收环境任务包 V1

> 覆盖：R-GP-026

## 1. 目标
为第一个真实单产品闭环准备受控验收环境，严格区分只读验证与写操作验证。

## 2. 环境范围
- 1个授权seller account；
- 1个marketplace；
- 1个明确product_id；
- 1组只读数据源；
- 1个低风险、明确授权的广告动作类型作为M1候选；
- 独立测试/验收标识，避免与大规模生产操作混用。

## 3. 验收阶段
### Phase A 只读
Identity → Metric → State/Event → Aggregators → UI。
达到READ_MODEL_VERIFIED / LIVE_DATA_VERIFIED后才能进入下一阶段。

### Phase B Agent
真实Runtime处理一个结构化Event，产生专业分析与Agent-1 FinalDecision。达到AGENT_RUNTIME_VERIFIED。

### Phase C 人工审批
真实用户完成Task审批，形成Approval。达到HUMAN_APPROVAL_VERIFIED。

### Phase D 受控执行
仅执行预先allowlist的单一动作，产生Action/ExecutionResult。达到EXECUTION_VERIFIED。

### Phase E 验证
经过观察窗口生成ValidationResult，并回写Memory/UI。达到VALIDATION_VERIFIED。

### Phase F 总闭环
证据链完整后才允许BUSINESS_LOOP_VERIFIED。

## 4. 证据
保存exact version/commit、environment、product scope、machine evidence refs、API trace refs、对象ID链和known limitations。

## 5. 停止条件
任何身份歧义、权限不明、Approval失效、Executor结果unknown且不可安全确认、数据质量异常，都应停止写链并保留证据，不继续扩大动作。

## 6. 静态L1
真实MVP环境的范围、分阶段验收、证据和停止条件已明确。未连接真实环境。L1：PASS。