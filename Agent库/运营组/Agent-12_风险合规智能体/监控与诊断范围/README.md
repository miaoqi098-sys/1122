# 监控与诊断范围

## 核心风险事件
1. `ACCOUNT_HEALTH_RISK`：账户健康/绩效通知/销售权限风险；
2. `LISTING_RESTRICTED_OR_FROZEN`：商品受限、冻结、移除或资质审核；
3. `PRODUCT_COMPLIANCE_GAP`：产品合规文件/标签/认证缺失或冲突；
4. `DANGEROUS_GOODS_RISK`：电池、化学品、危险品分类/运输要求风险；
5. `IP_RISK`：商标、版权、专利、品牌授权等知识产权风险；
6. `CONTENT_CLAIM_RISK`：内容claim可能触及平台/监管规则；
7. `REVIEW_POLICY_RISK`：评价激励、操纵或异常互动风险；
8. `CUSTOMER_SAFETY_RISK`：伤害、火灾、过热、窒息等安全信号；
9. `DOCUMENT_REVIEW_RISK`：资质/文件审核中、过期、信息不一致；
10. `PROMOTION_POLICY_RISK`：促销/价格规则风险；
11. `POLICY_CHANGE_IMPACT`：政策版本变化影响现有商品/流程；
12. `DATA_QUALITY_RISK`：规则或事实证据不足。

## 诊断顺序
- 确认scope和marketplace；
- 区分“事实异常”与“规则风险”；
- 找到当前适用rule_version；
- 对比事实证据与规则要求；
- 检查证据新鲜度和缺失资料；
- 评估severity与eligibility；
- 明确required_controls、整改/补证据路径；
- 高风险/多域冲突升级Agent-1。

## 高优先级条件
涉及账户销售权限、消费者安全、明确禁限售、严重知识产权、关键资质失效或可能导致商品长期不可售时，默认高/critical风险处理。

## 诊断边界
- 商品冻结事实由Agent-2提供状态证据，Agent-12解释合规/政策含义；
- VOC安全信号由Agent-11提供，Agent-12判断是否触发风险门；
- 内容claim由Agent-9发现/维护内容事实，Agent-12评估规则风险；
- 不在规则证据不足时作确定性法律/平台裁定。
