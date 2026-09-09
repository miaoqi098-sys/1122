(() => {
  // The public product catalog is deliberately separate from implementation
  // files.  Every product-facing page and connector must be represented here.
  const modules = Object.freeze([
    { id:'command-center', label:'经营指挥中心', route:'/command-center', icon:'◈', kind:'dashboard', nav_group:'overview', readiness:'LIVE_READ', summary:'统一查看经营、数据和连接健康状态。', legacy_source:'index.html' },
    { id:'selection', label:'选品', route:'/selection', icon:'◉', kind:'module', nav_group:'business', readiness:'DESIGN_ONLY', summary:'市场机会、容量、竞争、利润与新品机会评估。' },
    { id:'operations', label:'运营', route:'/operations', icon:'▦', kind:'group', nav_group:'business', readiness:'PARTIAL_LIVE', summary:'产品、广告、库存、竞品与站外经营。' },
    { id:'products', label:'产品', route:'/operations/products', parent:'operations', kind:'module', readiness:'LIVE_READ', summary:'产品状态、流量转化、价格、利润与体验。' },
    { id:'ads', label:'广告运营', route:'/operations/ads', parent:'operations', kind:'module', readiness:'LIVE_READ', summary:'Amazon Ads 的 Profiles、Campaigns 与 Ad Groups 只读视图。', connectors:['amazon-ads'] },
    { id:'inventory-logistics', label:'库存物流', route:'/operations/inventory-logistics', parent:'operations', kind:'module', readiness:'PARTIAL_LIVE', summary:'库存覆盖、在途与 FBA 只读状态。', connectors:['amazon-sp-api'] },
    { id:'competitors', label:'竞品', route:'/operations/competitors', parent:'operations', kind:'module', readiness:'PARTIAL_LIVE', summary:'竞品池、SIF 流量词、去重词库、分类与市场信号。', connectors:['sif'] },
    { id:'competitor-keywords', label:'竞品关键词工作台', route:'/operations/competitors/keywords', parent:'competitors', kind:'module', readiness:'PARTIAL_LIVE', summary:'批量 ASIN → SIF 分页流量词 → 严格去重 → 10 类分类 → D1 可追溯词库。', connectors:['sif'] },
    { id:'offsite', label:'站外推广', route:'/operations/offsite', parent:'operations', kind:'module', readiness:'DESIGN_ONLY', summary:'站外渠道、红人合作、活动与归因。', legacy_source:'运营板块/站外推广板块/01_品牌官网与独立站/01_API资质官网/site/index.html' },
    { id:'sandbox', label:'沙盘演练', route:'/sandbox', icon:'◇', kind:'module', nav_group:'automation', readiness:'DESIGN_ONLY', summary:'经营情景、反事实基线和策略推演。' },
    { id:'agents', label:'Agent', route:'/agents', icon:'✦', kind:'module', nav_group:'automation', readiness:'PARTIAL_LIVE', summary:'运营总控与专业 Agent 的状态、输入与受控工作流。', connectors:['codex'] },
    { id:'skills', label:'技能', route:'/skills', icon:'⌁', kind:'module', nav_group:'system', readiness:'CONTRACT_READY', summary:'可复用能力、工具契约和权限边界。' },
    { id:'knowledge', label:'知识', route:'/knowledge', icon:'◇', kind:'module', nav_group:'intelligence', readiness:'LIVE_READ', summary:'可复用经营知识、规则、方法与经验。' },
    { id:'memory', label:'记忆', route:'/memory', icon:'◫', kind:'module', nav_group:'system', readiness:'CONTRACT_READY', summary:'产品、任务、决策、结果与经营历史。' },
    { id:'governance', label:'系统政策边界', route:'/governance', icon:'⌘', kind:'module', nav_group:'system', readiness:'CONTRACT_READY', summary:'权限、审批、自动化、安全和 fail-closed 规则。' },
    { id:'amazon-boundary', label:'亚马逊经营边界', route:'/amazon-boundary', icon:'◎', kind:'boundary', nav_group:'intelligence', readiness:'LIVE_READ', summary:'APR、AOM 与 APB 的证据化入口。' },
    { id:'apr', label:'APR 市场玩法探索', route:'/amazon-boundary/apr', parent:'amazon-boundary', kind:'boundary', readiness:'LIVE_READ', summary:'市场现象与边界信号。' },
    { id:'aom', label:'AOM 正向运营方法', route:'/amazon-boundary/aom', parent:'amazon-boundary', kind:'boundary', readiness:'LIVE_READ', summary:'合规运营方法库。' },
    { id:'apb', label:'APB 政策与边界证据', route:'/amazon-boundary/apb', parent:'amazon-boundary', kind:'boundary', readiness:'LIVE_READ', summary:'政策证据和边界结论。' },
    { id:'connectors', label:'对外连接', route:'/connectors', icon:'⇄', kind:'connectors', nav_group:'system', readiness:'PARTIAL_LIVE', summary:'Amazon、SIF、Cloudflare、Email、Codex 的统一健康状态。' },
    { id:'amazon-sp-api-console', label:'Amazon SP-API', route:'/connectors/amazon-sp-api', parent:'connectors', kind:'connector', readiness:'LIVE_READ', summary:'Amazon SP-API 的只读健康状态与安全接入边界。', connectors:['amazon-sp-api'], legacy_source:'amazon-sp-api.html' },
    { id:'amazon-ads-console', label:'Amazon Ads 设置', route:'/connectors/amazon-ads', parent:'connectors', kind:'connector', readiness:'LIVE_READ', summary:'Amazon Ads OAuth、Profiles 与只读能力状态。', connectors:['amazon-ads'] },
    { id:'tasks', label:'任务中心', route:'/tasks', icon:'☑', kind:'module', nav_group:'automation', readiness:'LIVE_EMPTY', summary:'Decision、Approval、Permission 与 Outcome 的受控链路。' },
    { id:'data', label:'数据', route:'/data', icon:'▤', kind:'module', nav_group:'system', readiness:'LIVE_READ', summary:'HOT、WARM、COLD 事实层、数据质量与来源追溯。' },
    { id:'ui-design', label:'UI 设计与契约', route:'/system/ui-design', kind:'support', nav_group:'support', readiness:'CONTRACT_READY', summary:'导航、路由、读模型与页面契约。' },
    { id:'conflicts', label:'系统冲突问题库', route:'/system/conflicts', kind:'support', nav_group:'support', readiness:'TRACKED', summary:'跨模块问题登记、修复与验证闭环。' },
    { id:'system-overview', label:'系统地图', route:'/system/overview', kind:'support', nav_group:'support', readiness:'LIVE_READ', summary:'GitHub 架构盘点与 Cloudflare 资源概览。' }
  ]);
  const connectors = Object.freeze([
    { connector_id:'cloudflare', label:'Cloudflare', route:'/connectors', endpoint:'https://1122-cloudflare-bridge.zhangshuaibing01.workers.dev/cloudflare-status', healthPath:'cloudflare', timeoutMs:5000, retries:1, writeMode:'approval-only' },
    { connector_id:'amazon-sp-api', label:'Amazon SP-API', route:'/connectors/amazon-sp-api', endpoint:'https://1122-amazon-sp-api-bridge.zhangshuaibing01.workers.dev/connection-status', healthPath:'connection-status', timeoutMs:6000, retries:1, writeMode:'worker-only' },
    { connector_id:'amazon-ads', label:'Amazon Ads', route:'/connectors/amazon-ads', endpoint:'https://1122-amazon-ads-bridge.zhangshuaibing01.workers.dev/connection-status', healthPath:'connection-status', timeoutMs:6000, retries:1, writeMode:'readonly-mvp' },
    { connector_id:'sif', label:'SIF MCP', route:'/connectors', endpoint:'https://sif-api.sorilo-uk.com/connection-status', healthPath:'connection-status', timeoutMs:6000, retries:1, writeMode:'protected-research' },
    { connector_id:'email', label:'Email Bridge', route:'/connectors', endpoint:'https://1122-email-bridge.zhangshuaibing01.workers.dev/connection-status', healthPath:'connection-status', timeoutMs:5000, retries:0, writeMode:'worker-only' },
    { connector_id:'codex', label:'Codex / GitHub Task Bridge', route:'/connectors', endpoint:null, healthPath:'local-gateway', timeoutMs:0, retries:0, writeMode:'human-or-gateway' }
  ]);
  window.__1122_REGISTRY__ = Object.freeze({ version:'2.0.0', modules, connectors });
})();
