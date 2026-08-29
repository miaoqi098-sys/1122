# 工具与数据需求

## 目标
定义 Agent-9 完成内容质量、页面结构、转化异常和内容实验分析所需的数据与未来工具能力；当前只定义接口，不执行真实Listing修改。

## 核心数据
1. 当前前台页面：标题、五点、主图/副图、A+、视频、品牌故事、属性、变体展示；
2. 后台Listing内容与属性版本；
3. Sessions/Page Views/Unit Session Percentage/Orders等转化数据；
4. 广告与流量结构摘要，来自Agent-4/5；
5. 商品状态、Buy Box、库存/配送等混杂因素，来自Agent-2/7；
6. 价格促销变化，来自Agent-10；
7. 评分/VOC/退货主题，来自Agent-11；
8. 内容实验、Manage Your Experiments或人工前后对照数据（如可得）；
9. 内容版本与发布时间。

## 最低字段
- content_type；
- content_version；
- scope；
- locale/marketplace；
- published_at；
- observed_at；
- source；
- conversion_window；
- metric/value；
- evidence_ref；
- freshness。

## 新鲜度
页面内容和商品状态应高频核对；转化数据日级；实验结果按实验周期；VOC/评分按Agent-11更新节奏。

## 降级规则
- 无内容版本历史：只能诊断当前质量，不能可靠归因版本变化；
- 无稳定转化基线：不得宣布内容优化成功/失败；
- 价格/广告/库存等混杂因素缺失：降低因果等级；
- 页面前后台不一致：优先形成状态/内容冲突事件；
- 移动端真实渲染不可得：移动端诊断标记未验证。

## 未来工具能力
- 前台页面结构采集/截图/解析；
- 后台Listing内容读取；
- 转化指标读取；
- 内容diff与版本管理；
- 实验数据读取；
- Schema验证；
- 合规claim辅助扫描（最终边界仍归Agent-12）。

## 运行依赖
复用R03 Schema Validator、R04 SP-API/官方Listing数据、R06长期记忆数据库、R12前台商品页状态采集。真实Listing发布/修改属于R08执行器或人工流程。
