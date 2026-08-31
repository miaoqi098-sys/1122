# Agent-4｜工具与数据需求

## 1. 定位
本目录定义Agent-4未来运行时需要的数据、报表、工具和动作权限，只定义需求合同，不在Agent库阶段实现真实API连接或执行器。

## 2. 核心数据源
未来优先需要Amazon Ads API或等价可靠来源提供：
- campaign/ad_group/ad/target实体与状态；
- keyword/product targeting/auto targeting配置；
- search term报表；
- impressions/clicks/spend/orders/sales等绩效；
- bid/budget/placement及变更历史；
- 广告类型、marketplace、currency、attribution definition；
- 报表生成时间、数据窗口、完整性与延迟信息。

## 3. 必备读取能力
- 按account/store/marketplace/product/campaign/ad_group/target/search_term查询；
- 当前窗口与历史基线窗口对比；
- 广告实体关系解析；
- 搜索词到source target映射；
- 历史配置和策略变更读取；
- 报表缺失、延迟、异常状态识别。

## 4. 未来动作能力
Agent-4只定义动作需求，不直接拥有最终执行权：
- update_bid；
- update_budget；
- update_placement_adjustment；
- enable/pause entity；
- create keyword/product target；
- create negative exact/phrase；
- create/move/copy campaign or ad_group structure。

这些动作未来由执行层在FinalDecision、审批、权限和幂等控制下调用。

## 5. 数据合同要求
任何数据包应附带：source_ref、source_system、generated_at、data_window、attribution_definition、currency、timezone、freshness、completeness、missing_fields、marketplace。

## 6. 时效与降级
- 实体配置数据应尽可能接近当前状态；
- 绩效报表允许归因延迟，但必须显式记录；
- search term数据缺失时不得输出精准否定/迁移结论；
- 历史窗口不足时只能输出low confidence观察；
- 数据源冲突时保留多源证据并升级，不静默选一个。

## 7. 权限边界
读取权限与写入权限分离。Agent-4可以需要读取完整广告数据，但任何真实写动作必须由执行层验证：FinalDecision引用、Task、审批、权限、目标实体版本、幂等键和回滚条件。

## 8. 运行依赖
复用 `临时建设任务/运行依赖待办.md` 中R05 Amazon Ads API Connector、R07调度器、R08执行器、R09 ExecutionResultNormalizer、R03 Schema Validator等，不重复创建等价依赖。