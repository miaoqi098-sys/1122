# BusinessState + ProductStage 静态验收 V1

## L1目标
验证“当前经营状态”和“当前经营阶段”已经从 UI 文本需求提升为可追溯、可版本化、可被后续 Goal/Task/UI 使用的系统级 Contract。

## BusinessState 验收
- [x] 使用 `business_state_id` 独立标识状态快照；
- [x] 强制关联 `product_id`；
- [x] 明确 `as_of`；
- [x] 支持总体状态与多个状态维度；
- [x] 维度可以引用 MetricSnapshot/Event/Evidence；
- [x] 保留 `assessment_rule_version`；
- [x] 记录生成主体与时间；
- [x] 新状态可以通过 `supersedes_state_id` 保留历史链；
- [x] 未将 Agent 自由文本当作唯一状态事实。

## ProductStage 验收
- [x] 使用 `product_stage_id` 独立标识阶段记录；
- [x] 强制关联 `product_id`；
- [x] `stage_code` 与 `stage_definition_version` 分离；
- [x] 未擅自固化尚未确认的阶段枚举；
- [x] 保留进入/退出规则引用；
- [x] 可引用 MetricSnapshot/BusinessState/Event 作为证据；
- [x] 记录判定主体与时间；
- [x] 支持 previous_stage_id 形成阶段历史；
- [x] 支持人工覆盖但必须记录原因、人员、时间；
- [x] 阶段与 Goal 保持独立。

## 负向检查
- 一次广告异常直接把阶段从A改成B：不允许，除非满足阶段规则与证据。
- UI 手工改一个标签而不产生 ProductStage 记录：不允许。
- 阶段枚举未确认前在 Schema 中硬编码“新品期/成长期”等：不允许。
- 覆盖阶段时删除原自动判定：不允许。
- BusinessState 没有任何 evidence_refs：不满足可追溯要求。

## 运行依赖
未来仍需 BusinessState Engine、阶段定义字典、阶段判定服务、状态/阶段持久化、人工覆盖工作流。这些不阻塞当前静态 Contract 成立。

## L1结论
`✅ 通过`。
