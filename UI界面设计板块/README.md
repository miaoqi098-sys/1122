# UI界面设计板块｜V2 最新版

> 当前定位：1122 的统一 UI 信息架构、导航、页面路由、读模型与交互契约承载区。
> 正式架构：12+1+1。
> 真值边界：UI 展示系统事实和建议，不自行创造业务事实，不绕过 Agent-1 / Task / Approval / Permission Boundary。

## 一、最新一级导航

终端用户主导航正式对应 12 个一级业务/系统板块：

1. 选品
2. 运营
3. 沙盘演练
4. 系统政策边界
5. 亚马逊经营边界探索
6. Agent
7. 技能
8. 对外连接
9. 任务中心
10. 知识
11. 记忆
12. 数据

UI界面设计板块与系统冲突问题库属于系统支撑入口，不作为日常经营主导航。

统一导航真值文件：

`UI界面设计板块/NavigationRegistry.v2.json`

## 二、首页：经营指挥中心

首页 route：`/command-center`

首页必须优先回答：

- 今天整体经营怎么样；
- 哪些事情需要我处理；
- Agent 今天做了什么；
- 每个产品目前是什么状态；
- 当前有哪些重要异常与机会；
- Amazon 最近有哪些重要政策/边界变化；
- APR 最近发现了哪些市场玩法；
- 有哪些 AOM 方法值得当前产品采用。

首页核心区域：

1. 今日经营概览
2. 今日需要我处理
3. Agent 今日动态
4. 产品经营状态与今日操作
5. 重点异常与机会
6. Amazon 政策 / Boundary Alerts
7. APR 最新探索
8. AOM 推荐方法

## 三、运营入口

`/operations`

```text
运营
├── 产品 /operations/products
├── 库存物流 /operations/inventory-logistics
├── 站外推广 /operations/offsite
├── 竞品 /operations/competitors
└── 广告 /operations/ads
```

### 产品级入口

`/products/:product_id`

产品状态卡至少包含：

- 今日经营
- 当前经营阶段
- 当前核心目标
- 今日已执行操作
- 当前进行中的任务
- 流量与转化
- 价格与促销
- 利润与经营
- 消费者体验
- 广告摘要
- 库存摘要
- 竞品摘要
- Amazon 政策影响
- APR 相关市场模式
- AOM 推荐方法
- 最近阶段总结 / 完整历史

商品政策影响子入口：

`/products/:product_id/policy-impact`

## 四、亚马逊经营边界探索中心

主入口：`/amazon-boundary`

这是当前 1122 的重点经营情报界面之一，内部明确分成三层：

### APR｜市场玩法探索【重点】

route：`/amazon-boundary/apr`

展示市场上真实观察到的玩法、边界模式和结果，包括：

- APR 编号
- 经营目标
- 观察结构
- 观察效果
- 重复性
- 持续性
- Policy Relation
- Business Value Signal
- Confidence
- Detection Signals
- 对我方的影响
- Defense / Opportunity
- 对应 AOM 替代方法

APR 可以记录合规、条件允许、未知或非合规的市场现象；它是情报与参考层，不直接形成生产执行权。

### AOM｜正向运营方法

route：`/amazon-boundary/aom`

展示系统认为值得运营采用的方法：

- AOM 编号
- 方法名称
- 经营目标
- 适用商品
- 适用条件
- 操作步骤
- 成本
- 预期收益
- 衡量指标
- Policy Status
- Risk Level
- 关联证据

### APB｜政策与边界证据

route：`/amazon-boundary/apb`

展示：

- Amazon 官方 Policy Evidence
- Policy Diff
- Expected State
- Observed State
- Boundary Signal
- Boundary Candidate
- Confirmed Boundary Result
- Product Impact

APB 负责证据与边界，不是运营方法首页。

## 五、沙盘演练

route：`/sandbox`

沙盘 UI 必须围绕我方 `LIVE_ASIN_DIGITAL_TWIN` 展示：

- frozen twin version
- scenario
- tactic cards
- timeline
- Low / Base / High
- cost/effect
- R0 = NO_RESPONSE
- response packages
- revised operations strategy

沙盘结果只提供策略证据，不直接执行。

## 六、Agent

route：`/agents`

至少展示：

- Agent-1 总控状态
- Agent-2 ~ Agent-13 专业 Agent
- 当前输入事件
- 分析状态
- 当前判断
- 关联 Decision
- 关联 TaskDraft
- 是否等待人工审批
- 最近执行链状态

用户必须能追溯“是谁判断的、为什么、进入了哪个任务”。

## 七、任务中心

route：`/tasks`

任务中心作为执行操作系统 UI，应支持：

`Decision → TaskDraft → Approval → Permission → Queue → Execute → Outcome`

建议展示状态：

- draft
- pending_approval
- approved
- queued
- running
- success
- failed
- cancelled
- rolled_back（支持时）

任何生产写操作都必须显示审批和权限状态。

## 八、系统政策边界

route：`/governance`

回答的是 1122 自身：

- 系统允许谁做什么；
- 哪些动作需要审批；
- 哪些权限可以使用；
- 哪些动作必须 fail-closed；
- 当前 Action Authority 是什么。

与 `/amazon-boundary` 永久分开。

## 九、数据中心

route：`/data`

展示系统事实层健康状况与可追溯性：

- HOT / KV current state
- WARM / D1 facts
- COLD / R2 archives（可用时）
- Snapshot freshness
- Data quality
- Source provenance
- ingestion status
- schema / migration status

数据中心不允许直接修改 Amazon 经营状态。

## 十、全局快捷入口

首页或顶部快捷栏至少提供：

- 今日需要我处理
- Agent 今日动态
- 最新 APR 探索
- 推荐 AOM 方法
- Amazon 政策变化

用户应能从经营问题快速进入对应页面，而不是先理解仓库架构。

## 十一、UI 联动原则

```text
真实经营事实
   ↓
数据板块
   ↓
Agent / APR / APB / Sandbox
   ↓
AOM / Decision / Task
   ↓
UI Read Model
   ↓
经营指挥中心 / 产品状态卡 / 专项中心
```

### 商品联动

如果 APR/APB/AOM 与具体 Product/ASIN 相关：

- 专项中心显示对应商品；
- 产品状态卡显示对应摘要；
- 高重要度事项进入首页；
- 真正需要人工介入的事项进入“今日需要我处理”。

## 十二、当前正式 UI 契约

- `NavigationRegistry.v2.json`
- `经营指挥中心/HomeCommandCenterAggregatorV0/HomeCommandCenterView.schema.json`
- `产品状态卡/ProductStateAggregatorV0/ProductStatusCardView.schema.json`
- `产品状态卡/ProductStateAggregatorV0/ProductPolicyImpactView.schema.json`
- `亚马逊政策边界中心/AmazonPolicyBoundaryView.schema.json`
- `亚马逊政策边界中心/APRExplorationView.schema.json`
- `亚马逊政策边界中心/PositiveOperatingMethodView.schema.json`

## 十三、权限边界

UI 不等于 Executor。

任何页面展示“可以做”都不代表生产写权限已经授予。

真实写操作必须继续经过：

`Agent-1 → Task → Approval Gate → Permission Boundary → Executor`

默认：

- execution_authorized=false
- production_write_authorized=false
- amazon_write=false
- ads_write=false
