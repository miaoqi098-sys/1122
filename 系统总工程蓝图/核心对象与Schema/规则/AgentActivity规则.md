# AgentActivity 规则 V1

## 1. 定位
AgentActivity 是给业务用户理解“Agent 今天做了什么”的结构化业务活动记录，不是工程调试日志，也不是 Action 操作台账。

```text
EngineeringLog = 给工程师排错
AgentActivity = 给业务用户理解智能体活动
Action = 已真实发生的经营动作
```

## 2. 生成原则
优先由关键业务对象状态变化生成结构化 Activity，而不是让 Agent 自由生成一段自然语言后直接写入活动流。

V1核心活动：
- Event 发现；
- FinalDecision 形成；
- Task 创建；
- Action 完成；
- Validation 完成。

状态更新与重要 Memory 写入可作为扩展活动。

## 3. 引用要求
存在关联对象时必须带对应 source_*_id；产品级活动应携带 `product_id`。
Activity 不得成为 Event/Decision/Task/Action 的唯一事实来源，它只是业务可见投影。

## 4. 降噪
首页默认依据 importance + visibility 过滤；同一产品短时间内大量同类活动应由聚合层去重/合并，原始业务对象不删除。

## 5. 可见性
- home：允许进入首页 Agent 今日动态；
- product：仅产品视角优先展示；
- detail_only：详情历史；
- hidden：保留审计但不面向普通业务UI。

## 6. 隐私与推理边界
AgentActivity 不保存私有链式思考；只记录可审计的业务事实、公开理由、对象引用与结果状态。

## 7. 运行依赖
Activity Generator、Activity Repository、聚合/去重和首页读取服务属于后续运行建设。