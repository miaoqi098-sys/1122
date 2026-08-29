# 机会组合与去重

## 目标
避免多个Agent从不同角度重复描述同一增长机会，并识别机会之间的协同、冲突和依赖。

## 去重指纹
机会指纹建议：
`scope + primary_mechanism + target_metric + validation_action + time_window`

名称不同但核心机制/目标/验证动作相同的机会应合并，保留全部来源证据。

## 关系类型
- `duplicate`：本质同一机会；
- `synergy`：联合实施可能放大结果；
- `depends_on`：机会A需先完成B；
- `conflicts_with`：资源/策略/约束冲突；
- `mutually_exclusive`：不能同时测试/实施；
- `independent`：可并行。

## 组合原则
例如“扩大高转化词广告”与“旺季需求上涨”可能协同，但若库存不足，则同时受Agent-7硬约束。组合机会必须重新检查整体利润、库存与风险，不能把各子机会的资格机械相加。

## Portfolio对象
- portfolio_id；
- opportunity_ids；
- combined_hypothesis；
- relationship_map；
- shared_constraints；
- resource_requirements；
- combined_measurement_plan；
- conflicts；
- recommended_sequence；
- confidence。

## 防无限生成
同一机会指纹已存在candidate/qualified/testing时，不重复创建；新证据追加到既有对象。只有机制、scope或验证动作实质变化才新建机会。

## 边界
Agent-13可以提出机会组合与推荐验证顺序，但最终资源优先级、并行度和策略切换由Agent-1决定。
