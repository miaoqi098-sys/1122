import fs from 'node:fs';

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');

const cssMarker = '.toast{position:fixed;right:24px;bottom:24px;background:#111827;color:#fff;padding:12px 16px;border-radius:12px;font-size:13px;opacity:0;transform:translateY(8px);transition:.2s;pointer-events:none}.toast.show{opacity:1;transform:none}';
const cssAppend = `.ops-controls{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.ops-control{border:1px solid var(--line);background:#fff;border-radius:10px;padding:9px 11px;color:var(--text)}.ops-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:16px}.ops-kpi{background:#fff;border:1px solid var(--line);border-radius:15px;padding:15px}.ops-kpi .value{font-size:22px;font-weight:800;margin:7px 0 4px}.ops-kpi .value.pending{font-size:15px;color:var(--muted)}.ops-layout{display:grid;grid-template-columns:1.25fr .75fr;gap:16px;margin-bottom:16px}.ops-domain-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:16px}.ops-health-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}.ops-mini{background:#f9fafb;border:1px solid var(--line);border-radius:12px;padding:12px}.ops-mini strong{display:block;font-size:17px;margin-bottom:3px}.ops-row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-top:1px solid var(--line);padding:12px 0}.ops-row:first-of-type{border-top:0}.ops-row-main{min-width:0}.ops-row-title{font-weight:750;font-size:14px}.ops-row-meta{color:var(--muted);font-size:12px;line-height:1.55;margin-top:4px}.ops-priority{flex:0 0 auto;font-size:11px;border-radius:999px;padding:5px 8px;background:var(--soft)}.ops-priority.warn{background:var(--warn)}.ops-priority.bad{background:var(--bad)}.ops-source-line{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--line);font-size:13px}.ops-source-line:first-of-type{border-top:0}.ops-module-links{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.ops-module-link{border:1px solid var(--line);background:#fff;border-radius:14px;padding:14px;cursor:pointer}.ops-module-link:hover{box-shadow:0 6px 18px rgba(15,23,42,.07)}.ops-module-link strong{display:block;margin-bottom:5px}.ops-note{font-size:11px;color:var(--muted);line-height:1.5}.data-state{font-size:10px;letter-spacing:.04em;font-weight:800;color:var(--muted);margin-top:6px}.data-state.real{color:#047857}.data-state.pending{color:#b45309}@media(max-width:1250px){.ops-kpis{grid-template-columns:repeat(3,1fr)}.ops-module-links{grid-template-columns:repeat(3,1fr)}}@media(max-width:900px){.ops-layout,.ops-domain-grid{grid-template-columns:1fr}.ops-health-grid{grid-template-columns:repeat(2,1fr)}.ops-module-links{grid-template-columns:1fr 1fr}}@media(max-width:600px){.ops-kpis{grid-template-columns:1fr 1fr}.ops-health-grid,.ops-module-links{grid-template-columns:1fr}}`;
if (!html.includes(cssMarker)) throw new Error('Missing CSS marker');
html = html.replace(cssMarker, cssMarker + cssAppend);

