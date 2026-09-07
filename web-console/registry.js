(() => {
  // The public product catalog is deliberately separate from implementation
  // files.  Every product-facing page and connector must be represented here.
  const modules = Object.freeze([
    { id:'command-center', label:'经营指挥中心', route:'/command-center', icon:'◈', kind:'dashboard', summary:'统一查看经营、数据和连接健康状态。', legacy_source:'index.html' },
    { id:'selection', label:'选品', route:'/selection', icon:'◉', kind:'module', summary:'市场机会、容量、竞争、利润与新品机会评估。' },
    { id:'operations', label:'运营', route:'/operations', icon:'▦', kind:'group', summary:'产品、广告、库存、竞品与站外经营。' },
    { id:'products', label:'产品', route:'/operations/products', parent:'operations', kind:'module', summary:'产品状态、流量转化、价格、利润与体验。' },
    { id:'ads', label:'广告', route:'/operations/ads', parent:'operations', kind:'module', summary:'Amazon Ads 的分析、诊断与受控执行入口。', connectors:['amazon-ads'] },
    { id:'inventory-logistics', label:'库存物流', route:'/operations/inventory-logistics', parent:'operations', kind:'module', summary:'库存覆盖、补货、FBA 与物流风险。', connectors:['amazon-sp-api'] },
    { id:'competitors', label:'竞品', route:'/operations/competitors', parent:'operations', kind:'module', summary:'竞品池、价格、评价、排名与市场信号。', connectors:['sif'] },
    { id:'offsite', label:'站外推广', route:'/operations/offsite', parent:'operations', kind:'module', summary:'站外渠道、红人合作、活动与归因。', legacy_source:'运营板块/站外推广板块/01_品牌官网与独立站/01_API资质官网/site/index.html' },
    { id:'sandbox', label:'沙盘演练', route:'/sandbox', icon:'◇', kind:'module', summary:'经营情景、反事实基线和策略推演。' },
    { id:'governance', label:'系统政策边界', route:'/governance', icon:'⌘', kind:'module', summary:'权限、审批、自动化、安全和 fail-closed 规则。' },
    { id:'amazon-boundary', label:'亚马逊经营边界探索', route:'/amazon-boundary', icon:'◎', kind:'boundary', summary:'APR、AOM 与 APB 的证据化入口。' },
    { id:'apr', label:'APR 市场玩法探索', route:'/amazon-boundary/apr', parent:'amazon-boundary', kind:'boundary', summary:'市场现象与边界信号。' },
    { id:'aom', label:'AOM 正向运营方法', route:'/amazon-boundary/aom', parent:'amazon-boundary', kind:'boundary', summary:'合规运营方法库。' },
    { id:'apb', label:'APB 政策与边界证据', route:'/amazon-boundary/apb', parent:'amazon-boundary', kind:'boundary', summary:'政策证据和边界结论。' },
    { id:'agents', label:'Agent', route:'/agents', icon:'✦', kind:'module', summary:'运营总控与专业 Agent 的状态、输入与受控工作流。', connectors:['codex'] },
    { id:'skills', label:'技能', route:'/skills', icon:'⌁', kind:'module', summary:'可复用能力、工具契约和权限边界。' },
    { id:'connectors', label:'对外连接', route:'/connectors', icon:'⇄', kind:'connectors', summary:'Amazon、SIF、Cloudflare、Email、Codex 的统一健康状态。' },
    { id:'tasks', label:'任务中心', route:'/tasks', icon:'☑', kind:'module', summary:'Decision、Approval、Permission 与 Outcome 的受控链路。' },
    { id:'knowledge', label:'知识', route:'/knowledge', icon:'◇', kind:'module', summary:'可复用经营知识、规则、方法与经验。' },
    { id:'memory', label:'记忆', route:'/memory', icon:'◫', kind:'module', summary:'产品、任务、决策、结果与经营历史。' },
    { id:'data', label:'数据', route:'/data', icon:'▤', kind:'module', summary:'HOT、WARM、COLD 事实层、数据质量与来源追溯。' },
    { id:'amazon-sp-api-console', label:'Amazon SP-API 连接中心', route:'/connectors/amazon-sp-api', parent:'connectors', kind:'connector', summary:'Amazon SP-API 的只读健康状态与安全接入边界。', connectors:['amazon-sp-api'], legacy_source:'amazon-sp-api.html' },
    { id:'amazon-ads-console', label:'Amazon Ads 连接中心', route:'/connectors/amazon-ads', parent:'connectors', kind:'connector', summary:'Amazon Ads OAuth、Profiles 与只读 Campaigns。', connectors:['amazon-ads'] }
  ]);
  const connectors = Object.freeze([
    { connector_id:'cloudflare', label:'Cloudflare', endpoint:'https://1122-cloudflare-bridge.zhangshuaibing01.workers.dev/cloudflare-status', healthPath:'cloudflare', timeoutMs:5000, retries:1, writeMode:'approval-only' },
    { connector_id:'amazon-sp-api', label:'Amazon SP-API', endpoint:'https://1122-amazon-sp-api-bridge.zhangshuaibing01.workers.dev/', healthPath:'service', timeoutMs:5000, retries:1, writeMode:'worker-only' },
    { connector_id:'amazon-ads', label:'Amazon Ads', endpoint:'https://1122-amazon-ads-bridge.zhangshuaibing01.workers.dev/connection-status', healthPath:'connection-status', timeoutMs:5000, retries:1, writeMode:'readonly-mvp' },
    { connector_id:'sif', label:'SIF MCP', endpoint:'https://1122-sif-bridge.zhangshuaibing01.workers.dev/connection-status', healthPath:'service', timeoutMs:5000, retries:1, writeMode:'worker-only' },
    { connector_id:'email', label:'Email Bridge', endpoint:'https://1122-email-bridge.zhangshuaibing01.workers.dev/', healthPath:'service', timeoutMs:5000, retries:1, writeMode:'worker-only' },
    { connector_id:'codex', label:'Codex / GitHub Task Bridge', endpoint:null, healthPath:'local-gateway', timeoutMs:0, retries:0, writeMode:'human-or-gateway' }
  ]);
  window.__1122_REGISTRY__ = Object.freeze({ version:'1.0.0', modules, connectors });
})();
