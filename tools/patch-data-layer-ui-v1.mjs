import fs from 'node:fs';

const path='index.html';
let html=fs.readFileSync(path,'utf8');

if(!html.includes('onclick="openDataLayer(this)"')){
  const navTarget='<a onclick="placeholder(\'记忆\',this)">记忆</a>\n</nav>';
  if(!html.includes(navTarget)) throw new Error('Data nav insertion target missing');
  html=html.replace(navTarget,'<a onclick="placeholder(\'记忆\',this)">记忆</a>\n<a onclick="openDataLayer(this)">数据</a>\n</nav>');
}

if(!html.includes('<section id="data-layer" class="view">')){
  const marker='<section id="placeholder" class="view">';
  if(!html.includes(marker)) throw new Error('Placeholder section marker missing');
  const section=`<section id="data-layer" class="view">
<div class="crumb">系统 / 数据</div>
<div class="topbar"><div class="title"><h1>1122 数据层</h1><p>经营历史永久化基础：KV 管现在，D1 管可查询历史，R2 管原始档案。</p></div><button class="btn secondary" onclick="refreshDataLayerStatus()">刷新数据状态</button></div>
<div class="banner"><strong>Data Layer V1：</strong>D1 <code>1122-core</code> 已建立并开始永久保存经营事实；现有 KV 继续作为 Current State Cache（当前状态缓存）。R2 <code>1122-data-archive</code> 已规划，但 Cloudflare 账号尚需启用 R2 功能。</div>
<div class="grid four">
  <div class="card"><div class="kpi-label">D1 · 核心经营事实</div><div class="kpi-value" id="dlD1State" style="font-size:21px">检查中</div><div class="meta" id="dlD1Meta">1122-core</div></div>
  <div class="card"><div class="kpi-label">KV · 当前状态</div><div class="kpi-value" id="dlKvState" style="font-size:21px">Ready</div><div class="meta">Current State Cache</div></div>
  <div class="card"><div class="kpi-label">R2 · 永久原始档案</div><div class="kpi-value" id="dlR2State" style="font-size:21px">检查中</div><div class="meta" id="dlR2Meta">1122-data-archive</div></div>
  <div class="card"><div class="kpi-label">自动沉淀</div><div class="kpi-value" style="font-size:21px">Daily</div><div class="meta">每日 14:15 UTC · GitHub Actions</div></div>
</div>
<div class="card"><div class="section-title"><h2>永久经营事实</h2><span class="pill ok" id="dlFactsPill">读取中</span></div>
<div class="ops-health-grid">
  <div class="ops-mini"><strong id="dlProducts">—</strong><div class="meta">Products</div></div>
  <div class="ops-mini"><strong id="dlInventory">—</strong><div class="meta">Inventory Snapshots</div></div>
  <div class="ops-mini"><strong id="dlSales">—</strong><div class="meta">Sales Period Snapshots</div></div>
  <div class="ops-mini"><strong id="dlTraffic">—</strong><div class="meta">Traffic Daily Records</div></div>
  <div class="ops-mini"><strong id="dlFinance">—</strong><div class="meta">Finance Snapshots</div></div>
  <div class="ops-mini"><strong id="dlPlans">—</strong><div class="meta">Operating Plans</div></div>
  <div class="ops-mini"><strong id="dlEvents">—</strong><div class="meta">Events</div></div>
  <div class="ops-mini"><strong id="dlTasks">—</strong><div class="meta">Decisions / Tasks</div></div>
</div></div>
<div class="grid two">
  <div class="card"><div class="section-title"><h2>数据源健康</h2><span class="pill" id="dlSourceCount">—</span></div><div id="dlSources"><div class="meta">正在读取 data_source_state…</div></div></div>
  <div class="card"><div class="section-title"><h2>长期保存规则</h2><span class="pill ok">System Policy</span></div>
    <div class="item"><strong>D1 = Queryable History（可查询历史）</strong><div class="meta">产品、库存、销售、流量、运营计划、事件、决策、任务和验证结果。</div></div>
    <div class="item"><strong>R2 = Raw Archive（原始档案）</strong><div class="meta">Amazon / Ads / Sif 原始 Report、JSON、后续 Parquet 和 D1 导出备份。启用后自动加入写入链。</div></div>
    <div class="item"><strong>KV = Rebuildable Cache（可重建缓存）</strong><div class="meta">只保存最新状态和驾驶舱快速读取结果，不承担永久历史职责。</div></div>
    <div class="item"><strong>Git ≠ Business Database</strong><div class="meta">Git 只保存 Schema、Migration、代码和治理规则，不保存真实经营数据库。</div></div>
  </div>
</div>
<div class="card"><div class="section-title"><h2>数据链</h2><span class="pill">V1</span></div><div class="meta" style="font-size:13px;line-height:1.9">Amazon / Ads / Sif / Internal → Normalize & Validate → <strong>D1 永久事实</strong> + <strong>KV 当前状态</strong> + <strong>R2 原始档案（待账号启用）</strong> → ProductDailyState → Agent / A1 / Task / UI。</div></div>
</section>
`;
  html=html.replace(marker,section+marker);
}

