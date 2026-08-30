# 单产品纵向 MVP V0

> 状态：静态工程设计中
> 目的：用一个产品、一个广告异常、一个人工审批任务，验证整条系统链是否能闭合。

## 1. 固定业务链
```text
ProductIdentity
  ↓
MetricSnapshot（销售 + 广告）
  ↓
广告异常 Domain Event
  ↓
Canonical Event
  ↓
Agent-4 专业分析
  ↓
Agent-1 FinalDecision
  ↓
Task（需要人工批准）
  ↓
HumanActionRequest + Approval
  ↓
Action
  ↓
ExecutionResult
  ↓
ValidationResult
  ↓
Memory / StageSummary
  ↓
ProductStatusCardView
  ↓
HomeCommandCenterView
```

## 2. MVP成功定义
V0静态成功不是“真实改了广告”，而是：
- 每个环节都有明确对象；
- ID可前后追溯；
- 人工审批不会被绕过；
- Action 与 Task 分离；
- ExecutionResult 与 Validation 分离；
- UI 两个入口能从同一对象链获得一致结果；
- 运行依赖被明确登记。

## 3. 未来真实运行成功定义
只有后续接入真实数据/API/存储/执行器后，才能验证：
- 真实 Amazon 数据生成 MetricSnapshot；
- 真实广告异常被识别；
- Agent-4/Agent-1 运行链真实执行；
- 用户真实审批；
- Ads API 真实执行受控动作；
- 执行后效果真实验证；
- UI读取真实链路。

## 4. 本阶段不做
- 不绑定用户真实 ASIN；
- 不接 Amazon Ads API；
- 不执行竞价/预算变更；
- 不部署数据库/Runner/Scheduler/Executor；
- 不声明 BUSINESS_LOOP_VERIFIED。

## 5. 文件
- `对象链与ID追溯.md`
- `UI回写映射.md`
- `示例/AdvertisingApprovalLoop.example.json`
- `测试/单产品纵向MVP静态验收.md`