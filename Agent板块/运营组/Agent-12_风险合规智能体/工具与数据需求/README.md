# 工具与数据需求

## 目标
定义 Agent-12 完成政策风险、账户健康、商品合规、资质、内容claim、评价政策和安全风险判断所需的数据与未来工具能力。当前只定义接口，不执行真实申诉、举报或合规提交。

## 核心数据
1. Amazon Account Health / Performance Notifications / Policy Notifications；
2. 商品状态、冻结/删除/资质审核事实，来自Agent-2与官方数据；
3. 商品合规、危险品、认证/检测/标签/说明文件；
4. Listing内容与claim版本，来自Agent-9；
5. 评论异常与安全VOC，来自Agent-11；
6. 知识产权投诉/通知、品牌授权和公开权利信息；
7. 当前平台政策与marketplace规则版本；
8. 申诉/整改Case、提交材料、回复和恢复结果；
9. 真实执行回执，用于证明整改已完成。

## 最低字段
- source；
- marketplace/region；
- scope；
- risk_domain；
- observed_at；
- rule_version/effective_at；
- notice/case/document ref；
- evidence_status；
- freshness；
- confidence。

## 数据降级
- 无最新政策规则：高影响资格状态至少 `requires_more_evidence`；
- 无官方通知全文：不得推断完整违规原因；
- 文件只知名称不知内容：不得声称资质已满足；
- IP权利状态不明：不得给确定性侵权/不侵权结论；
- 评论异常只有模式无政策证据：不得直接认定评价违规；
- 安全VOC未经事实核验：可提高风险等级，但保留待核查状态。

## 未来工具能力
- Account Health / Performance Notification读取；
- Policy/Compliance规则检索与版本化；
- 商品合规/危险品/资质状态读取；
- 文档元数据与有效期管理；
- Case/申诉状态读取；
- 证据包生成与一致性校验；
- Schema验证、历史风险持久化。

## 运行依赖
复用R03、R04、R06、R08、R12；另需要独立的“官方政策/账户健康/合规规则与通知数据源”，应在运行依赖待办中单独挂账，避免把动态政策硬编码进Agent框架。