const newOperations = `<section id="operations" class="view">
<div class="topbar">
  <div class="title"><h1>运营驾驶舱</h1><p>先看经营结果，再看异常、产品、流量广告、库存、价格利润、竞品市场与任务执行。</p></div>
  <div class="ops-controls">
    <select class="ops-control" id="opsMarketplace"><option value="US">US · 美国站</option></select>
    <select class="ops-control" id="opsRange" onchange="toast('时间范围将在销售/广告数据接入后生效')"><option>今日</option><option>近7天</option><option>近30天</option></select>
    <button class="btn secondary" onclick="refreshOperationsCockpit()">刷新数据状态</button>
  </div>
</div>
<div class="banner"><strong>当前模式：</strong>Internal Read Only（内部只读）。ProductIdentity 与商品状态已接真实 Amazon 数据；Sif MCP 已真实连通。Orders / Finance / Ads API 尚未完整接入，因此相关经营指标明确显示为待接数据源，不使用示例数字。</div>

<div class="ops-kpis">
  <div class="ops-kpi"><div class="kpi-label">销售额</div><div class="value pending">待接 Orders</div><div class="data-state pending">PENDING_SOURCE</div></div>
  <div class="ops-kpi"><div class="kpi-label">订单量</div><div class="value pending">待接 Orders</div><div class="data-state pending">PENDING_SOURCE</div></div>
  <div class="ops-kpi"><div class="kpi-label">贡献利润</div><div class="value pending">待接 Finance + 成本</div><div class="data-state pending">PENDING_SOURCE</div></div>
  <div class="ops-kpi"><div class="kpi-label">广告花费</div><div class="value pending">待 Ads API</div><div class="data-state pending">PENDING_SOURCE</div></div>
  <div class="ops-kpi"><div class="kpi-label">转化率</div><div class="value pending">待流量/订单数据</div><div class="data-state pending">PENDING_SOURCE</div></div>
  <div class="ops-kpi"><div class="kpi-label">真实产品身份</div><div class="value" id="opsProductCount">—</div><div class="data-state real" id="opsProductState">REAL · Amazon</div></div>
</div>

<div class="ops-layout">
  <div class="card">
    <div class="section-title"><h2>今日经营重点</h2><span class="pill" id="opsDecisionRuntime">A1 Runtime 待接</span></div>
    <div class="ops-row"><div class="ops-row-main"><div class="ops-row-title">经营决策运行层尚未接入</div><div class="ops-row-meta">Agent-1 框架已经定义 FinalDecision，但真实 Runner / Scheduler / Executor 尚未接入。这里未来只展示 A1 最终决策，不直接展示专业 Agent 的原始建议。</div></div><span class="ops-priority warn">待运行层</span></div>
    <div class="ops-row"><div class="ops-row-main"><div class="ops-row-title">V1.3：InventorySnapshot（库存快照）</div><div class="ops-row-meta">FBA total / fulfillable / inbound 数据已经存在，下一步从 ProductIdentity 附属字段升级成独立库存对象，为缺货与补货判断打底。</div></div><span class="ops-priority">工程重点</span></div>
    <div class="ops-row"><div class="ops-row-main"><div class="ops-row-title">Listing Status 语义验证</div><div class="ops-row-meta">BUYABLE 等 Amazon 状态字段暂不直接转换成“可售/不可售”的经营结论，等待语义验证。</div></div><span class="ops-priority warn">需验证</span></div>
  </div>

  <div class="card">
    <div class="section-title"><h2>产品健康总览</h2><span class="pill ok" id="opsListingPill">读取中</span></div>
    <div class="ops-health-grid">
      <div class="ops-mini"><strong id="opsHealthProducts">—</strong><div class="meta">ProductIdentity</div></div>
      <div class="ops-mini"><strong id="opsHealthListings">—</strong><div class="meta">Listing 已读取</div></div>
      <div class="ops-mini"><strong id="opsHealthPrices">—</strong><div class="meta">价格已读取</div></div>
      <div class="ops-mini"><strong id="opsHealthErrors">—</strong><div class="meta">API 聚合错误</div></div>
    </div>
    <div class="item"><strong>数据隐私</strong><div class="meta">SKU / ASIN / Seller ID / 价格 / 库存明细仍只保存在后端数据层；完成 Web 身份认证后再开放完整产品列表。</div></div>
    <div class="actions"><button class="btn" onclick="openProductCenter()">进入产品运营中心</button></div>
  </div>
</div>

<div class="ops-domain-grid">
  <div class="card"><div class="section-title"><h2>流量与广告</h2><span class="pill warn">部分待接</span></div>
    <div class="ops-row"><div class="ops-row-main"><div class="ops-row-title">Sif 市场数据</div><div class="ops-row-meta" id="opsSifText">正在检查 Sif MCP…</div></div><span class="data-state real">REAL</span></div>
    <div class="ops-row"><div class="ops-row-main"><div class="ops-row-title">自有广告表现</div><div class="ops-row-meta">Campaign / Keyword / Spend / Sales / ACOS / ROAS 等等待 Amazon Ads API 审核与授权。</div></div><span class="data-state pending">PENDING_SOURCE</span></div>
    <div class="ops-row"><div class="ops-row-main"><div class="ops-row-title">自然 / 广告流量结构</div><div class="ops-row-meta">后续由 SP-API + Ads API + Sif 统一到 ProductIdentity 维度。</div></div><span class="data-state pending">PENDING_SOURCE</span></div>
  </div>

  <div class="card"><div class="section-title"><h2>库存与供应链</h2><span class="pill warn">V1.3 下一步</span></div>
    <div class="ops-row"><div class="ops-row-main"><div class="ops-row-title">FBA 基础库存字段</div><div class="ops-row-meta">total / fulfillable / inbound working / shipped / receiving 已进入私有 ProductIdentity Snapshot。</div></div><span class="data-state real">REAL</span></div>
    <div class="ops-row"><div class="ops-row-main"><div class="ops-row-title">库存覆盖天数 / 断货日期</div><div class="ops-row-meta">需要销售速度与 InventorySnapshot 后计算。</div></div><span class="data-state pending">PENDING_MODEL</span></div>
    <div class="ops-row"><div class="ops-row-main"><div class="ops-row-title">补货建议</div><div class="ops-row-meta">未来由库存 Agent 生成事件，A1 决策后进入 Task Center。</div></div><span class="data-state pending">PENDING_AGENT</span></div>
  </div>

  <div class="card"><div class="section-title"><h2>价格、促销与利润</h2><span class="pill warn">部分待接</span></div>
    <div class="ops-row"><div class="ops-row-main"><div class="ops-row-title">自有 Listing Price</div><div class="ops-row-meta" id="opsPriceText">正在读取价格完成度…</div></div><span class="data-state real">REAL</span></div>
    <div class="ops-row"><div class="ops-row-main"><div class="ops-row-title">Reference / Was Price · Coupon · Deal</div><div class="ops-row-meta">后续独立建 PricePromotionSnapshot，避免与当前报价字段混淆。</div></div><span class="data-state pending">PENDING_SOURCE</span></div>
    <div class="ops-row"><div class="ops-row-main"><div class="ops-row-title">贡献利润 / 毛利率</div><div class="ops-row-meta">等待 Amazon Finance + 内部采购、头程和仓储成本。</div></div><span class="data-state pending">PENDING_SOURCE</span></div>
  </div>

  <div class="card"><div class="section-title"><h2>竞品与市场</h2><span class="pill ok">Sif Ready</span></div>
    <div class="ops-row"><div class="ops-row-main"><div class="ops-row-title">关键词与流量信号</div><div class="ops-row-meta">Sif MCP 已完成真实 ASIN 查询验证，可作为竞品流量、关键词和市场信号源。</div></div><span class="data-state real">REAL CAPABILITY</span></div>
    <div class="ops-row"><div class="ops-row-main"><div class="ops-row-title">竞品变化事件</div><div class="ops-row-meta">下一阶段按 ProductIdentity / CompetitorIdentity 标准化后进入 A3 竞品智能体。</div></div><span class="data-state pending">PENDING_PIPELINE</span></div>
    <div class="actions"><button class="btn secondary" onclick="openSif()">查看 Sif 连接</button></div>
  </div>
</div>

<div class="ops-layout">
  <div class="card"><div class="section-title"><h2>任务与执行</h2><span class="pill warn">Runtime 待接</span></div>
    <div class="ops-health-grid">
      <div class="ops-mini"><strong>—</strong><div class="meta">待审批</div></div><div class="ops-mini"><strong>—</strong><div class="meta">待执行</div></div><div class="ops-mini"><strong>—</strong><div class="meta">待验证</div></div><div class="ops-mini"><strong>—</strong><div class="meta">失败 / 回滚</div></div>
    </div>
    <div class="item"><strong>状态边界</strong><div class="meta">Decision、Task、ExecutionResult、ValidationResult 分开显示；“任务执行成功”不等于“经营目标成功”。</div></div>
  </div>

  <div class="card"><div class="section-title"><h2>数据与系统健康</h2><span class="pill" id="opsDataHealthPill">检查中</span></div>
    <div class="ops-source-line"><span>Amazon SP-API</span><span class="tag ok" id="opsAmazonStatus"><span class="dot"></span>检查中</span></div>
    <div class="ops-source-line"><span>Sif MCP</span><span class="tag ok" id="opsSifStatus"><span class="dot"></span>检查中</span></div>
    <div class="ops-source-line"><span>Amazon Ads API</span><span class="tag warn"><span class="dot"></span>待审核/授权</span></div>
    <div class="ops-source-line"><span>Email Bridge</span><span class="tag warn"><span class="dot"></span>暂未对接</span></div>
    <div class="ops-source-line"><span>Web 身份认证</span><span class="tag warn"><span class="dot"></span>待建设</span></div>
    <div class="ops-note" id="opsFreshness">正在读取数据更新时间…</div>
  </div>
</div>

<div class="card"><div class="section-title"><h2>业务功能入口</h2><span class="pill">二级板块</span></div>
  <div class="ops-module-links">
    <div class="ops-module-link" onclick="openProductCenter()"><strong>产品</strong><div class="meta">单品经营状态、Listing、价格、流量与体验。</div></div>
    <div class="ops-module-link" onclick="toast('库存物流：正在建设 InventorySnapshot')"><strong>库存物流</strong><div class="meta">库存、补货、在途、仓储和物流风险。</div></div>
    <div class="ops-module-link" onclick="toast('广告：等待 Ads API 审核与授权')"><strong>广告</strong><div class="meta">Campaign、搜索词、竞价、预算和转化。</div></div>
    <div class="ops-module-link" onclick="toast('竞品：下一步接 Sif 标准化竞品事件')"><strong>竞品</strong><div class="meta">竞品价格、流量、广告、评价与变化。</div></div>
    <div class="ops-module-link" onclick="openWebsiteCenter()"><strong>站外推广</strong><div class="meta">官网、红人、内容与站外推广项目。</div></div>
  </div>
</div>
</section>`;

