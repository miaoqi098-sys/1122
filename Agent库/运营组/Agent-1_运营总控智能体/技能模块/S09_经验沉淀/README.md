# S09｜经验沉淀

## 技能定位
把S08验证后的事实、解释、产品经验和知识候选分层沉淀，使Agent-1未来能够复用经过证据约束、知道适用边界、知道何时失效的经营经验。

S09不是“把聊天保存下来”，也不是每次验证后都强行总结一条规律，而是决定：什么只值得记录事实，什么可以成为产品经验，什么有资格继续升级为跨场景知识。

## 调用位置
```text
S08验证结果
↓
读取execution / outcome / data quality / attribution / failure type
↓
先写fact_records
↓
再形成interpretation_records
↓
判断是否值得生成learning_item
↓
检查promotion gate
↓
与previous lessons比对：支持 / 冲突 / 细化 / 替代 / 共存
↓
输出memory writes与knowledge candidate
↓
由共享记忆与数据层持久化
```

## 四层信息必须分开
### 1. fact_records
只保存可追溯事实，例如：竞价实际降低20%、CPA从30变24、同期Coupon上线。

### 2. interpretation_records
保存对事实的解释，并明确归因强度和不确定性。例如：CPA改善可能与降竞价有关，但Coupon构成混杂因素。

### 3. learning_items
保存未来对同一产品或相似场景可能有帮助的经验。

### 4. knowledge_candidates
只有达到升级门槛的经验才进入知识治理候选，不自动写成validated knowledge。

## 经验等级
- `observation`：单次观察，事实价值高于规律价值；
- `product_lesson`：对当前产品未来决策有复用价值；
- `reusable_pattern`：在多个相似场景中可能复用；
- `knowledge_candidate`：值得进入知识治理验证；
- `validated_knowledge`：经过多案例、高质量证据和知识治理后才能升级。

## Promotion Gate
`promotion_gate`：
- `eligible`
- `hold`
- `needs_more_evidence`
- `conflicted`
- `rejected`

同时记录：
- `promotion_reasons`
- `blocking_reasons`

经验升级不是模型凭感觉决定，而是受执行真实性、数据质量、归因强度、支持案例、反例、适用边界和知识治理约束。

## 学习动作 learning_action
- `record_fact`
- `create_lesson`
- `promote`
- `merge`
- `refine`
- `deprecate`
- `hold`

有些结果值得记录，但不值得形成规律，此时应record_fact/hold，而不是强行create_lesson。

## 新旧经验关系
- `supports`：新证据支持旧经验；
- `contradicts`：新证据与旧经验冲突；
- `refines`：新证据细化适用边界；
- `supersedes`：新证据足够强，旧版本应被替代但仍保留历史；
- `coexists`：两条经验在不同适用条件下同时成立。

冲突不等于覆盖，必须保留证据和版本关系。

## S08验证结果对学习等级的约束
- execution failure：可以学习执行链问题，但不能学习“经营策略无效”；
- data failure / premature evaluation：通常只记录observation或hold；
- weak/confounded attribution：不得生成强因果可复用规律；
- high quality + strong/moderate attribution +重复支持：才有资格向reusable_pattern及以上升级；
- validated_knowledge必须经过知识治理，S09单次运行不得越权直接生成。

## Learning Item知识卡
每条learning_item应尽量包含：
- learning_id
- level
- learning_action
- statement
- source_decision_id
- source_task_ids
- source_validation_ids
- evidence
- evidence_quality
- attribution_strength
- applicability
- invalid_when
- confidence
- support_count
- contradiction_count
- relationships
- knowledge_domain
- version
- created_at
- last_validated_at
- valid_until
- review_trigger
- promotion_gate

## 与共享记忆层的边界
S09负责生成“应该写什么、写到什么等级、与旧经验是什么关系”的结构化写回计划；真正数据库写入、索引、持久化、版本存储属于共享记忆与数据层。

## 核心原则
长期记忆的价值不在于记得多，而在于未来能够区分：这是事实、这是解释、这是产品经验、这是待验证知识，以及这条经验什么时候不再适用。

## 当前版本
V1.1：加入S08完整承接、事实/解释/经验/知识候选四层分离、promotion gate、learning_action、新旧经验关系和可治理知识卡结构。