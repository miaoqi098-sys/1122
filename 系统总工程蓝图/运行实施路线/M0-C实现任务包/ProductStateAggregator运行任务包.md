# ProductStateAggregator 运行任务包 V1

> 覆盖：R-GP-021

## 1. 输入
ProductIdentity、MetricSnapshot、BusinessState、ProductStage、Goal、Task摘要、今日Action、ImportantEvent、Memory/StageSummary。

## 2. 输出
严格遵循现有 `ProductStatusCardView.schema.json`，不在运行层另造第二套产品卡对象。

## 3. 聚合规则
- `product_id` 为主查询键；
- 每类对象读取最新有效版本；
- 今日Action按 marketplace business_date 过滤；
- 当前Task只读取非终态；
- stale/partial对象不丢弃，但必须反映 degraded/freshness；
- 不允许聚合器修改 Goal/Event/Task/Memory 源对象。

## 4. 性能/缓存语义
未来可缓存读模型，但缓存必须：
- 绑定 source version/freshness；
- 可按 product_id 失效；
- 不得让过期缓存伪装成 fresh；
- 源对象更新后可确定性重建。

## 5. 失败路径
- ProductIdentity不存在 → not_found
- 部分源不可用 → degraded view
- 核心事实全部不可用 → unavailable
- 单一附属模块失败不得拖垮整个产品卡。

## 6. 验收条件
- 同一源对象集产生确定性一致View；
- 可以从View字段反查source refs；
- UI无需跨多个Repository自行拼接；
- 聚合失败不会写入业务源对象。

## 7. 静态L1
运行输入、输出、降级与缓存边界已明确。L1：PASS。