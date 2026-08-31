# 工程需求反向拆解

本目录用于把已经确认的 UI / 用户结果反向拆解为后台工程需求。

## 当前文件

- `首页六大区域_后台工程需求反向拆解_V1.md`

## 当前方法

所有 UI 需求必须能够追溯到：

```text
UI需求
→ 核心对象
→ 数据来源
→ 生产/判断主体
→ Agent / Skill
→ Task / Approval
→ Action / Execution
→ Validation
→ Memory / Knowledge
→ UI聚合
```

## 当前阶段结论

首页反推后，系统最优先需要统一的对象包括：
- ProductIdentity
- MetricSnapshot
- BusinessState / ProductStage
- Goal
- Event
- Task
- Approval / HumanActionRequest
- Action
- ExecutionResult
- AgentActivity
- Memory

随后优先建设：
- TaskCenter
- ProductStateAggregator
- HomeCommandCenterAggregator
- 单产品纵向 MVP

本目录只记录已经完成的工程分析与正式拆解结果；真实 API、数据库、运行时和生产执行权限需后续单独建设。
