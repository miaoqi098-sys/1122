(() => {
  const renderers = window.__1122_PAGE_RENDERERS__ ||= {};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const knownNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const fmtNumber = (value, digits = 0) => knownNumber(value) ? Number(value).toLocaleString('zh-CN', { maximumFractionDigits: digits }) : '—';
  const fmtMoney = (value, currency = 'USD') => knownNumber(value) ? new Intl.NumberFormat('zh-CN', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(Number(value)) : '—';
  const fmtPercent = value => knownNumber(value) ? `${(Number(value) <= 1 ? Number(value) * 100 : Number(value)).toFixed(1)}%` : '—';
  const statusKind = value => /SUCCESS|FRESH|LIVE|ACTIVE|HEALTHY|READY/i.test(String(value)) ? 'ok' : /FAIL|ERROR|STALE|BLOCKED/i.test(String(value)) ? 'bad' : 'warn';
  const tag = value => `<span class="tag tag-${statusKind(value)}">${esc(value ?? 'UNKNOWN')}</span>`;

  function sumKnown(items, key) {
    const values = items.map(item => item[key]).filter(knownNumber).map(Number);
    return { value: values.length ? values.reduce((total, value) => total + value, 0) : null, coverage: values.length };
  }

  function sourceBar(data, section) {
    const status = data.__source?.source_status || data.source_status || {};
    const sectionStatus = status[section] || status.d1 || 'UNKNOWN';
    const generated = data.generated_at ? new Date(data.generated_at).toLocaleString('zh-CN') : '—';
    return `<div class="source-bar"><span class="source-label">数据状态</span>${tag(sectionStatus)}${tag(data.live_data_verified === true ? 'SEMANTIC VERIFIED' : 'SEMANTIC PENDING')}<span>生成：${esc(generated)}</span><span>只读</span></div>`;
  }

  async function renderProducts({ data, view, setChrome, isCurrent }) {
    setChrome('产品经营中心', '运营 / 产品');
    const products = Array.isArray(data.products) ? data.products : [];
    const sales = sumKnown(products, 'sales');
    const units = sumKnown(products, 'units');
    const spend = sumKnown(products, 'ad_spend');
    const profit = sumKnown(products, 'contribution_profit');
    const live = (data.__source?.source_status || data.source_status || {}).products === 'LIVE_D1_READ';
    if (!isCurrent()) return;
    view.innerHTML = `
      ${sourceBar(data, 'products')}
      <div class="hero">
        <div><div class="hero-eyebrow">PRODUCT OPERATIONS</div><h2>产品经营中心</h2><p>读取 1122-core 中每个产品的最新状态。缺失字段显示为“—”，不会自动转成 0。</p></div>
        <div class="hero-actions"><a class="btn" href="#/operations/inventory-logistics">库存视图</a><a class="btn btn-primary" href="#/operations/ads">广告工作台</a></div>
      </div>
      <div class="grid grid-4 section">
        <div class="card metric-card"><div class="metric-label">产品数</div><div class="metric-value">${live ? products.length : '—'}</div><div class="metric-meta">${live ? `${esc(data.marketplace || 'US')} Marketplace` : '产品读模型本次不可用'}</div></div>
        <div class="card metric-card"><div class="metric-label">最新状态销售额</div><div class="metric-value">${fmtMoney(sales.value)}</div><div class="metric-meta">${live ? `覆盖 ${sales.coverage}/${products.length} · ${fmtNumber(units.value)} units` : '产品读模型本次不可用'}</div></div>
        <div class="card metric-card"><div class="metric-label">广告花费</div><div class="metric-value">${fmtMoney(spend.value)}</div><div class="metric-meta">${live ? `覆盖 ${spend.coverage}/${products.length}` : '产品读模型本次不可用'}</div></div>
        <div class="card metric-card"><div class="metric-label">贡献利润</div><div class="metric-value">${fmtMoney(profit.value)}</div><div class="metric-meta">${live ? `覆盖 ${profit.coverage}/${products.length}` : '产品读模型本次不可用'}</div></div>
      </div>
      <section class="section">
        <div class="section-head"><div><h2>产品最新经营状态</h2><div class="section-sub">Sales / Traffic / Ads / Inventory / Review / Profit</div></div></div>
        <div class="table-wrap">
          <table>
            <caption>${live ? `${products.length} 个产品；每行只显示当前最新状态，不代表完整历史。` : '产品读模型本次不可用。'}</caption>
            <thead><tr>
              <th scope="col">产品 / ASIN</th><th scope="col">日期 / 阶段</th><th scope="col">销售</th><th scope="col">流量 / 转化</th><th scope="col">广告</th><th scope="col">库存</th><th scope="col">Review</th><th scope="col">利润</th><th scope="col">目标</th>
            </tr></thead>
            <tbody>${products.length ? products.map(product => `
              <tr>
                <td><strong>${esc(product.title || product.sku || product.asin || product.product_id)}</strong><div class="item-meta"><a class="route-link" href="#/products/${encodeURIComponent(product.product_id)}">${esc(product.asin || 'NO ASIN')}</a> · ${esc(product.sku || 'NO SKU')}</div></td>
                <td>${esc(product.business_date || '—')}<div class="item-meta">${esc(product.stage || '阶段未定义')}</div></td>
                <td>${fmtMoney(product.sales, product.currency)}<div class="item-meta">${fmtNumber(product.units)} units · ${fmtNumber(product.orders_count)} orders</div></td>
                <td>${fmtNumber(product.sessions)} sessions<div class="item-meta">CVR ${fmtPercent(product.conversion_rate)} · PV ${fmtNumber(product.page_views)}</div></td>
                <td>${fmtMoney(product.ad_spend, product.currency)}<div class="item-meta">ACOS ${fmtPercent(product.acos)} · TACOS ${fmtPercent(product.tacos)}</div></td>
                <td>${fmtNumber(product.fulfillable_inventory)} FBA<div class="item-meta">Inbound ${fmtNumber(product.inbound_inventory)} · ${fmtNumber(product.coverage_days, 1)} days</div></td>
                <td>${knownNumber(product.rating) ? `${fmtNumber(product.rating, 2)} ★` : '—'}<div class="item-meta">${fmtNumber(product.review_count)} reviews</div></td>
                <td>${fmtMoney(product.contribution_profit, product.currency)}<div class="item-meta">Margin ${fmtPercent(product.profit_margin)}</div></td>
                <td>${esc(product.primary_goal || '—')}</td>
              </tr>`).join('') : `<tr><td colspan="9">${live ? 'D1 产品当前确认为 0 条；这不是加载失败。' : '暂无已验证产品数据。'}</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function findProduct(data, route) {
    const raw = route.replace(/^\/products\//, '').replace(/\/policy-impact$/, '');
    return (data.products || []).find(item => String(item.product_id) === decodeURIComponent(raw));
  }

  async function renderProductDetail({ data, route, view, setChrome, isCurrent }) {
    const product = findProduct(data, route);
    setChrome(product?.title || '产品状态卡', '运营 / 产品 / 状态卡');
    if (!isCurrent()) return;
    if (!product) {
      view.innerHTML = '<div class="empty-state"><div class="empty-icon">◌</div><h2>未找到产品</h2><p>该 product_id 不在当前只读结果中。</p><div style="margin-top:16px"><a class="btn" href="#/operations/products">返回产品列表</a></div></div>';
      return;
    }
    view.innerHTML = `
      ${sourceBar(data, 'products')}
      <div class="hero">
        <div><div class="hero-eyebrow">PRODUCT STATE</div><h2>${esc(product.title || product.asin)}</h2><p>${esc(product.asin || '')} · ${esc(product.sku || '')} · ${esc(product.brand || '')} · ${esc(product.fulfillment_channel || '')}</p></div>
        <div class="hero-actions"><a class="btn" href="#/operations/products">返回列表</a><a class="btn btn-primary" href="#/products/${encodeURIComponent(product.product_id)}/policy-impact">政策与方法</a></div>
      </div>
      <div class="grid grid-4 section">
        <div class="card metric-card"><div class="metric-label">销售额</div><div class="metric-value">${fmtMoney(product.sales, product.currency)}</div><div class="metric-meta">${fmtNumber(product.units)} units / ${fmtNumber(product.orders_count)} orders</div></div>
        <div class="card metric-card"><div class="metric-label">流量与转化</div><div class="metric-value">${fmtNumber(product.sessions)}</div><div class="metric-meta">CVR ${fmtPercent(product.conversion_rate)} / ${fmtNumber(product.page_views)} PV</div></div>
        <div class="card metric-card"><div class="metric-label">广告</div><div class="metric-value">${fmtMoney(product.ad_spend, product.currency)}</div><div class="metric-meta">ACOS ${fmtPercent(product.acos)} / TACOS ${fmtPercent(product.tacos)}</div></div>
        <div class="card metric-card"><div class="metric-label">贡献利润</div><div class="metric-value">${fmtMoney(product.contribution_profit, product.currency)}</div><div class="metric-meta">Margin ${fmtPercent(product.profit_margin)}</div></div>
      </div>
      <div class="grid grid-3 section">
        <article class="card"><div class="item-title">当前阶段与目标</div><div class="item-meta">阶段：${esc(product.stage || '未定义')}</div><div class="item-meta">目标：${esc(product.primary_goal || '未定义')}</div><div class="item-meta">Business date：${esc(product.business_date || '—')}</div></article>
        <article class="card"><div class="item-title">库存状态</div><div class="item-meta">FBA 可售：${fmtNumber(product.fulfillable_inventory)}</div><div class="item-meta">Inbound：${fmtNumber(product.inbound_inventory)}</div><div class="item-meta">Coverage：${fmtNumber(product.coverage_days, 1)} days</div></article>
        <article class="card"><div class="item-title">消费者体验</div><div class="item-meta">Rating：${fmtNumber(product.rating, 2)}</div><div class="item-meta">Review：${fmtNumber(product.review_count)}</div><div class="item-meta"><a class="route-link" href="#/amazon-boundary/aom">查看 Review 方法</a></div></article>
      </div>
      <div class="grid grid-3 section">
        <a class="card goal-card" href="#/amazon-boundary/apr"><div class="goal-title">APR 市场模式</div><div class="goal-desc">查看当前市场玩法与边界信号；尚未建立本商品的自动关联。</div></a>
        <a class="card goal-card" href="#/amazon-boundary/aom"><div class="goal-title">AOM 推荐方法</div><div class="goal-desc">从经营目标筛选可用方法；仍需核对适用条件。</div></a>
        <a class="card goal-card" href="#/amazon-boundary/apb"><div class="goal-title">APB 政策证据</div><div class="goal-desc">查看 Amazon Policy / Boundary Evidence。</div></a>
      </div>
    `;
  }

  async function renderPolicyImpact({ data, route, view, setChrome, isCurrent }) {
    const product = findProduct(data, route);
    setChrome('商品政策与方法', '运营 / 产品 / 政策与方法');
    if (!isCurrent()) return;
    if (!product) {
      view.innerHTML = '<div class="empty-state"><h2>未找到产品</h2><p>当前读模型中没有该 product_id。</p></div>';
      return;
    }
    const apr = Array.isArray(data.apr) ? data.apr : [];
    const aom = Array.isArray(data.aom) ? data.aom : [];
    const apb = Array.isArray(data.apb) ? data.apb : [];
    view.innerHTML = `
      <div class="hero"><div><div class="hero-eyebrow">POLICY & METHOD CONTEXT</div><h2>${esc(product.title || product.asin)}</h2><p>当前展示全局 APR / AOM / APB 候选上下文。仓库尚未提供 product_id 级自动关联，因此不会把这些条目冒充为已确认的商品影响。</p></div><div class="hero-actions"><a class="btn" href="#/products/${encodeURIComponent(product.product_id)}">返回状态卡</a></div></div>
      <div class="notice warn section">关联状态：尚未建立商品级证据映射。以下内容需要人工或 Agent 结合商品事实进一步确认。</div>
      <div class="grid grid-3 section">
        <a class="card goal-card" href="#/amazon-boundary/apr"><div class="metric-label">APR 候选</div><div class="metric-value">${apr.length}</div><div class="goal-desc">市场玩法与观察信号</div></a>
        <a class="card goal-card" href="#/amazon-boundary/aom"><div class="metric-label">AOM 候选</div><div class="metric-value">${aom.length}</div><div class="goal-desc">正向经营方法</div></a>
        <a class="card goal-card" href="#/amazon-boundary/apb"><div class="metric-label">APB 记录</div><div class="metric-value">${apb.length}</div><div class="goal-desc">政策与边界证据</div></a>
      </div>
    `;
  }

  async function renderAgents({ data, view, setChrome, isCurrent }) {
    setChrome('Agent 中心', '智能与知识 / Agent');
    const rows = Array.isArray(data.agents) ? data.agents : [];
    const live = (data.__source?.source_status || data.source_status || {}).agents === 'LIVE_D1_READ';
    if (!isCurrent()) return;
    view.innerHTML = `
      ${sourceBar(data, 'agents')}
      <div class="hero"><div><div class="hero-eyebrow">AGENT RUNTIME FACTS</div><h2>Agent 运行状态</h2><p>Agent-1 至 Agent-13 的角色工程保留在 GitHub；这里仅展示已写入 D1 的真实运行组件，不把设计态 Agent 冒充为在线实例。</p></div></div>
      <div class="grid grid-3 section">
        <div class="card metric-card"><div class="metric-label">角色工程</div><div class="metric-value">13</div><div class="metric-meta">Agent-1 至 Agent-13</div></div>
        <div class="card metric-card"><div class="metric-label">运行事实</div><div class="metric-value">${live ? rows.length : '—'}</div><div class="metric-meta">${live ? '当前 D1 返回' : '数据源未确认'}</div></div>
        <div class="card metric-card"><div class="metric-label">执行权限</div><div class="metric-value compact-value">READ ONLY</div><div class="metric-meta">不能绕过 Task / Approval / Permission</div></div>
      </div>
      <section class="section"><div class="section-head"><div><h2>已观察运行组件</h2><div class="section-sub">Status 与 Freshness 分开显示</div></div></div>
        <div class="table-wrap"><table><caption>${live ? `${rows.length} 条 Agent runtime facts。` : 'Agent runtime 数据源未确认。'}</caption><thead><tr><th scope="col">Agent</th><th scope="col">组件</th><th scope="col">状态</th><th scope="col">新鲜度</th><th scope="col">最近成功</th><th scope="col">Runtime</th><th scope="col">更新</th></tr></thead><tbody>
          ${rows.length ? rows.map(item => `<tr><td><strong>${esc(item.agent_id)}</strong></td><td class="code">${esc(item.component)}</td><td>${tag(item.status)}</td><td>${tag(item.freshness_status)}</td><td>${esc(item.last_success_at || '—')}</td><td>${esc(item.runtime_version || '—')}</td><td>${esc(item.updated_at || '—')}</td></tr>`).join('') : `<tr><td colspan="7">${live ? 'D1 Agent runtime facts 当前确认为 0 条。' : '暂无已验证 Agent runtime 数据。'}</td></tr>`}
        </tbody></table></div>
      </section>
    `;
  }

  async function renderTasks({ data, view, setChrome, isCurrent }) {
    setChrome('任务中心', '自动化 / 任务中心');
    const rows = Array.isArray(data.tasks) ? data.tasks : [];
    const pending = rows.filter(item => /pending/i.test(String(item.approval_status || item.task_status))).length;
    const live = (data.__source?.source_status || data.source_status || {}).tasks === 'LIVE_D1_READ';
    if (!isCurrent()) return;
    view.innerHTML = `
      ${sourceBar(data, 'tasks')}
      <div class="hero"><div><div class="hero-eyebrow">CONTROLLED EXECUTION</div><h2>任务中心</h2><p>Decision → TaskDraft → Approval → Permission → Queue → Execute → Outcome。当前 UI 只读。</p></div></div>
      <div class="grid grid-3 section">
        <div class="card metric-card"><div class="metric-label">全部任务</div><div class="metric-value">${live ? rows.length : '—'}</div><div class="metric-meta">${live ? 'D1 实时读取' : '数据源未确认'}</div></div>
        <div class="card metric-card"><div class="metric-label">等待态</div><div class="metric-value">${live ? pending : '—'}</div><div class="metric-meta">pending status / approval</div></div>
        <div class="card metric-card"><div class="metric-label">界面权限</div><div class="metric-value compact-value">READ ONLY</div><div class="metric-meta">UI 不拥有 Executor 权限</div></div>
      </div>
      <section class="section"><div class="table-wrap"><table><caption>${live ? `当前 D1 返回 ${rows.length} 条任务。` : '任务数据源未确认。'}</caption><thead><tr><th scope="col">Task</th><th scope="col">Product</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Approval</th><th scope="col">Updated</th></tr></thead><tbody>
        ${rows.length ? rows.map(item => `<tr><td class="code">${esc(item.task_id)}</td><td>${esc(item.product_id || '—')}</td><td>${esc(item.task_type || '—')}</td><td>${tag(item.task_status)}</td><td>${tag(item.approval_status)}</td><td>${esc(item.updated_at || item.created_at || '—')}</td></tr>`).join('') : `<tr><td colspan="6">${live ? 'D1 tasks 当前确认为 0 条；这不是加载失败。' : '暂无已验证任务数据。'}</td></tr>`}
      </tbody></table></div></section>
    `;
  }

  renderers['/operations'] = renderProducts;
  renderers['/operations/products'] = renderProducts;
  renderers['/products/:product_id'] = renderProductDetail;
  renderers['/products/:product_id/policy-impact'] = renderPolicyImpact;
  renderers['/agents'] = renderAgents;
  renderers['/tasks'] = renderTasks;
})();
