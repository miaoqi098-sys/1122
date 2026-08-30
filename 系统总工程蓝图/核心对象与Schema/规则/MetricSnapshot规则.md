# MetricSnapshot 规则 V1

## 1. 定位
`MetricSnapshot` 是系统级事实快照对象，用于回答“某个产品在某个业务时间窗口内，哪些经营指标是多少、数据来自哪里、数据是否新鲜、是否完整”。

它不是 Agent 分析结论，不保存“为什么变化”“应该怎么做”等推断或决策。

## 2. 主关联
- 必须通过 `product_id` 关联 `ProductIdentity`。
- ASIN/SKU 仅作为来源或展示信息，不得替代 `product_id` 成为跨模块主键。
- `snapshot_id` 唯一标识一次逻辑快照。

## 3. 时间规则
每个快照必须明确：
- `business_date`：按 marketplace 业务日定义；
- `marketplace_timezone`：解释“今日”的站点时区；
- `window_start/window_end`：本快照实际覆盖区间；
- `collected_at`：系统获取/生成快照时间；
- 单项指标 `effective_at`：该数值实际有效到什么时间。

禁止把不同时间窗口的数据无标记地拼成同一个“今日”结果。

## 4. 新鲜度与质量
快照级：
- `fresh`：满足当前配置的新鲜度SLA；
- `lagged`：来源有已知延迟但仍可使用；
- `partial`：部分来源尚未到齐；
- `stale`：超过允许时效；
- `error`：关键采集或计算失败；
- `unknown`：无法判断。

质量与新鲜度必须分离：数据可以“最新但估算”，也可以“历史但已验证”。

## 5. 指标条目
每个 `metrics[]` 条目必须至少带：
- `metric_code`；
- `value`；
- `value_type`；
- `source_ref`；
- `effective_at`。

由计算得到的指标应提供 `calculation_ref`，以便追溯公式/版本。

## 6. 利润边界
利润不得简单等同于销售额减广告费。

`profit` 必须显式说明：
- `profit_type`；
- `calculation_status`；
- `cost_model_version`；
- 缺失成本项 `missing_cost_components`；
- 计算依据 `calculation_ref`。

当成本不完整时，应使用 `estimated/partial/unavailable`，不得伪装为完整精确利润。

Agent-6 可以解释财务影响与约束，但底层利润事实口径属于数据/业务规则，不应藏在 Agent Prompt 中。

## 7. Agent使用边界
- Agent-5 消费流量相关指标并做结构/趋势诊断；
- Agent-6 消费收入、成本、广告、退款等事实并做利润分析；
- Agent-1 消费快照及专业Agent输出做最终经营决策；
- 任何 Agent 不得修改已落地的历史事实快照来“修正”分析结论。

如来源修正，应生成新快照或版本化修订记录，并保留旧证据链。

## 8. 首页使用
首页“今日经营概览”应读取聚合后的最新可用 `MetricSnapshot`，并同时显示或保留：
- 更新时间；
- 新鲜度状态；
- 数据质量；
- 利润是否估算。

UI不得在数据不完整时隐藏降级状态。
