# 竞品关键词工作台 UI 契约

正式路由：`#/operations/competitors/keywords`

本页面是运营竞品域的业务工作台，不是 SIF 连接设置页。它负责提交最多 10 个竞品 ASIN、展示后台队列进度、查看严格去重词库、10 类主分类、独立的长尾/核心层级以及每个关键词的来源 ASIN。

页面只能发起受 `SIF_RESEARCH_ACCESS_KEY` 保护的研究任务；它不具备 Amazon 广告、商品、价格或库存写权限。密钥仅保存在当前页面内存，刷新即清除。

数据边界：结果是所选周期内 SIF 可见的竞品流量词，不代表 Amazon 全部搜索查询；截断、部分失败、低置信度和近似词均必须显式展示。

任务状态必须区分 `QUEUED / RUNNING / CLASSIFICATION_PENDING / CLASSIFYING / SUCCEEDED / PARTIAL / FAILED`；连接器在线不等于任务成功。任何超时或上游异常都要终止无限 loading 并给出明确错误。

正式读模型：`CompetitorKeywordWorkbenchView.schema.json`
