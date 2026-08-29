# Agent-6｜成本与收入模型

## 1. 目的
建立统一单位经济模型和期间经营模型，避免不同任务使用不同“利润”定义。

## 2. 收入侧
至少区分：list_price、selling_price、gross_sales、discount/coupon/deal impact、refunds/returns、net_sales。若平台报表已净额化，必须记录definition_version，避免重复扣减。

## 3. 成本侧
框架至少支持：
- product_cogs：采购/制造成本；
- inbound_freight_and_duty：头程、关税及入仓相关成本；
- amazon_referral_fee；
- fba_fulfillment_fee；
- storage_fee及长期/超龄仓储相关费用；
- advertising_cost；
- promotion_cost；
- refund_return_loss；
- disposal_removal_loss；
- other_variable_cost；
- allocated_fixed_cost（可选，必须说明分摊方式）；
- tax_or_vat（按业务口径和marketplace明确）。

## 4. 单位经济对象
建议字段：scope、marketplace、currency、unit_price、unit_net_revenue、unit_cogs、unit_amazon_fees、unit_fulfillment_cost、unit_ad_cost、unit_promo_cost、unit_refund_loss、unit_storage_allocation、unit_other_cost、unit_contribution_profit、definition_version、source_refs、effective_at。

## 5. 期间模型
期间分析需记录units_sold、orders、gross_sales、net_sales、各成本总额、contribution_profit、period、currency和口径。单位指标与期间总额不可混用。

## 6. 分摊
仓储、固定成本、广告成本等若需要分摊，必须记录allocation_method。无法合理分摊时保持unallocated，不伪造精确单位成本。

## 7. 版本
任何费用、采购成本、汇率、税费或分摊规则变化都形成新的cost_profile_version；历史结果不得用当前成本静默重算后替换原始结果。

## 8. 数据缺失
缺失关键成本时输出incomplete/estimated，并列明missing_cost_components。不得在成本不完整时宣称“净利润”。