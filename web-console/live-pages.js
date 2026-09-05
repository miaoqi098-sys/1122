(() => {
  const ready = window.__1122_DATA_READY__ || Promise.resolve(window.__1122_DATA__ || {});
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const fmtNum = (v, digits=0) => v===null || v===undefined || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString(undefined,{maximumFractionDigits:digits});
  const fmtMoney = (v,c='USD') => v===null || v===undefined ? '—' : `${c==='USD'?'$':''}${Number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const fmtPct = v => v===null || v===undefined ? '—' : `${(Number(v) <= 1 ? Number(v)*100 : Number(v)).toFixed(1)}%`;
  const statusClass = v => /success|fresh|live|active|healthy/i.test(String(v)) ? 'ok' : /fail|error|stale|blocked/i.test(String(v)) ? 'bad' : 'warn';
  const tag = v => `<span class="tag tag-${statusClass(v)}">${esc(v ?? 'UNKNOWN')}</span>`;

  function sourceNote(data, section){
    const status=data?.__source?.source_status || data?.source_status || {};
    const sectionStatus=status[section] || status.d1 || 'UNKNOWN';
    return `<div class="notice ${/LIVE/.test(sectionStatus)?'':'warn'} section">数据状态：${tag(sectionStatus)} · 只读展示，不授予任何生产执行权限。</div>`;
  }

  async function renderProducts(){
    const data=await ready;
    const products=Array.isArray(data.products)?data.products:[];
    const view=document.getElementById('view'); if(!view) return;
    document.getElementById('page-title').textContent='产品经营中心';
    document.getElementById('breadcrumb').textContent='运营 / 产品';
    const totalSales=products.reduce((a,p)=>a+(Number(p.sales)||0),0);
    const totalUnits=products.reduce((a,p)=>a+(Number(p.units)||0),0);
    const totalSpend=products.reduce((a,p)=>a+(Number(p.ad_spend)||0),0);
    const totalProfit=products.reduce((a,p)=>a+(Number(p.contribution_profit)||0),0);
    view.innerHTML=`
      <div class="hero"><div><h2>产品经营中心</h2><p>直接读取 1122-core 最新产品状态。点击行内 ASIN 可进入单品状态详情视图。</p></div></div>
      <div class="grid grid-4 section">
        <div class="card metric-card"><div class="metric-label">产品数</div><div class="metric-value">${products.length}</div><div class="metric-meta">US marketplace</div></div>
        <div class="card metric-card"><div class="metric-label">最新状态销售额合计</div><div class="metric-value">${fmtMoney(totalSales)}</div><div class="metric-meta">按各产品最新 product_daily_state 汇总</div></div>
        <div class="card metric-card"><div class="metric-label">销量合计</div><div class="metric-value">${fmtNum(totalUnits)}</div><div class="metric-meta">units</div></div>
        <div class="card metric-card"><div class="metric-label">贡献利润合计</div><div class="metric-value">${fmtMoney(totalProfit)}</div><div class="metric-meta">广告花费 ${fmtMoney(totalSpend)}</div></div>
      </div>
      <section class="section"><div class="section-head"><div><h2>产品最新经营状态</h2><div class="section-sub">Sales / Traffic / Ads / Inventory / Review / Profit</div></div></div>
        <div class="table-wrap"><table><thead><tr>
          <th>产品 / ASIN</th><th>日期 / 阶段</th><th>销售</th><th>流量/转化</th><th>广告</th><th>库存</th><th>Review</th><th>利润</th><th>目标</th>
        </tr></thead><tbody>
        ${products.length?products.map(p=>`<tr>
          <td><strong>${esc(p.title||p.sku||p.asin||p.product_id)}</strong><div class="item-meta"><a class="route-link" href="#/products/${encodeURIComponent(p.product_id)}">${esc(p.asin||'NO ASIN')}</a> · ${esc(p.sku||'NO SKU')}</div></td>
          <td>${esc(p.business_date||'—')}<div class="item-meta">${esc(p.stage||'阶段未定义')}</div></td>
          <td>${fmtMoney(p.sales,p.currency)}<div class="item-meta">${fmtNum(p.units)} units · ${fmtNum(p.orders_count)} orders</div></td>
          <td>${fmtNum(p.sessions)} sessions<div class="item-meta">CVR ${fmtPct(p.conversion_rate)} · PV ${fmtNum(p.page_views)}</div></td>
          <td>${fmtMoney(p.ad_spend,p.currency)}<div class="item-meta">ACOS ${fmtPct(p.acos)} · TACOS ${fmtPct(p.tacos)}</div></td>
          <td>${fmtNum(p.fulfillable_inventory)} FBA<div class="item-meta">Inbound ${fmtNum(p.inbound_inventory)} · ${fmtNum(p.coverage_days,1)} days</div></td>
          <td>${p.rating==null?'—':`${fmtNum(p.rating,2)} ★`}<div class="item-meta">${fmtNum(p.review_count)} reviews</div></td>
          <td>${fmtMoney(p.contribution_profit,p.currency)}<div class="item-meta">Margin ${fmtPct(p.profit_margin)}</div></td>
          <td>${esc(p.primary_goal||'—')}</td>
        </tr>`).join(''):`<tr><td colspan="9">暂无产品数据</td></tr>`}
        </tbody></table></div>
      </section>${sourceNote(data,'products')}`;
  }

  async function renderProductDetail(productId){
    const data=await ready;
    const p=(data.products||[]).find(x=>String(x.product_id)===decodeURIComponent(productId));
    const view=document.getElementById('view'); if(!view) return;
    document.getElementById('page-title').textContent=p?.title||'产品状态卡';
    document.getElementById('breadcrumb').textContent='运营 / 产品 / 状态卡';
    if(!p){view.innerHTML='<div class="empty-state"><h3>未找到产品</h3><p>该 product_id 不在当前只读结果中。</p></div>';return;}
    view.innerHTML=`
      <div class="hero"><div><h2>${esc(p.title||p.asin)}</h2><p>${esc(p.asin||'')} · ${esc(p.sku||'')} · ${esc(p.brand||'')} · ${esc(p.fulfillment_channel||'')}</p></div><div class="hero-actions"><a class="btn" href="#/operations/products">返回产品列表</a></div></div>
      <div class="grid grid-4 section">
        <div class="card metric-card"><div class="metric-label">销售额</div><div class="metric-value">${fmtMoney(p.sales,p.currency)}</div><div class="metric-meta">${fmtNum(p.units)} units / ${fmtNum(p.orders_count)} orders</div></div>
        <div class="card metric-card"><div class="metric-label">流量与转化</div><div class="metric-value">${fmtNum(p.sessions)}</div><div class="metric-meta">CVR ${fmtPct(p.conversion_rate)} / ${fmtNum(p.page_views)} PV</div></div>
        <div class="card metric-card"><div class="metric-label">广告</div><div class="metric-value">${fmtMoney(p.ad_spend,p.currency)}</div><div class="metric-meta">ACOS ${fmtPct(p.acos)} / TACOS ${fmtPct(p.tacos)}</div></div>
        <div class="card metric-card"><div class="metric-label">贡献利润</div><div class="metric-value">${fmtMoney(p.contribution_profit,p.currency)}</div><div class="metric-meta">Margin ${fmtPct(p.profit_margin)}</div></div>
      </div>
      <div class="grid grid-3 section">
        <div class="card"><div class="item-title">当前阶段与目标</div><div class="item-meta">阶段：${esc(p.stage||'未定义')}</div><div class="item-meta">目标：${esc(p.primary_goal||'未定义')}</div><div class="item-meta">Business date：${esc(p.business_date||'—')}</div></div>
        <div class="card"><div class="item-title">库存状态</div><div class="item-meta">FBA 可售：${fmtNum(p.fulfillable_inventory)}</div><div class="item-meta">Inbound：${fmtNum(p.inbound_inventory)}</div><div class="item-meta">Coverage：${fmtNum(p.coverage_days,1)} days</div></div>
        <div class="card"><div class="item-title">消费者体验</div><div class="item-meta">Rating：${p.rating==null?'—':fmtNum(p.rating,2)}</div><div class="item-meta">Review：${fmtNum(p.review_count)}</div><div class="item-meta"><a class="route-link" href="#/amazon-boundary/aom">查看 AOM Review 方法</a></div></div>
      </div>
      <div class="grid grid-3 section">
        <div class="card goal-card" onclick="location.hash='/amazon-boundary/apr'"><div class="goal-title">APR 相关市场模式</div><div class="goal-desc">查看可能影响该商品的市场玩法与边界信号。</div></div>
        <div class="card goal-card" onclick="location.hash='/amazon-boundary/aom'"><div class="goal-title">AOM 推荐方法</div><div class="goal-desc">从经营目标筛选可用方法。</div></div>
        <div class="card goal-card" onclick="location.hash='/amazon-boundary/apb'"><div class="goal-title">APB 政策影响</div><div class="goal-desc">查看 Amazon Policy / Boundary Evidence。</div></div>
      </div>${sourceNote(data,'products')}`;
  }

  async function renderAgents(){
    const data=await ready; const rows=Array.isArray(data.agents)?data.agents:[]; const view=document.getElementById('view'); if(!view)return;
    document.getElementById('page-title').textContent='Agent 中心'; document.getElementById('breadcrumb').textContent='Agent';
    view.innerHTML=`<div class="hero"><div><h2>Agent 运行状态</h2><p>当前只展示已写入事实层的 Agent 运行组件状态，不把设计态 Agent 冒充为在线运行实例。</p></div></div>
      <section class="section"><div class="table-wrap"><table><thead><tr><th>Agent</th><th>组件</th><th>Status</th><th>Freshness</th><th>Last Success</th><th>Runtime</th><th>Updated</th></tr></thead><tbody>
      ${rows.length?rows.map(x=>`<tr><td><strong>${esc(x.agent_id)}</strong></td><td class="code">${esc(x.component)}</td><td>${tag(x.status)}</td><td>${tag(x.freshness_status)}</td><td>${esc(x.last_success_at||'—')}</td><td>${esc(x.runtime_version||'—')}</td><td>${esc(x.updated_at||'—')}</td></tr>`).join(''):'<tr><td colspan="7">暂无 Agent runtime facts</td></tr>'}
      </tbody></table></div></section>${sourceNote(data,'agents')}`;
  }

  async function renderTasks(){
    const data=await ready; const rows=Array.isArray(data.tasks)?data.tasks:[]; const view=document.getElementById('view'); if(!view)return;
    document.getElementById('page-title').textContent='任务中心'; document.getElementById('breadcrumb').textContent='任务中心';
    const pending=rows.filter(x=>/pending/i.test(String(x.approval_status||x.task_status))).length;
    view.innerHTML=`<div class="hero"><div><h2>任务中心</h2><p>Decision → TaskDraft → Approval → Permission → Outcome。当前事实层有 ${rows.length} 条任务。</p></div></div>
      <div class="grid grid-3 section"><div class="card metric-card"><div class="metric-label">全部任务</div><div class="metric-value">${rows.length}</div></div><div class="card metric-card"><div class="metric-label">等待态</div><div class="metric-value">${pending}</div></div><div class="card metric-card"><div class="metric-label">权限</div><div class="metric-value" style="font-size:18px">READ ONLY</div><div class="metric-meta">UI 不拥有 Executor 权限</div></div></div>
      <section class="section"><div class="table-wrap"><table><thead><tr><th>Task</th><th>Product</th><th>Type</th><th>Status</th><th>Approval</th><th>Updated</th></tr></thead><tbody>
      ${rows.length?rows.map(x=>`<tr><td class="code">${esc(x.task_id)}</td><td>${esc(x.product_id||'—')}</td><td>${esc(x.task_type||'—')}</td><td>${tag(x.task_status)}</td><td>${tag(x.approval_status)}</td><td>${esc(x.updated_at||x.created_at||'—')}</td></tr>`).join(''):'<tr><td colspan="6">当前 D1 tasks 表没有任务记录。</td></tr>'}
      </tbody></table></div></section>${sourceNote(data,'tasks')}`;
  }

  async function enhance(){
    const route=(location.hash||'#/command-center').replace(/^#/,'');
    if(route==='/operations/products'||route==='/operations') return renderProducts();
    if(route.startsWith('/products/')) return renderProductDetail(route.slice('/products/'.length));
    if(route==='/agents') return renderAgents();
    if(route==='/tasks') return renderTasks();
  }
  window.addEventListener('hashchange',()=>setTimeout(enhance,0));
  window.addEventListener('load',()=>setTimeout(enhance,0));
  setTimeout(enhance,0);
})();
