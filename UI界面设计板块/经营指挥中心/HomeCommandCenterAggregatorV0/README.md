# HomeCommandCenterAggregator V0

> 定位：首页“经营指挥中心”的统一只读聚合层。

## 1. 输入来源
- 今日经营概览：MetricSnapshot / 经营聚合结果；
- 今日需要我处理：TaskCenter → HumanTaskView；
- Agent今日动态：AgentActivity；
- 产品经营状态与今日操作：ProductStateAggregator → ProductStatusCardView；
- 重点异常与机会：Event / ProcessedEvent 业务投影；
- 左侧导航：ModuleRegistry / Permission（独立提供，不在本聚合器内重定义）。

## 2. 输出
`HomeCommandCenterView`。

## 3. 核心原则
- 首页只读取结构化业务对象/读模型，不直接请求十几个 Agent 的自然语言输出；
- 聚合器只读，不改变任务、事件、目标、状态；
- 每个区域必须保留更新时间/新鲜度/降级状态；
- 单一区域失败不能默认让整个首页完全不可用；
- 首页展示摘要，点击后进入真实业务对象或对应详情页。

## 4. 不负责
- 不做经营决策；
- 不创建 Task/Action；
- 不做审批；
- 不生成 Event；
- 不实施真实 API/缓存/数据库。

## 5. V0文件
- `HomeCommandCenterView.schema.json`
- `规则/首页聚合与降级规则.md`
- `测试/HomeCommandCenterAggregatorV0静态验收.md`