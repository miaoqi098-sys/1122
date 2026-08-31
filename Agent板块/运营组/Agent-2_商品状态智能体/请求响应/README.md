# Agent-2｜请求响应接口

## 1. 定位
当Agent-1主动请求商品/链接状态分析时，Agent-2返回专业结构化结果，遵守：
`Agent-1_运营总控智能体/输入规范/专业Agent结果.schema.json`

## 2. 可回答的问题
- 当前ASIN/SKU/父体是否可售、受限、suppressed或页面异常？
- Featured Offer当前是否存在/是否发生变化？
- 当前前台价格/参考价/Coupon/Deal展示事实是什么？
- Listing关键内容是否缺失或前后台不一致？
- 变体关系当前是否健康？
- 资质/限制后台状态目前是什么？
- 某状态变化何时发生、持续多久、证据是什么？

## 3. 不应回答为最终结论的问题
- “应该把售价改到多少？”→ Agent-10/Agent-1决策；
- “应该暂停哪个广告？”→ Agent-4/Agent-1；
- “资质申诉应该怎么写？”→ Agent-12；
- “差评根因是什么？”→ Agent-11；
- “应该补多少库存？”→ Agent-7。

Agent-2可以给相关状态事实并建议转交对应Agent。

## 4. 标准返回字段
必须形成：
- request_id
- source_agent = Agent-2
- analysis_scope
- facts[]
- interpretation[]
- conclusion
- recommendation（可选）
- confidence
- data_window
- evidence_refs[]
- missing_data[]
- risks[]
- valid_until / review_at
- status

## 5. 状态语义
- `answered`：证据足以回答商品状态问题；
- `answered_with_gaps`：核心问题可回答，但有不会改变主结论的小缺口；
- `insufficient_evidence`：关键状态无法确认；
- `blocked`：所需来源/权限/数据不可获得。

## 6. Facts与interpretation分离
Facts例：后台SKU显示suppressed。
Interpretation例：这可能解释前台页面不可售，但仍需要前台快照确认。

不得把解释写成已确认事实。

## 7. 新鲜度
返回结果必须声明data_window、valid_until或review_at。页面、Buy Box、促销等高变状态的有效期应短于稳定的Listing结构事实；具体时长由未来配置决定。

## 8. 请求去重
若相同scope、相同问题、数据仍在有效期内且没有新变化，可以复用旧结果并保留原结果引用，不重复拉取所有数据。