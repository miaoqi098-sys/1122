# 配置与日志

## 配置项
- 评分下降阈值；
- 低星评论占比阈值；
- review velocity异常阈值；
- VOC主题聚类版本；
- 主题新建/合并规则；
- 退货/退款成熟窗口；
- 异常评价模式阈值；
- 安全/合规主题升级规则；
- 数据新鲜度要求。

## 配置版本
主题分类、阈值和异常规则必须版本化，记录 `config_version`、`effective_from`、`changed_fields`、`reason`。配置变化不得修改历史事件原始证据。

## 审计日志
至少记录：
- analysis_id / event_id / response_id；
- scope/variation；
- rating/review基线；
- theme_version；
- return_window；
- anomaly_signals；
- evidence_refs；
- confidence；
- requires_agent_12_review；
- 生成与复核时间。

## 原则
原始评论/VOC证据与聚类结果分开保存；主题模型变化后可重新聚类，但必须保留原始文本与旧版本结果。
