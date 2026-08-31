# 运营组公共协议

## 定位
本目录定义 Agent-1 至 Agent-13 之间必须共享、但不属于任何单一专业 Agent 私有领域模型的静态协议。它不是第14个Agent，不拥有专业诊断或最终决策权。

## 权威边界
- Agent-1 `输入规范/智能事件包.schema.json` 是进入 Agent-1 S01 及后续经营决策链的唯一标准 Event 合同。
- Agent-1 `输入规范/专业Agent结果.schema.json` 是专业请求响应进入总控的唯一 Canonical Response 合同。
- Agent-2 至 Agent-13 可以保留自己的领域事件与领域响应对象，以表达广告、增长、库存、评价等专业语义。
- 领域对象交给 Agent-1 前必须完成公共协议规范化；不能因为字段名相似就直接当 Canonical 对象消费。
- Agent-1 是唯一最终经营决策出口。
- `run_id / trace_id / parent_run_id` 属于未来运行调用信封，不属于业务 Event/Response 主键。

## 当前正式文件
### 事件与响应交接
- `专业Agent事件协议.md`
- `专业Agent响应协议.md`
- `ProfessionalAgentEventHandoff.schema.json`
- `事件字段映射表.md`
- `示例/Agent4广告事件交接.example.json`

### 职责与协作
- `职责覆盖矩阵.md`
- `跨Agent协作路由.md`

### 运行边界
- `运行依赖边界.md`

### L5静态验收
- `L5公共对象与事件协议验收.md`
- `L5职责重叠与空白区验收.md`
- `L5跨Agent协作场景验收.md`
- `L5目录与README总同步验收.md`
- `L5运行依赖分离验收.md`

最终 `Agent库/运营组/L5总验收记录.md` 在所有L5专项门禁通过后生成。

## 设计原则
1. 不复制第二份 Agent-1 Canonical Event/Response 标准。
2. 不为了统一而抹掉专业 Agent 的领域字段。
3. 统一的是跨 Agent 交接合同，不强迫所有内部对象同构。
4. 事实、解释、假设、建议必须分离。
5. severity、confidence、scope、时间与证据在交接时统一语义并保留原始领域值。
6. 高频职责交叉必须有主责与协作规则，不能形成两个最终决策出口。
7. 跨 Agent 协作可以补证、请求、升级，但不能旁路 Agent-1 形成经营动作。
8. 真实Normalizer、Validator、Runner、消息队列、数据库、Scheduler、Executor属于共享运行依赖，不在本目录实现。
9. 新领域对象必须先证明可以映射到现有Canonical合同；只有稳定跨域语义确实无法表达时才考虑升级公共协议。