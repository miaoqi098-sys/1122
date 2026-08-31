# BusinessState + ProductStage 规则 V1

## 1. 两个对象必须分开

`BusinessState` 回答：**产品现在经营状态怎么样。**

`ProductStage` 回答：**产品当前处于哪个经营阶段。**

状态可能每天甚至小时级变化；阶段通常更稳定。不能因为一天广告异常，就自动把产品阶段改掉。

## 2. BusinessState

### 输入证据
可引用：
- `MetricSnapshot`；
- Event；
- 验证结果；
- 其他可审计证据。

### 状态维度
`dimension_code` 由后续业务状态字典定义，例如可覆盖流量、转化、利润、库存等，但本 Contract 不抢先固化全部维度。

### overall_status
V1 使用：
- healthy
- attention
- risk
- critical
- unknown

总体状态必须由版本化 `assessment_rule_version` 或明确的人/Agent评估产生，并保留证据。

## 3. ProductStage

### 不固化阶段字典
UI规划只确认“要显示当前阶段”，尚未确认正式阶段枚举，因此本版只要求：
- `stage_code`；
- `stage_definition_version`；
- 进入/退出规则引用；
- 进入时间；
- 判定者与证据。

正式阶段名称、数量、阈值必须在后续产品经营阶段规则中单独确认。

### 阶段切换
阶段切换不能由UI文本修改触发，应至少满足：
1. 当前阶段定义版本存在；
2. entry/exit 条件有证据；
3. 生成新的 ProductStage 记录；
4. 旧阶段保留为 historical；
5. 记录 `previous_stage_id`。

## 4. 人工覆盖

允许人工覆盖错误或特殊阶段判断，但必须：
- 记录覆盖人；
- 原因；
- 时间；
- 可选失效时间；
- 不删除原自动判定证据。

覆盖属于审计事件，未来应产生 AgentActivity / BusinessActivity。

## 5. 与Goal关系

`ProductStage` 是 Goal 的重要输入之一，但不直接等于 Goal。

例如同一阶段可能因库存、利润或竞争变化拥有不同核心目标。Goal 必须独立建模。

## 6. UI边界

首页产品摘要读取最新 active ProductStage 与最新 BusinessState；UI 不自行推导阶段或修改状态。

产品状态卡需要能够下钻查看：
- 判定时间；
- 规则版本；
- 证据；
- 前一阶段；
- 是否人工覆盖。

## 7. Agent边界

专业 Agent 可提供状态证据和领域评估；Agent-1 可以使用阶段/状态进行综合决策，但系统级阶段对象不能只保存 Agent-1 的自由文本结论。
