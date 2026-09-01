import fs from 'node:fs';

const path='index.html';
let html=fs.readFileSync(path,'utf8');

const css=`
.product-portfolio-grid{display:grid;grid-template-columns:1.25fr .75fr;gap:16px;margin-bottom:16px}
.product-summary-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:16px}
.product-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:14px}
.product-table{width:100%;border-collapse:collapse;min-width:980px;background:#fff}
.product-table th,.product-table td{padding:12px 13px;border-bottom:1px solid var(--line);text-align:left;font-size:12px;vertical-align:middle}
.product-table th{background:#f8fafc;color:var(--muted);font-weight:700;position:sticky;top:0}
.product-table tr:last-child td{border-bottom:0}.product-table tr:hover td{background:#fbfdff}
.product-lock{display:flex;align-items:center;gap:10px}.product-avatar{width:42px;height:42px;border-radius:11px;background:linear-gradient(135deg,#eff6ff,#f8fafc);border:1px solid var(--line);display:grid;place-items:center;font-weight:800;color:#2563eb;flex:0 0 auto}
.stage-chip{display:inline-flex;align-items:center;border-radius:999px;padding:5px 8px;background:#fff7ed;color:#9a3412;font-size:10px;font-weight:800}.stage-chip.real{background:#ecfdf5;color:#047857}
.product-cockpit-head{display:grid;grid-template-columns:100px 1fr 300px;gap:18px;align-items:stretch;margin-bottom:16px}.product-hero-image{border:1px solid var(--line);border-radius:16px;background:linear-gradient(135deg,#f1f5f9,#fff);display:grid;place-items:center;font-size:13px;color:var(--muted);min-height:100px}.product-stage-card{border:1px solid var(--line);border-radius:16px;background:#fff;padding:16px}
.product-kpis{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px;margin-bottom:16px}.product-kpi{background:#fff;border:1px solid var(--line);border-radius:13px;padding:13px}.product-kpi strong{display:block;font-size:18px;margin:6px 0 3px}.product-kpi .state{font-size:10px;font-weight:800;letter-spacing:.03em;color:var(--muted)}
.product-domain-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:16px}.product-domain-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px}.product-domain-card h3{font-size:15px;margin-bottom:5px}.product-domain-card .domain-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid var(--line);font-size:12px}.product-domain-card .domain-row:first-of-type{border-top:0}
.plan-progress{height:8px;border-radius:999px;background:#eef2f7;overflow:hidden;margin:10px 0}.plan-progress>span{display:block;height:100%;width:0;background:#111827}.goal-list{display:grid;gap:9px}.goal-item{border:1px solid var(--line);border-radius:12px;padding:11px;background:#fafafa}.timeline{position:relative;padding-left:18px}.timeline:before{content:'';position:absolute;left:5px;top:6px;bottom:6px;width:2px;background:#e5e7eb}.timeline-item{position:relative;padding:0 0 14px 12px;font-size:12px}.timeline-item:before{content:'';position:absolute;left:-17px;top:4px;width:8px;height:8px;border-radius:50%;background:#94a3b8}
@media(max-width:1250px){.product-summary-grid{grid-template-columns:repeat(3,1fr)}.product-kpis{grid-template-columns:repeat(4,1fr)}.product-cockpit-head{grid-template-columns:80px 1fr}}
@media(max-width:850px){.product-portfolio-grid,.product-domain-grid{grid-template-columns:1fr}.product-summary-grid{grid-template-columns:repeat(2,1fr)}.product-kpis{grid-template-columns:repeat(2,1fr)}.product-cockpit-head{grid-template-columns:1fr}.product-hero-image{min-height:80px}}
`;
if(!html.includes('.product-portfolio-grid{')){
  if(!html.includes('</style>')) throw new Error('Missing style end');
  html=html.replace('</style>',css+'\n</style>');
}

const nav=`<div class="ops-subnav"><button onclick="openOperations(nav.querySelectorAll('a')[2])">运营驾驶舱</button><button onclick="openProductCenter()">产品</button><button onclick="openInventoryCenter()">库存物流</button><button onclick="openAdsCenter()">广告</button><button onclick="openCompetitorCenter()">竞品</button><button onclick="openOffsiteCenter()">站外推广</button></div>`;

