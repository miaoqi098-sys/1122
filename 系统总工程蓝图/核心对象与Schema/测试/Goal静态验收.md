# Goal 静态验收 V1

## L1目标
验证 Goal 已成为系统级可引用对象，并与 Agent-1 目标管理逻辑保持正确边界。

## 验收项
- [x] `goal_id` 独立且可被 Task/Action/Validation/Memory 引用；
- [x] 产品级 Goal 强制关联 `product_id`；
- [x] 可追溯 ProductStage、BusinessState、Event、FinalDecision 来源；
- [x] 区分 primary/secondary/supporting/watch 角色，但不复制 Agent-1 冲突排序算法；
- [x] 至少一个结构化 success criterion；
- [x] 目标指标可引用 baseline；
- [x] 有 observation window 与 review 时间；
- [x] 支持 proposed/active/paused/achieved/failed/cancelled/expired/superseded 生命周期；
- [x] 目标切换保留旧 Goal，不覆盖历史；
- [x] Goal 与 Task/Action/Validation 职责分离；
- [x] 示例明确为结构示例，不构成真实经营建议；
- [x] 未进入真实执行或运行实现。

## 负向检查
- 只有“提升销量”一句话、没有成功标准：不合格。
- UI直接覆盖当前目标标题而不生成目标变更记录：不合格。
- 把 Agent-1 的目标优先级规则复制进 Goal Schema：职责越界。
- Task完成即自动把 Goal 标记 achieved：不允许，必须经过目标效果验证。
- 切换目标时删除旧目标：不允许。

## 运行依赖
未来需 Goal Repository、目标评估器、目标切换事件记录、与 Task/Validation 的运行关联，以及产品状态卡聚合查询。不阻塞当前静态 Contract。

## L1结论
`✅ 通过`。
