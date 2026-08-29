# 转化异常诊断

## 目标
当转化下降或异常波动时，先区分内容问题与非内容问题，再决定是否进入内容优化或实验。

## 标准诊断顺序
1. 商品状态：页面是否可售、Buy Box、变体、配送承诺是否异常（Agent-2）；
2. 流量结构：流量来源、关键词、人群是否变化（Agent-4/5）；
3. 价格促销：价格、Coupon、Deal是否变化（Agent-10）；
4. 评价体验：评分、差评主题、退货/VOC是否变化（Agent-11）；
5. 库存与履约：低库存、断货、配送时效是否影响购买（Agent-7/2）；
6. 内容版本：标题、图片、A+、视频、属性是否发生变更；
7. 页面内容质量：是否存在信息缺失、冲突、信任或理解问题。

## 异常类型
- `CVR_DROP_WITH_STABLE_TRAFFIC`；
- `CVR_DROP_AFTER_CONTENT_CHANGE`；
- `MOBILE_CONVERSION_GAP`；
- `VARIATION_CONVERSION_GAP`；
- `CONTENT_MISMATCH`；
- `BUYER_CONFUSION_SIGNAL`；
- `CONTENT_OPPORTUNITY`；
- `DATA_QUALITY_RISK`。

## 因果等级
- `observed_correlation`：仅观察到同时变化；
- `plausible_driver`：有机制与多证据支持；
- `experiment_supported`：实验或清晰前后对照支持；
- `confirmed`：仅在证据充分且混杂因素被控制时使用。

## 输出要求
必须给出：当前CVR、基线、样本量/窗口、非内容混杂因素、内容版本、候选原因、证据等级、置信度、需要其他Agent补充的证据和建议验证方式。

## 禁止事项
- 不把相关性直接写成因果；
- 不忽略价格/评价/流量变化；
- 不在低样本下宣布内容优化成功/失败；
- 不因为某张图“看起来不好”就认定它导致转化下降。
