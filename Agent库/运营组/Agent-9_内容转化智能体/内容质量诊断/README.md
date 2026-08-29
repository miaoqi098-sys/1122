# 内容质量诊断

## 目标
系统识别Listing内容在完整性、准确性、清晰度、信任、差异化和购买阻力上的问题，而不是只做文案润色。

## 诊断维度
1. `COMPLETENESS`：关键规格、适用对象、使用方式、配件、尺寸、兼容性是否缺失；
2. `CONSISTENCY`：标题、五点、图片、A+、属性、变体信息是否一致；
3. `CLARITY`：信息是否易读、易理解，是否存在模糊表述；
4. `VALUE_PROPOSITION`：核心价值和差异化是否明确；
5. `EVIDENCE_TRUST`：关键卖点是否有产品事实/视觉/规格支撑；
6. `OBJECTION_HANDLING`：常见购买疑虑是否得到解释；
7. `VISUAL_HIERARCHY`：主图/副图/A+信息顺序是否支持购买决策；
8. `MOBILE_USABILITY`：移动端首屏、裁切、字号和信息密度；
9. `VARIATION_CLARITY`：变体差异、颜色/尺寸/套装信息是否清楚；
10. `COMPLIANCE_RISK`：疑似夸大、绝对化、医疗/安全/认证等高风险claim，转Agent-12。

## 诊断输出
每个问题记录：
- issue_id；
- content_type；
- location；
- issue_type；
- severity；
- evidence；
- impacted_question；
- potential_conversion_impact；
- recommended_direction；
- requires_agent_12_review；
- confidence。

## 优先级
优先处理会导致购买误解、规格冲突、错误期待、关键卖点不可见和高风险claim的问题；审美偏好类问题默认低于事实/购买阻力问题。

## 边界
Agent-9提出内容方向与实验假设；最终文案/图片制作可由内容工具或人工完成，真实发布属于执行层。
