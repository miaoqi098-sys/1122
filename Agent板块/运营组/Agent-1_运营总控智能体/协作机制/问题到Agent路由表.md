# 问题到Agent路由表

## 目的
把常见经营问题快速映射到主负责 Agent 和需要联合验证的 Agent，减少 Agent-1 临时猜测调用对象。

| 问题类型 | 主负责Agent | 常见联合Agent | Agent-1重点判断 |
|---|---|---|---|
| Listing不可售/购物车异常 | Agent-2 | Agent-12、Agent-10 | 是否优先恢复可售、是否存在合规/价格原因 |
| 变体异常/前台展示异常 | Agent-2 | Agent-9、Agent-11 | 是否影响转化与评论结构 |
| 广告高点击无订单 | Agent-4 | Agent-5、Agent-9、Agent-6 | 流量意图、页面承接、利润与测试窗口 |
| ACOS突然升高 | Agent-4 | Agent-5、Agent-6、Agent-10 | CPC、CVR、价格/活动、自然资产 |
| TACOS持续升高 | Agent-4 | Agent-5、Agent-6 | 广告依赖度与整体利润 |
| 自然排名下降 | Agent-5 | Agent-4、Agent-3、Agent-9 | 流量来源、广告联动、竞争与转化 |
| 流量上涨订单不涨 | Agent-5 | Agent-9、Agent-4、Agent-10 | 流量质量还是页面/价格问题 |
| 订单下降但流量稳定 | Agent-9 | Agent-2、Agent-10、Agent-11 | CVR、价格、Buy Box、体验问题 |
| 销量上涨利润下降 | Agent-6 | Agent-4、Agent-10、Agent-7 | 增长质量、广告、促销、库存成本 |
| 库存接近断货 | Agent-7 | Agent-4、Agent-5、Agent-10、Agent-6 | 是否降增长、保核心流量、限制促销 |
| 库存积压 | Agent-7 | Agent-6、Agent-4、Agent-10、Agent-8 | 清货成本、广告承接、价格与需求 |
| 旺季即将开始 | Agent-8 | Agent-7、Agent-4、Agent-10 | 需求机会是否能被库存和价格承接 |
| 竞品突然降价 | Agent-3 | Agent-10、Agent-6、Agent-5 | 临时动作还是结构性竞争，是否值得跟价 |
| 竞品断货/弱化 | Agent-3 | Agent-8、Agent-13、Agent-4 | 是否形成可利用增长窗口 |
| CVR持续下降 | Agent-9 | Agent-11、Agent-10、Agent-5、Agent-2 | 内容、体验、价格、流量结构或商品状态 |
| Rating/退货恶化 | Agent-11 | Agent-9、Agent-2、Agent-6 | 产品真实问题、页面预期错配、利润侵蚀 |
| Coupon/BD/LD规划 | Agent-10 | Agent-6、Agent-7、Agent-4 | 利润、库存、活动资格、广告承接 |
| 参考价/Was Price异常 | Agent-10 | Agent-2、Agent-6 | 价格历史、前台状态、利润和活动影响 |
| 合规通知/Listing冻结 | Agent-12 | Agent-2 | 风险解除、可售恢复、审批与申诉 |
| 新增长方式/新渠道 | Agent-13 | 对应专业Agent | 机会价值、资源、风险、可验证性 |

## 路由优先级
1. 先找最直接负责问题根因的 Agent。
2. 再找会影响“是否行动”的关键约束 Agent。
3. 不因为问题跨域就默认把所有 Agent 都叫来。
4. 当现有新鲜结论已经覆盖问题时，允许复用。
5. 高风险问题优先调用风险/可售相关 Agent，再讨论增长。

## 路由示例
“核心词自然首页第2位，但Exact广告30点击0单，要不要停？”

推荐：
- Agent-4：广告直接效率、Search Term、位置、CPC与历史表现；
- Agent-5：自然排名是否稳定、广告是否仍有增量价值；
- Agent-6：继续投放成本是否可承受；
- Agent-1：判断Exact是否仍有防守/资产价值，决定降价、暂停、保留或测试。

## 核心原则
路由表不是固定审批链，而是默认协作地图。Agent-1仍需根据当前状态、已有证据和决策影响范围动态决定是否增加或减少参与Agent。