const productCenter=`<section id="product-center" class="view">
<div class="crumb">运营 / 产品 / 产品组合</div>${nav}
<div class="topbar"><div class="title"><h1>产品运营中心</h1><p>每个 ProductIdentity 都拥有独立阶段、目标、运营计划、销售、流量、广告、库存、利润、风险与任务。</p></div><button class="btn secondary" onclick="openOperations(nav.querySelectorAll('a')[2])">← 返回运营驾驶舱</button></div>
<div class="banner"><strong>产品中心 V2：</strong>真实产品身份、Listing、价格和 InventorySnapshot 已接入。SalesSnapshot 与店铺 TrafficSnapshot 已接通；产品粒度 Traffic 正在验证。Web 身份认证尚未完成，因此真实 SKU / ASIN / 价格 / 库存 / 销售金额暂不在页面接口中直接返回。</div>
<div class="product-summary-grid">
  <div class="card"><div class="kpi-label">真实产品</div><div class="kpi-value" id="pcProductCount">—</div><div class="meta">US ProductIdentity</div></div>
  <div class="card"><div class="kpi-label">Listing 数据</div><div class="kpi-value" id="pcListingCount" style="font-size:21px">—</div><div class="meta">真实读取完成度</div></div>
  <div class="card"><div class="kpi-label">库存快照</div><div class="kpi-value" id="pcInventoryCount" style="font-size:21px">—</div><div class="meta">InventorySnapshot</div></div>
  <div class="card"><div class="kpi-label">运营计划</div><div class="kpi-value" style="font-size:21px">待建立</div><div class="meta">ProductOperatingPlan</div></div>
  <div class="card"><div class="kpi-label">运行模式</div><div class="kpi-value" style="font-size:21px">Read Only</div><div class="meta">写操作进入 Task Center</div></div>
</div>
<div class="product-portfolio-grid">
  <div class="card"><div class="section-title"><h2>产品组合清单</h2><span class="pill ok" id="pcPortfolioPill">读取中</span></div><div class="meta" style="margin-bottom:12px">现在先以受保护产品槽位展示。完成 Authentication（身份认证）后，本表自动替换为真实商品主图、Title、ASIN、SKU 与经营指标。</div><div class="product-table-wrap"><table class="product-table"><thead><tr><th>产品</th><th>当前阶段</th><th>阶段目标</th><th>运营计划</th><th>销售</th><th>流量</th><th>库存</th><th>风险</th><th></th></tr></thead><tbody id="productPortfolioRows"><tr><td colspan="9">正在读取真实 ProductIdentity 数量…</td></tr></tbody></table></div></div>
  <div class="card"><div class="section-title"><h2>组合经营状态</h2><span class="pill">Portfolio</span></div>
    <div class="item"><strong>阶段分布</strong><div class="meta">PENDING_PLAN · ProductOperatingPlan 尚未创建，不能伪造新品/成长期/稳定期分布。</div></div>
    <div class="item"><strong>销售数据</strong><div class="meta" id="pcSalesState">正在检查 SalesSnapshot…</div></div>
    <div class="item"><strong>流量数据</strong><div class="meta" id="pcTrafficState">正在检查 TrafficSnapshot…</div></div>
    <div class="item"><strong>财务数据</strong><div class="meta" id="pcFinanceState">正在检查 FinanceSnapshot…</div></div>
    <div class="item"><strong>广告数据</strong><div class="meta">PENDING_SOURCE · Amazon Ads API 等待审核/授权。</div></div>
    <div class="item"><strong>市场数据</strong><div class="meta">REAL CAPABILITY · Sif MCP 已通过真实 ASIN 数据验证。</div></div>
  </div>
</div>
<div class="card"><div class="section-title"><h2>产品经营域</h2><span class="pill">下钻入口</span></div><div class="module-grid">
  <div class="module-card" onclick="openOpsSubpage('product-traffic')"><div class="module-icon">流</div><div class="module-name">流量与转化</div><div class="module-desc">Sessions、Page Views、转化率、关键词与流量结构。</div><span class="tag ok"><span class="dot"></span>部分真实</span></div>
  <div class="module-card" onclick="openOpsSubpage('product-price')"><div class="module-icon">价</div><div class="module-name">价格与促销</div><div class="module-desc">Listing Price、参考价、Coupon、Deal 与历史。</div><span class="tag ok"><span class="dot"></span>Price 已接</span></div>
  <div class="module-card" onclick="openInventoryCenter()"><div class="module-icon">库</div><div class="module-name">库存与在途</div><div class="module-desc">FBA 可售、在途、覆盖天数、预计断货与补货。</div><span class="tag ok"><span class="dot"></span>Snapshot 已接</span></div>
  <div class="module-card" onclick="openOpsSubpage('product-profit')"><div class="module-icon">利</div><div class="module-name">利润与经营</div><div class="module-desc">Finance、广告费、采购、头程与贡献利润。</div><span class="tag warn"><span class="dot"></span>口径建设中</span></div>
  <div class="module-card" onclick="openOpsSubpage('product-experience')"><div class="module-icon">评</div><div class="module-name">消费者体验</div><div class="module-desc">Review、VOC、退货退款与体验风险。</div><span class="tag warn"><span class="dot"></span>待数据源</span></div>
</div></div>
</section>`;

