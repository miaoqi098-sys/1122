(() => {
  const renderers = window.__1122_PAGE_RENDERERS__ ||= {};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const knownNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const fmtNumber = (value, digits = 0) => knownNumber(value) ? Number(value).toLocaleString('zh-CN', { maximumFractionDigits: digits }) : '—';
  const fmtMoney = value => knownNumber(value) ? `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const fmtPercent = value => knownNumber(value) ? `${(Number(value) <= 1 ? Number(value) * 100 : Number(value)).toFixed(1)}%` : '—';
  const stateKind = value => /LIVE|SUCCESS|FRESH|CONNECTED|CONFIRMED|VALIDATED/i.test(String(value)) ? 'ok' : /ERROR|FAIL|BLOCK|STALE|NONCOMPLIANT/i.test(String(value)) ? 'bad' : 'warn';
  const tag = value => `<span class="tag tag-${stateKind(value)}">${esc(value ?? 'UNKNOWN')}</span>`;

  function sumKnown(items, key) {
    const values = items.map(item => item[key]).filter(knownNumber).map(Number);
    return { value: values.length ? values.reduce((total, value) => total + value, 0) : null, coverage: values.length };
  }

  function sourceBar(data) {
    const source = data.__source || {};
    const status = source.source_status || data.source_status || {};
    const generated = data.generated_at ? new Date(data.generated_at).toLocaleString('zh-CN') : '—';
    return `<div class="source-bar">
      <span class="source-label">当前读模型</span>
      ${tag(source.mode || 'UNKNOWN')}
      ${tag(status.d1 || 'D1 UNKNOWN')}
      ${tag(data.live_data_verified === true ? 'SEMANTIC VERIFIED' : 'SEMANTIC PENDING')}
      <span>生成：${esc(generated)}</span>
    </div>`;
  }

  async function renderHome({ data, view, setChrome, isCurrent }) {
    setChrome('经营指挥中心', '首页 / 经营指挥中心');
    const products = Array.isArray(data.products) ? data.products : [];
    const agents = Array.isArray(data.agents) ? data.agents : [];
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    const apr = Array.isArray(data.apr) ? data.apr : [];
    const aom = Array.isArray(data.aom) ? data.aom : [];
    const apb = Array.isArray(data.apb) ? data.apb : [];
    const sales = sumKnown(products, 'sales');
    const units = sumKnown(products, 'units');
    const spend = sumKnown(products, 'ad_spend');
    const profit = sumKnown(products, 'contribution_profit');
    const sessions = sumKnown(products, 'sessions');
    const orders = sumKnown(products, 'orders_count');
    const conversion = knownNumber(sessions.value) && sessions.value > 0 && knownNumber(orders.value) ? orders.value / sessions.value : null;
    const pending = tasks.filter(item => /pending/i.test(String(item.approval_status || item.task_status))).length;
    const reviewRows = products.filter(item => knownNumber(item.review_count)).sort((a, b) => Number(a.review_count) - Number(b.review_count)).slice(0, 5);
    const spendRows = products.filter(item => knownNumber(item.ad_spend)).sort((a, b) => Number(b.ad_spend) - Number(a.ad_spend)).slice(0, 5);
    const sourceStatus = data.__source?.source_status || data.source_status || {};
    const productsKnown = sourceStatus.products === 'LIVE_D1_READ';
    const agentsKnown = sourceStatus.agents === 'LIVE_D1_READ';

    if (!isCurrent()) return;
    view.innerHTML = `
      ${sourceBar(data)}
      <div class="hero">
        <div>
          <div class="hero-eyebrow">OPERATIONS COMMAND CENTER</div>
          <h2>从真实经营事实进入今天的工作</h2>
          <p>首页只聚合当前可验证的产品、Agent、任务与知识读模型。连接在线、D1 读取成功、数据新鲜和业务语义验证会分开显示。</p>
        </div>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#/operations/products">${productsKnown ? `查看 ${products.length} 个产品` : '打开产品中心'}</a>
          <a class="btn" href="#/operations/ads">广告工作台</a>
          <a class="btn" href="#/system/overview">系统地图</a>
        </div>
      </div>

      <div class="grid grid-4 section">
        <div class="card metric-card">
          <div class="metric-label">产品最新状态销售额</div>
          <div class="metric-value">${fmtMoney(sales.value)}</div>
          <div class="metric-meta">${productsKnown ? `覆盖 ${sales.coverage}/${products.length} 个产品 · ${fmtNumber(units.value)} units` : '产品读模型本次不可用'}</div>
        </div>
        <div class="card metric-card">
          <div class="metric-label">广告花费</div>
          <div class="metric-value">${fmtMoney(spend.value)}</div>
          <div class="metric-meta">${productsKnown ? `覆盖 ${spend.coverage}/${products.length} 个产品 · 组合 CVR ${fmtPercent(conversion)}` : '产品读模型本次不可用'}</div>
        </div>
        <div class="card metric-card">
          <div class="metric-label">贡献利润</div>
          <div class="metric-value">${fmtMoney(profit.value)}</div>
          <div class="metric-meta">${productsKnown ? `覆盖 ${profit.coverage}/${products.length} 个产品` : '产品读模型本次不可用'}</div>
        </div>
        <div class="card metric-card">
          <div class="metric-label">需要人工处理</div>
          <div class="metric-value">${sourceStatus.tasks === 'LIVE_D1_READ' ? pending : '—'}</div>
          <div class="metric-meta">任务总数 ${sourceStatus.tasks === 'LIVE_D1_READ' ? tasks.length : '未知'} · UI 无执行权限</div>
        </div>
      </div>

      <div class="grid grid-3 section" id="human-tasks">
        <article class="card">
          <div class="section-head"><div><h2>Agent 运行事实</h2><div class="section-sub">只统计写入 D1 的运行组件</div></div>${tag(sourceStatus.agents || 'UNKNOWN')}</div>
          <div class="metric-value">${agentsKnown ? agents.length : '—'}</div>
          <div class="item-meta">Agent-1 至 Agent-13 的角色工程已存在；${agentsKnown ? `当前 ${agents.length} 个 runtime facts 可被真实读取。` : '本次未能验证 D1 runtime facts。'}</div>
          <div style="margin-top:12px"><a class="route-link" href="#/agents">查看运行状态 →</a></div>
        </article>
        <article class="card">
          <div class="section-head"><div><h2>Amazon 边界情报</h2><div class="section-sub">APR / AOM / APB 分层</div></div>${tag(sourceStatus.apr || 'UNKNOWN')}</div>
          <div class="kpi-row">${tag(`APR ${apr.length}`)}${tag(`AOM ${aom.length}`)}${tag(`APB ${apb.length}`)}</div>
          <div class="item-meta" style="margin-top:12px">读入 D1 不等于语义已最终验证；当前整包标记为 ${data.live_data_verified === true ? 'verified' : 'pending'}。</div>
        </article>
        <article class="card">
          <div class="section-head"><div><h2>连接与基础设施</h2><div class="section-sub">实时状态进入连接中心</div></div></div>
          <div class="item-title">Cloudflare / SP-API / Ads / SIF</div>
          <div class="item-meta">连接器状态独立检查；Email 未配置时会明确显示 AUTH_REQUIRED。</div>
          <div style="margin-top:12px"><a class="route-link" href="#/connectors">打开连接中心 →</a></div>
        </article>
      </div>

      <div class="grid grid-2 section" id="agent-activity">
        <article class="card">
          <div class="section-head"><div><h2>Review 数量观察</h2><div class="section-sub">仅按当前 Review 数升序，不自动判定风险</div></div><a class="route-link" href="#/amazon-boundary/aom">Review 方法 →</a></div>
          <div class="list">${reviewRows.length ? reviewRows.map(product => `
            <div class="list-item">
              <div class="item-title"><a class="route-link" href="#/products/${encodeURIComponent(product.product_id)}">${esc(product.title || product.asin)}</a></div>
              <div class="item-meta">${esc(product.asin || '')} · ${fmtNumber(product.review_count)} reviews · Rating ${fmtNumber(product.rating, 2)}</div>
            </div>`).join('') : `<div class="empty-state compact-empty"><p>${productsKnown ? '当前产品中没有可验证 Review 数据' : '产品读模型本次不可用'}</p></div>`}</div>
        </article>
        <article class="card">
          <div class="section-head"><div><h2>广告花费观察</h2><div class="section-sub">仅按当前花费排序</div></div><a class="route-link" href="#/operations/ads">广告工作台 →</a></div>
          <div class="list">${spendRows.length ? spendRows.map(product => `
            <div class="list-item">
              <div class="item-title"><a class="route-link" href="#/products/${encodeURIComponent(product.product_id)}">${esc(product.title || product.asin)}</a></div>
              <div class="item-meta">Spend ${fmtMoney(product.ad_spend)} · Sales ${fmtMoney(product.sales)} · ACOS ${fmtPercent(product.acos)} · TACOS ${fmtPercent(product.tacos)}</div>
            </div>`).join('') : `<div class="empty-state compact-empty"><p>${productsKnown ? '当前产品中没有可验证广告花费数据' : '产品读模型本次不可用'}</p></div>`}</div>
        </article>
      </div>

      <div class="grid grid-4 section">
        <a class="card goal-card" href="#/amazon-boundary/apr"><div class="goal-icon" aria-hidden="true">◎</div><div class="goal-title">APR 最新探索</div><div class="goal-desc">${apr.length} 条市场观察；描述发生了什么，不授予执行权。</div></a>
        <a class="card goal-card" href="#/amazon-boundary/aom"><div class="goal-icon" aria-hidden="true">◇</div><div class="goal-title">AOM 正向方法</div><div class="goal-desc">${aom.length} 条方法；按经营目标与适用条件判断。</div></a>
        <a class="card goal-card" href="#/amazon-boundary/apb"><div class="goal-icon" aria-hidden="true">⌘</div><div class="goal-title">APB 政策证据</div><div class="goal-desc">${apb.length} 条记录；保留来源、状态与置信度。</div></a>
        <a class="card goal-card" href="#/knowledge"><div class="goal-icon" aria-hidden="true">◫</div><div class="goal-title">知识中心</div><div class="goal-desc">${data.knowledge?.total ?? '—'} 条可检索知识；Knowledge ≠ Permission。</div></a>
      </div>
    `;
  }

  renderers['/'] = renderHome;
  renderers['/command-center'] = renderHome;
})();
