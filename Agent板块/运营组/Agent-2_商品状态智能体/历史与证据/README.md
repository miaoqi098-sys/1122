# Agent-2｜历史、去重与证据

## 1. 目标
保证Agent-2能够回答：
- 当前状态相对哪一个历史快照发生变化？
- 同类异常是否已经上报？
- 异常持续多久、何时恢复？
- 当前判断依据是什么？

## 2. 内部状态快照
每次有效观察形成或更新状态快照，至少保留：
- snapshot_id；
- scope_type / scope_id；
- observed_at；
- source_refs；
- domains状态；
- raw_facts；
- evidence_refs；
- freshness；
- confidence；
- previous_snapshot_id。

状态快照是Agent-2内部专业对象，不替代Agent-1 ContextPackage。

## 3. 事件历史
对每个未关闭状态事件维护：
- event_id；
- dedupe fingerprint；
- first_seen_at；
- last_seen_at；
- occurrence_count；
- latest_snapshot_id；
- evidence_refs；
- current_status：open / observing / restored / closed；
- related/recovery event refs。

## 4. 去重
相同`scope + status_domain + normalized_change_type`且异常未恢复时：
- 不新建等价Event；
- 更新持续时间/证据；
- severity可因持续时间、影响范围、新证据升级或降级。

如果状态已恢复后再次发生，允许新Event，并关联旧事件。

## 5. Evidence原则
证据引用必须能区分：
- official_backend
- frontend_page
- official_notice
- historical_snapshot
- human_confirmation
- tool_result

工具报错本身不是业务状态证据。

## 6. 来源冲突
前台与后台不一致时：
- 保留双来源；
- 不覆盖；
- 标记source_conflict；
- 记录需要复核的字段；
- 必要时形成冲突事件。

## 7. 新鲜度
状态事实有有效期。旧快照可用于比较，但不得直接冒充当前状态。

复用历史专业结果前必须检查：
- scope一致；
- 状态域一致；
- valid_until/review_at；
- 期间是否有新Event/Task/平台通知。

## 8. 与长期记忆边界
真实快照/事件持久化、索引和查询属于R06。Agent-2只定义业务记录合同，不能宣称数据库已经保存。