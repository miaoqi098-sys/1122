# 04 运营计划数据层

经营计划属于长期经营事实，不是 UI 临时备注。

## D1 对象

- `product_operating_plans`
- `product_plan_goals`
- `product_plan_actions`
- `product_stage_history`

## 核心链

```text
ProductIdentity
↓
ProductOperatingPlan
├── Stage
├── Goal
├── Strategy
└── Action
↓
Agent / A1
↓
Task / Validation
```

## 规则

- 阶段切换必须记录原因与生效时间；
- 目标必须可验证；
- 计划更新必须保留 version（版本）；
- Agent 可以提出阶段/目标调整，但不得静默改写历史计划；
- 页面写入最终必须经过后端 API → D1 → 再读取显示。
