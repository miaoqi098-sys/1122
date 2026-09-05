(() => {
  const ready = window.__1122_DATA_READY__ || Promise.resolve(window.__1122_DATA__ || {});
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num = v => v === null || v === undefined || Number.isNaN(Number(v)) ? 0 : Number(v);
  const fmtNum = (v,d=0) => Number(v||0).toLocaleString(undefined,{maximumFractionDigits:d});
  const fmtMoney = v => `$${Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const fmtPct = v => v===null || v===undefined ? '—' : `${(Number(v)<=1?Number(v)*100:Number(v)).toFixed(1)}%`;
  const tagClass = v => /LIVE|SUCCESS|FRESH|POSITIVE|ALLOWED|LOW/i.test(String(v)) ? 'ok' : /ERROR|FAIL|BLOCK|NONCOMPLIANT/i.test(String(v)) ? 'bad' : 'warn';
  const tag = v => `<span class="tag tag-${tagClass(v)}">${esc(v ?? 'UNKNOWN')}</span>`;

  async function renderHomeLive(){
    const route=(location.hash||'#/command-center').replace(/^#/,'');
    if(route!=='/command-center' && route!=='/') return;
    const data=await ready;
    const products=Array.isArray(data.products)?data.products:[];
    const agents=Array.isArray(data.agents)?data.agents:[];
    const tasks=Array.isArray(data.tasks)?data.tasks:[];
    const apr=Array.isArray(data.apr)?data.apr:[];
    const aom=Array.isArray(data.aom)?data.aom:[];
    const apb=Array.isArray(data.apb)?data.apb:[];
    const view=document.getElementById('view'); if(!view) return;
    document.getElementById('page-title').textContent='经营指挥中心';
    document.getElementById('breadcrumb').textContent='首页 / 经营指挥中心';

    const sales=products.reduce((a,p)=>a+num(p.sales),0);
    const units=products.reduce((a,p)=>a+num(p.units),0);
    const adSpend=products.reduce((a,p)=>a+num(p.ad_spend),0);
    const profit=products.reduce((a,p)=>a+num(p.contribution_profit),0);
    const sessions=products.reduce((a,p)=>a+num(p.sessions),0);
    const orders=products.reduce((a,p)=>a+num(p.orders_count),0);
    const portfolioCvr=sessions>0?orders/sessions:null;
    const pending=tasks.filter(x=>/pending/i.test(String(x.approval_status||x.task_status))).length;
    const lowReview=[...products].filter(p=>p.review_count!==null&&p.review_count!==undefined).sort((a,b)=>num(a.review_count)-num(b.review_count)).slice(0,5);
    const highSpend=[...products].sort((a,b)=>num(b.ad_spend)-num(a.ad_spend)).slice(0,5);
    const src=data.__source?.source_status||data.source_status||{};

    view.innerHTML=`
      <div class="hero"><div><h2>真实经营事实 + Agent + Amazon 边界情报</h2><p>首页已接入 1122-core。经营指标来自各产品最新 product_daily_state；APR/AOM/APB 当前仍按来源快照展示并明确标记。</p></div><div class="hero-actions"><a class="btn btn-primary" href="#/operations/products">查看 ${products.length} 个产品</a><a class="btn" href="#/amazon-boundary/apr">APR 探索</a></div></div>
      <div class="grid grid-4 section">
        <div class="card metric-card"><div class="metric-label">产品</div><div class="metric-value">${products.length}</div><div class="metric-meta">${tag(src.products||'UNKNOWN')}</div></div>
        <div class="card metric-card"><div class="metric-label">最新状态销售额</div><div class="metric-value">${fmtMoney(sales)}</div><div class="metric-meta">${fmtNum(units)} units · ${fmtNum(orders)} orders</div></div>
        <div class="card metric-card"><div class="metric-label">广告花费</div><div class="metric-value">${fmtMoney(adSpend)}</div><div class="metric-meta">Portfolio CVR ${portfolioCvr===null?'—':fmtPct(portfolioCvr)}</div></div>
        <div class="card metric-card"><div class="metric-label">贡献利润</div><div class="metric-value">${fmtMoney(profit)}</div><div class="metric-meta">按最新产品状态汇总</div></div>
      </div>
      <div class="grid grid-3 section">
        <div class="card"><div class="section-head"><div><h2>需要我处理</h2><div class="section-sub">来自 D1 tasks</div></div></div><div class="metric-value">${pending}</div><div class="item-meta">全部任务 ${tasks.length} 条。当前没有数据就显示 0，不制造虚假待办。</div><div style="margin-top:12px"><a class="route-link" href="#/tasks">打开任务中心 →</a></div></div>
        <div class="card"><div class="section-head"><div><h2>Agent 运行组件</h2><div class="section-sub">已写入事实层</div></div></div><div class="metric-value">${agents.length}</div><div class="item-meta">只统计真实返回的 runtime facts，不把设计态 Agent 算作在线。</div><div style="margin-top:12px"><a class="route-link" href="#/agents">查看运行状态 →</a></div></div>
        <div class="card"><div class="section-head"><div><h2>Amazon 情报</h2><div class="section-sub">APR / AOM / APB</div></div></div><div class="kpi-row">${tag(`APR ${apr.length}`)}${tag(`AOM ${aom.length}`)}${tag(`APB ${apb.length}`)}</div><div class="item-meta" style="margin-top:12px">APR/AOM/APB 当前来源：${esc(src.apr||'UNKNOWN')} / ${esc(src.aom||'UNKNOWN')} / ${esc(src.apb||'UNKNOWN')}</div></div>
      </div>
      <div class="grid grid-2 section">
        <div class="card"><div class="section-head"><div><h2>Review 建设优先观察</h2><div class="section-sub">按当前 Review 数从低到高</div></div><a class="route-link" href="#/amazon-boundary/aom">Review AOM →</a></div>
          <div class="list">${lowReview.length?lowReview.map(p=>`<div class="list-item"><div class="item-title"><a class="route-link" href="#/products/${encodeURIComponent(p.product_id)}">${esc(p.title||p.asin)}</a></div><div class="item-meta">${esc(p.asin||'')} · ${fmtNum(p.review_count)} reviews · Rating ${p.rating==null?'—':fmtNum(p.rating,2)}</div></div>`).join(''):'<div class="muted">暂无 Review 数据</div>'}</div>
        </div>
        <div class="card"><div class="section-head"><div><h2>广告花费观察</h2><div class="section-sub">按当前广告花费排序</div></div><a class="route-link" href="#/operations/ads">广告中心 →</a></div>
          <div class="list">${highSpend.length?highSpend.map(p=>`<div class="list-item"><div class="item-title"><a class="route-link" href="#/products/${encodeURIComponent(p.product_id)}">${esc(p.title||p.asin)}</a></div><div class="item-meta">Spend ${fmtMoney(p.ad_spend)} · Sales ${fmtMoney(p.sales)} · ACOS ${fmtPct(p.acos)} · TACOS ${fmtPct(p.tacos)}</div></div>`).join(''):'<div class="muted">暂无广告数据</div>'}</div>
        </div>
      </div>
      <div class="grid grid-3 section">
        <div class="card goal-card" onclick="location.hash='/amazon-boundary/apr'"><div class="goal-title">APR 最新探索</div><div class="goal-desc">${apr.length} 条市场玩法/边界模式；重点观察真实市场发生了什么。</div></div>
        <div class="card goal-card" onclick="location.hash='/amazon-boundary/aom'"><div class="goal-title">AOM 正向方法</div><div class="goal-desc">${aom.length} 条当前方法；按产品经营目标筛选。</div></div>
        <div class="card goal-card" onclick="location.hash='/amazon-boundary/apb'"><div class="goal-title">APB 政策证据</div><div class="goal-desc">${apb.length} 条当前政策/边界记录，18 域持续补全。</div></div>
      </div>
      <div class="notice ${src.d1==='LIVE_D1_READ'?'':'warn'} section">D1：${tag(src.d1||'UNKNOWN')} · Products：${tag(src.products||'UNKNOWN')} · Agents：${tag(src.agents||'UNKNOWN')} · Tasks：${tag(src.tasks||'UNKNOWN')}。整包 live_data_verified=${esc(data.live_data_verified)}，因为 APR/AOM/APB 尚未全部迁入实时持久层。</div>`;
  }

  window.addEventListener('hashchange',()=>setTimeout(renderHomeLive,10));
  window.addEventListener('load',()=>setTimeout(renderHomeLive,10));
  setTimeout(renderHomeLive,20);
})();
