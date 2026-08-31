# 内容对象与页面结构

## 目标
统一 Listing 页面中 Agent-9 需要分析的内容对象、版本和层级，避免只看单一标题或主图。

## 核心内容对象
- `title`：标题；
- `bullet_points`：五点/卖点；
- `main_image`：主图；
- `secondary_images`：副图；
- `a_plus`：A+内容；
- `premium_a_plus`：高级A+；
- `video`：视频；
- `brand_story`：品牌故事；
- `product_attributes`：属性/规格；
- `variation_labels`：变体名称与展示；
- `qa`：问答；
- `comparison_table`：对比模块；
- `mobile_rendering`：移动端展示结构。

## 标准内容字段
每个内容对象至少记录：
- content_type；
- content_id/ref；
- version；
- locale；
- marketplace；
- published_at；
- source；
- status；
- content_summary；
- factual_claim_refs；
- compliance_flags；
- last_verified_at。

## 页面信息层级
Agent-9按购买路径检查：
`第一印象 → 核心价值 → 关键规格/适用对象 → 使用方式/场景 → 信任证据 → 风险消除 → 选择/变体 → 购买决策`

## 一致性规则
- 标题、五点、图片、A+中的规格不得互相冲突；
- 产品事实必须可追溯到Agent-2/产品资料或可信来源；
- 价格、优惠、评价等动态事实不写死进长期内容规范；
- 变体之间不得共享不适用于全部子体的事实陈述；
- 移动端裁切和信息优先级必须单独检查。

## 边界
本模块描述内容对象与页面结构，不负责最终合规判断；高风险claim交Agent-12审核。
