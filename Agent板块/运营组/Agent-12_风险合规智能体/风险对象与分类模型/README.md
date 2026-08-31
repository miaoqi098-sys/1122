# 风险对象与分类模型

## 目标
统一 Agent-12 需要处理的风险对象、风险域和证据关系，避免把所有异常都笼统标成“合规风险”。

## 一级风险域
1. `ACCOUNT_HEALTH`：账户健康、绩效、权限、销售资格；
2. `LISTING_POLICY`：Listing受限、冻结、删除、分类/属性政策；
3. `CONTENT_CLAIM`：夸大、绝对化、医疗/健康/安全/认证等内容claim；
4. `PRODUCT_COMPLIANCE`：产品法规、认证、标签、文件、适用年龄/用途；
5. `DANGEROUS_GOODS`：电池、化学品、危险品分类与运输/仓储要求；
6. `INTELLECTUAL_PROPERTY`：商标、版权、专利、外观、品牌使用等风险；
7. `REVIEW_POLICY`：评价激励、操纵、异常互动、举报等政策风险；
8. `PROMOTION_POLICY`：价格/促销相关合规与资格风险；
9. `CUSTOMER_SAFETY`：伤害、过热、火灾、窒息、误用等安全信号；
10. `DOCUMENT_QUALIFICATION`：资质、检测报告、发票、授权书、合规文件；
11. `DATA_PRIVACY_SECURITY`：涉及消费者/账户数据的隐私与安全风险；
12. `OTHER_PLATFORM_POLICY`：其他平台政策风险。

## 风险对象
每个风险对象至少记录：
- risk_id；
- risk_domain；
- scope；
- marketplace；
- subject；
- observed_at；
- status；
- severity；
- applicable_rule_refs；
- factual_evidence；
- missing_evidence；
- eligibility_status；
- required_controls；
- owner_agents；
- confidence。

## 状态生命周期
`signal → under_review → confirmed_risk / not_supported → remediation_required → remediating → resolved → monitoring`

规则或证据不足时可以进入 `needs_more_evidence`，但不得伪装成 confirmed_risk。

## 风险域与事实域分离
Agent-2/9/11 等Agent提供商品状态、内容、评价体验事实；Agent-12负责把这些事实映射到当前适用规则。事实异常不自动等于政策违规。

## 风险聚合
同一问题可能跨多个风险域，例如含电池商品同时涉及危险品、运输、Listing claim和资质。允许建立主风险+关联风险，不强制只归一个分类。