if(!html.includes('async function refreshDataLayerStatus()')){
  const marker="function placeholder(name,a){";
  if(!html.includes(marker)) throw new Error('JS insertion marker missing');
  const js=`function openDataLayer(a){openView('data-layer',a||nav.querySelectorAll('a')[11]);setTimeout(refreshDataLayerStatus,80)}
async function refreshDataLayerStatus(){const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};try{const r=await fetch('https://1122-data-layer.zhangshuaibing01.workers.dev/status',{headers:{'Accept':'application/json'}});const d=await r.json();if(!r.ok||!d.success)throw new Error(d.message||'Data Layer status failed');const s=d.storage||{},q=d.summary||{};set('dlD1State',s.d1?.ready?'Ready':'Error');set('dlD1Meta','1122-core · '+String(s.d1?.tableCount||0)+' tables');set('dlKvState',s.kv?.ready?'Ready':'Unknown');set('dlR2State',s.r2?.ready?'Ready':'Pending');set('dlR2Meta',s.r2?.ready?'1122-data-archive · Private':'等待 Cloudflare 账号启用 R2');set('dlProducts',String(q.products??0));set('dlInventory',String(q.inventorySnapshots??0));set('dlSales',String(q.salesPeriodSnapshots??0));set('dlTraffic',String(q.trafficDailyRecords??0));set('dlFinance',String(q.financePeriodSnapshots??0));set('dlPlans',String(q.operatingPlans??0));set('dlEvents',String(q.events??0));set('dlTasks',String((q.decisions??0)+(q.tasks??0)));const pill=document.getElementById('dlFactsPill');if(pill){pill.textContent=s.d1?.ready?'D1 REAL':'D1 ERROR';pill.className=s.d1?.ready?'pill ok':'pill bad'}const sources=Array.isArray(d.sources)?d.sources:[];set('dlSourceCount',String(sources.length)+' sources');const box=document.getElementById('dlSources');if(box){box.innerHTML=sources.length?sources.map(x=>'<div class="ops-source-line"><span><strong>'+String(x.dataset||x.sourceName||x.sourceKey)+'</strong><br><span class="meta">'+String(x.sourceName||'')+(x.lastSuccessAt?' · '+new Date(x.lastSuccessAt).toLocaleString():'')+'</span></span><span class="tag '+(String(x.status).includes('READY')?'ok':'warn')+'"><span class="dot"></span>'+String(x.status||'UNKNOWN')+'</span></div>').join(''):'<div class="meta">尚无 data_source_state 记录。</div>'}}catch(e){set('dlD1State','Error');set('dlR2State','Unknown');const pill=document.getElementById('dlFactsPill');if(pill){pill.textContent='读取失败';pill.className='pill bad'}const box=document.getElementById('dlSources');if(box)box.innerHTML='<div class="connection-result bad">'+e.message+'</div>'}}
`;
  html=html.replace(marker,js+marker);
}

fs.writeFileSync(path,html);
console.log('Data Layer UI V1 patched');