const centerRegex=/<section id="product-center" class="view">[\s\S]*?<\/section>\n<section id="website" class="view">/;
if(!centerRegex.test(html)) throw new Error('Product center section not found');
html=html.replace(centerRegex,productCenter+'\n<section id="website" class="view">');

const cockpit=`<section id="product" class="view">
<div class="crumb">运营 / 产品 / 单品运营驾驶舱</div>${nav}
<div class="topbar"><div class="title"><h1 id="productName">受保护产品 · 单品运营驾驶舱</h1><p>现在怎么样 → 处于什么阶段 → 目标是什么 → 为什么 → 下一步做什么。</p></div><button class="btn secondary" onclick="openProductCenter()">← 返回产品中心</button></div>
<div class="banner"><strong>安全模式：</strong>页面结构已经按真实单品经营设计；当前 Web 未完成身份认证，所以产品身份和金额/库存明细保持受保护。所有未接数据明确显示 PENDING，不使用示例数字。</div>
<div class="product-cockpit-head">
  <div class="product-hero-image">产品主图<br>登录后显示</div>
  <div class="card"><div class="section-title"><h2 id="pdProtectedName">受保护产品</h2><span class="pill" id="pdIdentityState">PROTECTED</span></div><div class="meta">US · ProductIdentity 已存在</div><div class="item"><strong>Title / ASIN / SKU / Price</strong><div class="meta">真实后端数据已接，Authentication 完成后显示。</div></div><div class="item"><strong>Listing / Main Image</strong><div class="meta" id="pdListingState">正在读取数据状态…</div></div></div>
  <div class="product-stage-card"><div class="kpi-label">当前经营阶段</div><div class="kpi-value" style="font-size:21px" id="pdStage">待设置</div><div class="meta">PENDING_PLAN · ProductOperatingPlan 尚未建立</div><div style="margin-top:14px"><div class="kpi-label">阶段核心目标</div><strong id="pdPrimaryGoal">待设置可验证目标</strong></div></div>
</div>
<div class="product-kpis">
  <div class="product-kpi"><div class="kpi-label">今日销量</div><strong>—</strong><div class="state" id="pdSalesState">PRODUCT DATA PENDING</div></div>
  <div class="product-kpi"><div class="kpi-label">7日销量</div><strong>—</strong><div class="state">PRODUCT DATA PENDING</div></div>
  <div class="product-kpi"><div class="kpi-label">Sessions</div><strong>—</strong><div class="state" id="pdTrafficState">PRODUCT MAPPING PENDING</div></div>
  <div class="product-kpi"><div class="kpi-label">转化率</div><strong>—</strong><div class="state">TRAFFIC PRODUCT PENDING</div></div>
  <div class="product-kpi"><div class="kpi-label">ACOS</div><strong>—</strong><div class="state">ADS API PENDING</div></div>
  <div class="product-kpi"><div class="kpi-label">贡献利润率</div><strong>—</strong><div class="state">COST MODEL PENDING</div></div>
  <div class="product-kpi"><div class="kpi-label">库存覆盖</div><strong>—</strong><div class="state" id="pdInventoryState">VELOCITY PENDING</div></div>
</div>
<div class="product-domain-grid">
  <div class="product-domain-card"><div class="section-title"><h2>阶段目标</h2><span class="pill">PENDING_PLAN</span></div><div class="goal-list"><div class="goal-item"><strong>主目标</strong><div class="meta">待为此 ProductIdentity 创建 ProductOperatingPlan。</div></div><div class="goal-item"><strong>量化指标</strong><div class="meta">日销量 / Sales / CVR / TACOS / 关键词排名 / 库存覆盖等必须可验收。</div></div></div></div>
  <div class="product-domain-card"><div class="section-title"><h2>本阶段运营计划</h2><span class="pill">0%</span></div><div class="plan-progress"><span></span></div><div class="domain-row"><span>核心策略</span><strong>待设置</strong></div><div class="domain-row"><span>关键动作</span><strong>待建立</strong></div><div class="domain-row"><span>Owner / Agent</span><strong>待分配</strong></div><div class="domain-row"><span>验证标准</span><strong>待定义</strong></div></div>
  <div class="product-domain-card"><div class="section-title"><h2>销量与销售</h2><span class="pill" id="pdSalesPill">检查中</span></div><div class="domain-row"><span>店铺 SalesSnapshot</span><strong id="pdStoreSales">检查中</strong></div><div class="domain-row"><span>产品级 Units / Orders</span><strong>等待产品粒度映射</strong></div><div class="domain-row"><span>销量趋势</span><strong>待产品 Snapshot</strong></div></div>
  <div class="product-domain-card"><div class="section-title"><h2>流量与转化</h2><span class="pill" id="pdTrafficPill">检查中</span></div><div class="domain-row"><span>店铺 TrafficSnapshot</span><strong id="pdStoreTraffic">检查中</strong></div><div class="domain-row"><span>产品 Sessions / Page Views</span><strong>CHILD-ASIN 映射验证中</strong></div><div class="domain-row"><span>关键词流量</span><strong>Sif Ready</strong></div></div>
  <div class="product-domain-card"><div class="section-title"><h2>库存与在途</h2><span class="pill ok">REAL SNAPSHOT</span></div><div class="domain-row"><span>InventorySnapshot</span><strong id="pdInventorySnapshot">检查中</strong></div><div class="domain-row"><span>FBA / Inbound</span><strong>真实后端已接</strong></div><div class="domain-row"><span>覆盖天数 / 预计断货</span><strong>等待产品销售速度</strong></div></div>
  <div class="product-domain-card"><div class="section-title"><h2>广告表现</h2><span class="pill warn">PENDING ADS API</span></div><div class="domain-row"><span>Spend / Sales / ACOS</span><strong>等待 Ads API</strong></div><div class="domain-row"><span>Keyword / Targeting</span><strong>等待 Ads API</strong></div><div class="domain-row"><span>Budget / Bid</span><strong>写操作需 Task Center</strong></div></div>
  <div class="product-domain-card"><div class="section-title"><h2>价格与利润</h2><span class="pill warn">PARTIAL</span></div><div class="domain-row"><span>Listing Price</span><strong>REAL · 登录后显示</strong></div><div class="domain-row"><span>Amazon Finance</span><strong id="pdFinanceState">口径验证中</strong></div><div class="domain-row"><span>采购 / 头程 / 广告成本</span><strong>待内部成本层</strong></div></div>
  <div class="product-domain-card"><div class="section-title"><h2>Listing 健康</h2><span class="pill ok">REAL BASE</span></div><div class="domain-row"><span>Title / Main Image / Price</span><strong id="pdListingCompleteness">真实读取</strong></div><div class="domain-row"><span>Issues</span><strong>后端已接 · 语义待完善</strong></div><div class="domain-row"><span>内容历史</span><strong>待 Timeline</strong></div></div>
  <div class="product-domain-card"><div class="section-title"><h2>市场与竞品</h2><span class="pill ok">SIF READY</span></div><div class="domain-row"><span>关键词 / 流量研究</span><strong>Sif MCP</strong></div><div class="domain-row"><span>核心竞品池</span><strong>待 CompetitorIdentity</strong></div><div class="domain-row"><span>竞争变化事件</span><strong>待 A3 Pipeline</strong></div></div>
</div>
<div class="product-portfolio-grid">
  <div class="card"><div class="section-title"><h2>A1 当前经营判断</h2><span class="pill warn">Runtime 待接</span></div><div class="item"><strong>FinalDecision</strong><div class="meta">当前没有真实 A1 Runner 输出，因此这里不生成模拟建议。</div></div><div class="item"><strong>风险与机会</strong><div class="meta">未来聚合 A2/A3/A4/A5/A6 的结构化 Event，再由 A1 形成最终判断。</div></div></div>
  <div class="card"><div class="section-title"><h2>任务与执行</h2><span class="pill">Task Center</span></div><div class="domain-row"><span>待审批</span><strong>—</strong></div><div class="domain-row"><span>待执行</span><strong>—</strong></div><div class="domain-row"><span>待验证</span><strong>—</strong></div><div class="meta" style="margin-top:8px">没有 Runtime 前不使用假任务数量。</div></div>
</div>
<div class="card"><div class="section-title"><h2>产品时间线</h2><span class="pill">Event Ledger 待接</span></div><div class="timeline"><div class="timeline-item"><strong>ProductIdentity / Listing / InventorySnapshot</strong><div class="meta">真实基础数据链已建立。</div></div><div class="timeline-item"><strong>Sales / Traffic 数据链</strong><div class="meta">店铺级已接，产品粒度正在验证。</div></div><div class="timeline-item"><strong>下一阶段</strong><div class="meta">ProductOperatingPlan + Authentication + 单品 Sales/Traffic → Agent Event → Task / Validation。</div></div></div></div>
</section>`;

