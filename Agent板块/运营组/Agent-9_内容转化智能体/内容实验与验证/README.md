# 内容实验与验证

## 定位
本模块定义内容变更如何形成可验证实验，避免“改完看到数据波动就归功于内容”。

## 实验对象
- 标题结构；
- 主图/副图顺序与信息；
- 五点卖点表达；
- A+/高级A+结构；
- 视频；
- 变体命名与选择信息；
- FAQ/购买疑虑信息。

## 标准实验字段
- experiment_id；
- hypothesis；
- scope；
- content_version_control；
- content_version_variant；
- primary_metric；
- guardrail_metrics；
- start_at / end_at；
- minimum_observation_window；
- sample_size_status；
- confounders；
- result；
- confidence；
- decision_boundary。

## 实验原则
1. 一次实验尽量只改变一个主要变量；
2. 实验前冻结基线与内容版本；
3. 明确主要指标与保护指标；
4. 记录价格、促销、广告、评价、库存等混杂因素；
5. 未达到观察窗口/样本要求时状态为 `inconclusive`；
6. 结果需区分统计变化与业务价值；
7. 实验结论只证明当前条件下的效果，不永久泛化到所有产品。

## 非正式前后对照
如果无法进行严格A/B，可使用before/after观察，但因果等级不得高于 `plausible_driver`，除非混杂因素被充分控制。

## 结果状态
`planned / running / inconclusive / positive / negative / mixed / invalidated`

## 失效条件
实验期间发生大促、严重断货、价格大幅变化、评分突变、流量结构重构或页面状态异常时，应标记 `invalidated` 或降低置信度。

## 与Agent-1关系
Agent-9负责实验假设、证据与结果；是否采用内容版本、是否扩大实施由Agent-1决策并通过执行层落实。
