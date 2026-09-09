# Agent-3｜竞品情报智能体

所属：运营组  
阶段：V1.x 框架层  
角色：竞争实体关系维护、竞品事实监控、变化检测与竞争信号分析专业Agent。

## 1. 核心使命
回答四个问题：
1. 谁是当前值得跟踪的竞争实体；
2. 为什么它与我方发生竞争、属于什么关系；
3. 它在价格、促销、可见性、Listing、评价展示、新品等方面发生了什么变化；
4. 这些变化是否构成值得Agent-1关注的持续竞争信号。

Agent-3不负责最终经营决策，也不直接修改价格、广告、Listing、库存或促销。

## 2. 两条正式输出
### 主动情报
`竞品关系 → 竞品快照 → 变化检测 → 信号去重/持续确认 → 智能事件包 → Agent-1`

合同：`Agent-1_运营总控智能体/输入规范/智能事件包.schema.json`

### Agent-1请求响应
`Agent-1请求 → 确认scope/竞品集合/数据窗 → 事实与解释 → 专业Agent结果 → Agent-1`

合同：`Agent-1_运营总控智能体/输入规范/专业Agent结果.schema.json`

## 3. 当前正式模块
- `身份与职责/`：角色、权限、输出与禁止事项；
- `竞品池/`：竞品实体、关系类型、入池/复核/降级/移除；
- `监控范围/`：价格促销、搜索/类目可见性、Listing、评价展示、新品与代理信号；
- `竞品快照/`：CompetitorSnapshot与可比性；
- `检测规则/`：diff、持续确认、信号、去重、恢复与异常；
- `事件输出/`：Agent-3事件类型与智能事件包映射；
- `请求响应/`：Agent-1定向专业查询；
- `边界与升级/`：与Agent-4/5/8/9/10/11/13及Agent-1的职责分离；
- `工具与数据需求/`：采集、搜索结果、历史、Schema等未来能力；
- `历史与证据/`：时间序列、来源、置信度、冲突与去重；
- `配置与日志/`：参数合同与业务审计；
- `测试/`：静态验收；
- `示例/`：标准事件与请求响应示例。

## 4. 竞品关系类型
支持：direct_competitor、substitute、price_anchor、traffic_competitor、feature_benchmark、new_entrant_watch、brand_watch、other_watch。

竞品关系不是永久事实，必须绑定我方scope、marketplace、证据、复核时间和有效期。

## 5. 关键对象
- `竞品池/CompetitorRelation.schema.json`
- `竞品快照/CompetitorSnapshot.schema.json`

快照必须保存观察时间、来源、上下文和comparison_eligible；不可比快照不得机械生成趋势。

## 6. 核心检测原则
- 单次变化不自动等于持续竞争信号；
- 同一持续信号按指纹更新，不重复制造Event；
- 恢复必须关联原信号/事件；
- 工具失败不等于竞品异常；
- 第三方估算必须标记proxy/estimate；
- facts与inference分离；
- Agent-3建议的P0-P3不是Agent-1最终business_priority。

## 7. 跨Agent边界
- Agent-4：我方广告运营；
- Agent-5：我方流量结构；
- Agent-8：市场宏观趋势；
- Agent-9：我方Listing转化策略；
- Agent-10：我方价格促销策略；
- Agent-11：VOC与评价体验根因；
- Agent-13：增长机会专业判断；
- Agent-1：唯一最终经营决策出口。

Agent-3可以提供这些领域的竞品事实，但不得代替对应专业Agent形成最终策略。

## 8. 数据与运行边界
当前框架定义数据需求、对象、规则与接口。SIF 连接层已实现独立的竞品关键词研究链，包括批量 ASIN、分页流量词、D1 词库与来源追溯；通用竞品快照、搜索结果监控、定时器与 Agent 自动投递仍属于后续运行层。

运行依赖：R02、R03、R06、R07、R12、R13。

## 9. 当前状态
Agent-3 已从单页角色说明扩展为竞品情报专业 Agent 框架；静态对象、规则、输出边界、测试与示例已建立。SIF 竞品关键词研究链已成为可追溯事实输入，但不代表通用 CompetitorIdentity、CompetitorSnapshot、CompetitorEvent 或 Agent-3 自动投递已经运行。
