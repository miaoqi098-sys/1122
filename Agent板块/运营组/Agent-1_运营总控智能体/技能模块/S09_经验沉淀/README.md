# S09｜经验沉淀

## 技能定位
S09把S08 ValidationResult中的事实、解释、产品经验和知识候选分层沉淀，使Agent-1未来能够复用经过证据约束、知道适用边界和失效条件的经营经验。

S09不是聊天摘要器，也不是数据库执行器；它决定“什么值得记、记成什么等级、与旧经验是什么关系”。

## 正式调用位置
```text
S08 ValidationResult
↓
S09 LearningWriteback
↓
fact_records
interpretation_records
LearningRecord[]
knowledge_candidates
memory_writes plan
↓
共享记忆与数据层
↓
真实写入回执
```

## 正式输入
S09正式输入名为`validation_result`，必须直接承接S08输出。

不再使用`verification_result`旧别名。

关键追溯字段：
- validation_id
- execution_result_id
- task_id
- task_plan_id
- decision_id
- decision_item_id
- option_id（如有）
- strategy_chain_id（如有）

## 四层信息
### fact_records
只保存可追溯事实。

### interpretation_records
保存解释，并明确attribution_strength、confounders与confidence。

### learning_items / LearningRecord
保存未来可能复用的经验，并保留正式上游引用。

### knowledge_candidates
只有达到Promotion Gate要求的经验才进入知识治理候选。

## 经验等级
- observation
- product_lesson
- reusable_pattern
- knowledge_candidate
- validated_knowledge

单次结果不得直接越级成为validated_knowledge。

## Promotion Gate
- eligible
- hold
- needs_more_evidence
- conflicted
- rejected

## learning_action
- record_fact
- create_lesson
- promote
- merge
- refine
- deprecate
- hold

## LearningRecord正式引用
每条LearningRecord至少应保留：
- learning_id
- source_decision_id
- source_decision_item_id
- source_task_ids
- source_execution_result_ids
- source_validation_ids
- evidence
- evidence_quality
- attribution_strength
- applicability
- invalid_when
- confidence
- promotion_gate

`source_validation_ids`必须使用正式`validation_id`，禁止继续使用`TASK-xxx:S08`之类临时拼接标识。

## S08结果对学习等级的约束
- execution_failure：可学习执行链问题，不学习“策略无效”；
- data_failure / premature_evaluation：通常只记录observation或hold；
- weak/confounded attribution：不得形成强因果可复用规律；
- high quality + strong/moderate attribution +重复独立支持：才有资格逐级升级；
- validated_knowledge必须经过独立知识治理。

## 新旧经验关系
- supports
- contradicts
- refines
- supersedes
- coexists

新证据与旧经验冲突时不得直接覆盖旧历史。

## 与记忆层边界
S09只生成`memory_writes`计划。

S09允许的写回状态：
- planned
- queued
- failed

**S09不得自行宣称`written`。**
真正的written/failed持久化结果由共享记忆与数据层 / LearningWriteExecutor返回。

## 核心原则
长期记忆的价值不在于记得多，而在于未来能区分：事实、解释、产品经验、可复用模式、待验证知识，以及它们各自的证据和适用边界。

## 当前版本
- 业务规则：V1.1；
- 接口：V1.2，已统一ValidationResult→LearningRecord引用链，并封闭真实写库边界；
- 执行程序：待系统运行层与记忆层实现Learning Packager / Write Executor。