const opsRegex = /<section id="operations" class="view">[\s\S]*?<\/section>\s*<section id="product-center" class="view">/;
if (!opsRegex.test(html)) throw new Error('Missing operations section');
html = html.replace(opsRegex, newOperations + '\n<section id="product-center" class="view">');

html = html.replace('<a onclick="openView(\'operations\',this)">运营</a>', '<a onclick="openOperations(this)">运营</a>');

const jsMarker = "function openProductCenter(){hideAll();document.getElementById('product-center').classList.add('show');activate(nav.querySelectorAll('a')[2]);window.scrollTo({top:0,behavior:'smooth'});setTimeout(checkProductIdentityStatus,120)}";
if (!html.includes(jsMarker)) throw new Error('Missing JS insertion marker');
const jsAppend = `\nfunction openOperations(a){openView('operations',a||nav.querySelectorAll('a')[2]);setTimeout(refreshOperationsCockpit,100)}\nasync function refreshOperationsCockpit(){const setText=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};try{const res=await fetch('https://1122-amazon-sp-api-bridge.zhangshuaibing01.workers.dev/product-identity-status',{headers:{'Accept':'application/json'}});const d=await res.json();if(!res.ok||d.success!==true)throw new Error(d.message||d.error||'Amazon status failed');const total=d.productCount??0;const s=d.v12||{};setText('opsProductCount',String(total));setText('opsHealthProducts',String(total));setText('opsHealthListings',String(s.listingResolvedCount??0)+'/'+String(total));setText('opsHealthPrices',String(s.priceResolvedCount??0)+'/'+String(total));setText('opsHealthErrors',String((s.pricingBatchErrorCount??0)+(s.listingErrorCount??0)));setText('opsPriceText','真实自有价格已读取 '+String(s.priceResolvedCount??0)+'/'+String(total)+'；具体价格保存在后端私有数据层。');const lp=document.getElementById('opsListingPill');if(lp){lp.textContent='Listing '+String(s.listingResolvedCount??0)+'/'+String(total);lp.className='pill ok'}const am=document.getElementById('opsAmazonStatus');if(am){am.innerHTML='<span class="dot"></span>已连接';am.className='tag ok'}if(d.updatedAt){const dt=new Date(d.updatedAt);setText('opsFreshness','Amazon 商品数据最近刷新：'+(Number.isNaN(dt.getTime())?d.updatedAt:dt.toLocaleString())+'。经营指标必须继续保留 freshness。')}}catch(e){const am=document.getElementById('opsAmazonStatus');if(am){am.innerHTML='<span class="dot"></span>异常';am.className='tag bad'}setText('opsFreshness','Amazon 数据状态读取失败：'+e.message)}try{const res=await fetch('https://1122-sif-bridge.zhangshuaibing01.workers.dev/connection-status',{headers:{'Accept':'application/json'}});const d=await res.json();if(!res.ok||d.success!==true)throw new Error(d.message||d.error||'Sif status failed');setText('opsSifText','Sif MCP 已连接，当前可识别 '+String(d.sif?.toolCount??0)+' 个 MCP Tool，可用于关键词、流量、竞品和广告市场研究。');const ss=document.getElementById('opsSifStatus');if(ss){ss.innerHTML='<span class="dot"></span>已连接';ss.className='tag ok'}}catch(e){setText('opsSifText','Sif MCP 状态读取失败：'+e.message);const ss=document.getElementById('opsSifStatus');if(ss){ss.innerHTML='<span class="dot"></span>异常';ss.className='tag bad'}}const health=document.getElementById('opsDataHealthPill');if(health){health.textContent='已检查';health.className='pill ok'}}`;
html = html.replace(jsMarker, jsMarker + jsAppend);

fs.writeFileSync(path, html);
console.log('Operations Cockpit V2 patched');