const productRegex=/<section id="product" class="view">[\s\S]*?<\/section>\n<section id="placeholder" class="view">/;
if(!productRegex.test(html)) throw new Error('Legacy product section not found');
html=html.replace(productRegex,cockpit+'\n<section id="placeholder" class="view">');

html=html.replace(
  "function openProduct(name){document.getElementById('productName').textContent=name+' · 产品状态卡';hideAll();document.getElementById('product').classList.add('show');window.scrollTo({top:0,behavior:'smooth'})}",
  "function openProduct(name){openProductCockpit(1)}"
);
html=html.replace(
  "function openProductCenter(){hideAll();document.getElementById('product-center').classList.add('show');activate(nav.querySelectorAll('a')[2]);window.scrollTo({top:0,behavior:'smooth'});setTimeout(checkProductIdentityStatus,120)}",
  "function openProductCenter(){hideAll();document.getElementById('product-center').classList.add('show');activate(nav.querySelectorAll('a')[2]);window.scrollTo({top:0,behavior:'smooth'});setTimeout(refreshProductCenterV2,100)}"
);

if(!html.includes('async function refreshProductCenterV2()')){
  const marker='function openOperations(a){';
  if(!html.includes(marker)) throw new Error('openOperations marker not found');
  const js=`async function getJsonSafe(url){try{const r=await fetch(url,{headers:{'Accept':'application/json'}});const d=await r.json();return r.ok?d:{success:false,error:d.message||d.error||'HTTP '+r.status}}catch(e){return{success:false,error:e.message}}}
function renderProtectedProductSlots(count,states){const body=document.getElementById('productPortfolioRows');if(!body)return;if(!count){body.innerHTML='<tr><td colspan="9">当前没有可展示的 ProductIdentity。</td></tr>';return}let out='';for(let i=1;i<=count;i++){const n=String(i).padStart(2,'0');out+='<tr><td><div class="product-lock"><div class="product-avatar">'+n+'</div><div><strong>受保护产品 #'+n+'</strong><div class="meta">真实身份登录后显示</div></div></div></td><td><span class="stage-chip">待设置</span></td><td>PENDING_PLAN</td><td>待建立</td><td><span class="data-state '+(states.sales?'real':'pending')+'">'+(states.sales?'STORE REAL':'PENDING')+'</span></td><td><span class="data-state '+(states.traffic?'real':'pending')+'">'+(states.traffic?'STORE REAL':'PENDING')+'</span></td><td><span class="data-state '+(states.inventory?'real':'pending')+'">'+(states.inventory?'REAL':'PENDING')+'</span></td><td>UNKNOWN</td><td><button class="btn secondary" onclick="openProductCockpit('+i+')">进入驾驶舱</button></td></tr>'}body.innerHTML=out}
async function refreshProductCenterV2(){const [p,s,t,f]=await Promise.all([getJsonSafe('https://1122-amazon-sp-api-bridge.zhangshuaibing01.workers.dev/product-identity-status'),getJsonSafe('https://1122-amazon-sp-api-bridge.zhangshuaibing01.workers.dev/sales-status'),getJsonSafe('https://1122-amazon-sp-api-bridge.zhangshuaibing01.workers.dev/traffic-status'),getJsonSafe('https://1122-amazon-sp-api-bridge.zhangshuaibing01.workers.dev/finance-status')]);const count=p.success&&p.ready?Number(p.productCount||0):0;const v12=p.v12||{};const v13=p.v13||{};const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};set('pcProductCount',String(count||'—'));set('pcListingCount',count?String(v12.listingResolvedCount||0)+'/'+String(count):'—');set('pcInventoryCount',v13.inventorySnapshotReady?String(v13.inventoryRecordCount||0)+'/'+String(count):'—');set('pcSalesState',s.success&&s.ready?'REAL · Sales API 已建立 '+(s.rangesAvailable||[]).length+' 个时间范围':'PENDING / ERROR · '+(s.error||s.message||'等待 SalesSnapshot'));set('pcTrafficState',t.success&&t.ready?'REAL STORE · '+String(t.dateRecordCount||0)+' 条日记录 · 产品映射 '+String(t.matchedProductCount||0):'PENDING / ERROR · '+(t.error||t.message||'等待 TrafficSnapshot'));set('pcFinanceState',f.success&&f.ready?'CONNECTED · '+String(f.transactionCount||0)+' 条交易 · 金额口径不作为利润':'PENDING / ERROR · '+(f.error||f.message||'等待 FinanceSnapshot'));const pill=document.getElementById('pcPortfolioPill');if(pill){pill.textContent=count?String(count)+' 个真实产品':'状态读取失败';pill.className=count?'pill ok':'pill warn'}renderProtectedProductSlots(count,{sales:s.success&&s.ready,traffic:t.success&&t.ready,inventory:Boolean(v13.inventorySnapshotReady)})}
async function openProductCockpit(slot){hideAll();document.getElementById('product').classList.add('show');activate(nav.querySelectorAll('a')[2]);const n=String(slot||1).padStart(2,'0');const name='受保护产品 #'+n;document.getElementById('productName').textContent=name+' · 单品运营驾驶舱';document.getElementById('pdProtectedName').textContent=name;window.scrollTo({top:0,behavior:'smooth'});const [p,s,t,f]=await Promise.all([getJsonSafe('https://1122-amazon-sp-api-bridge.zhangshuaibing01.workers.dev/product-identity-status'),getJsonSafe('https://1122-amazon-sp-api-bridge.zhangshuaibing01.workers.dev/sales-status'),getJsonSafe('https://1122-amazon-sp-api-bridge.zhangshuaibing01.workers.dev/traffic-status'),getJsonSafe('https://1122-amazon-sp-api-bridge.zhangshuaibing01.workers.dev/finance-status')]);const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};const total=Number(p.productCount||0);const v12=p.v12||{};const v13=p.v13||{};set('pdListingState',p.success&&p.ready?'REAL · Listing '+String(v12.listingResolvedCount||0)+'/'+String(total)+' · 主图 '+String(v12.imageResolvedCount||0)+'/'+String(total):'状态读取失败');set('pdListingCompleteness',p.success&&p.ready?'REAL '+String(v12.listingResolvedCount||0)+'/'+String(total):'PENDING');set('pdInventorySnapshot',v13.inventorySnapshotReady?'REAL '+String(v13.inventoryRecordCount||0)+'/'+String(total):'PENDING');set('pdInventoryState',v13.inventorySnapshotReady?'INVENTORY REAL · VELOCITY PENDING':'PENDING');set('pdStoreSales',s.success&&s.ready?'REAL · '+(s.rangesAvailable||[]).join(' / '):'PENDING');set('pdSalesState',s.success&&s.ready?'STORE REAL · PRODUCT PENDING':'PENDING_SOURCE');const sp=document.getElementById('pdSalesPill');if(sp){sp.textContent=s.success&&s.ready?'STORE REAL':'PENDING';sp.className=s.success&&s.ready?'pill ok':'pill warn'}set('pdStoreTraffic',t.success&&t.ready?'REAL · '+String(t.dateRecordCount||0)+' 日记录 · 产品匹配 '+String(t.matchedProductCount||0):'PENDING');set('pdTrafficState',t.success&&t.ready?'STORE REAL · PRODUCT MAPPING '+String(t.matchedProductCount||0):'PENDING_SOURCE');const tp=document.getElementById('pdTrafficPill');if(tp){tp.textContent=t.success&&t.ready?'STORE REAL':'PENDING';tp.className=t.success&&t.ready?'pill ok':'pill warn'}set('pdFinanceState',f.success&&f.ready?'CONNECTED · '+String(f.transactionCount||0)+' transactions · 口径待验证':'PENDING')}
`;
  html=html.replace(marker,js+marker);
}

fs.writeFileSync(path,html);
console.log('Product center and single-product cockpit V2 patched');
