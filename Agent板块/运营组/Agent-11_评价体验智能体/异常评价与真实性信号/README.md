# 异常评价与真实性信号

## 定位
本模块只识别“值得进一步核查”的评价异常模式，不直接认定评论违规、虚假、恶意或由竞对操纵。最终风险/合规判断归 Agent-12。

## 可观察异常信号
- 短时间内评论数量异常集中；
- 评论星级分布突然极端变化；
- 多条评论文本高度相似或重复；
- 评论内容与产品真实材质/规格明显冲突；
- 评论提及并不存在的功能/结构；
- 变体/产品归属与评论描述明显不匹配；
- 评论节奏与订单/销量背景显著不一致；
- 多个异常特征在同一窗口叠加。

## 标准字段
- anomaly_id；
- scope；
- observed_window；
- anomaly_types；
- affected_reviews；
- baseline_review_velocity；
- current_review_velocity；
- text_similarity_signal；
- product_fact_conflict；
- purchase_context（如可得）；
- confidence；
- evidence_refs；
- requires_agent_12_review=true。

## 置信度原则
单一异常信号只能形成低/中置信候选；多个独立异常同时出现才提高风险等级。任何情况下都应使用“疑似/异常信号/需核查”，不写“已证实违规”。

## 与Agent-12边界
Agent-11负责：识别模式、整理评论证据、产品事实冲突、时间聚集和主题异常。
Agent-12负责：平台政策解释、违规资格、申诉/举报证据充分性、行动风险。

## 禁止事项
- 不根据卖家主观怀疑直接标记竞对操纵；
- 不因负面评论内容不利就判定虚假；
- 不把评论者身份猜测作为事实；
- 不自动执行举报或删除请求。
