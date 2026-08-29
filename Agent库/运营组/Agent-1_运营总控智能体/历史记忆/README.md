# Agent-1 历史记忆

## 1. 模块定位
`历史记忆/` 定义 Agent-1 在做新决策时应如何读取和解释过去发生过的经营事实、决策、任务、执行、验证与经验记录。

它不是数据库实现，也不是案例库的重复副本。它定义“应该记什么、如何引用、何时仍有效、如何避免旧结论机械覆盖新事实”。

## 2. 正式记忆链
```text
经营事实/Event
→ DecisionItem / FinalDecision
→ TaskPlan / Task
→ ExecutionResult
→ ValidationResult
→ LearningRecord
```

上述对象均应保留各自主键和引用，不应压缩成一条混合的`history record`后丢失对象边界。

## 3. 与 S02 的边界
S02按当前问题装载最小充分历史，不要求把全部历史塞进ContextPackage。历史记录必须提供freshness、scope、时间和来源，使S02能判断：
- 哪些仍有效；
- 哪些只适合作为背景；
- 哪些必须刷新；
- 哪些冲突会改变当前决策。

## 4. 与 S09 的边界
S09负责从ValidationResult生成分层的fact/interpretation/LearningRecord与memory_writes计划。

历史记忆模块负责定义这些对象未来如何被保存和复用；不自行把一次执行结果总结成“经验真理”，也不伪造written状态。

## 5. 与案例库边界
- 历史记忆：保存真实发生过的对象、版本、状态和引用链。
- 案例库：把一段完整经营过程组织成便于复盘、检索和类比的Case。
- 一个Case可以引用多条历史对象；历史对象不因进入Case而复制成第二份事实源。

## 6. 统一scope
历史记录支持 product / parent_product / sku / account / store / global / campaign / ad_group / keyword / task / decision 等作用域，不再强制所有历史绑定product_id/ASIN。

## 7. 分层
- 产品与经营事实历史；
- 决策历史；
- Task/ExecutionResult历史；
- ValidationResult历史；
- LearningRecord经验历史；
- StrategyChain跨版本关系。

## 8. 核心原则
- 历史是证据和上下文，不是永久真理。
- 失败记录不得删除。
- 新记录与旧记录冲突时保留双方及关系，不直接覆盖。
- 事实、解释、经验必须分层。
- valid_until/freshness必须被检查。
- 旧决策被supersede后仍保留历史。
- 只有真实持久化层回执才能说明记录已written。

## 9. 文件结构
- `产品历史记录规范.md`
- `决策历史.md`
- `任务与执行历史.md`
- `验证历史.md`
- `经验历史.md`
- `新鲜度与复用.md`
- `案例库边界.md`
- `示例与验收.md`
- `总验收记录.md`

## 10. 当前阶段
真实长期存储、索引、版本和检索属于R06长期记忆数据库；S09写入执行属于R10；StrategyChain持久化属于R11。