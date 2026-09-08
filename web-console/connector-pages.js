(() => {
  const renderers = window.__1122_PAGE_RENDERERS__ ||= {};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const fmtTime = value => value ? new Date(value).toLocaleString('zh-CN') : '—';
  const statusKind = value => /LIVE|CONNECTED/i.test(String(value)) ? 'ok' : /AUTH_REQUIRED|DEGRADED|FALLBACK/i.test(String(value)) ? 'warn' : 'bad';
  const tag = value => `<span class="tag tag-${statusKind(value)}">${esc(value ?? 'UNKNOWN')}</span>`;

  function detail(item) {
    const value = item.details || {};
    switch (item.connector_id) {
      case 'cloudflare':
        return {
          primary: `${value.zone?.name || 'Zone 未识别'} · ${value.pages?.projectName || 'Pages 未识别'}`,
          secondary: `DNS ${value.dns?.recordCount ?? '—'} · R2 凭据 ${value.r2?.credentialsConfigured ? '已配置' : '未配置/未知'}`
        };
      case 'amazon-sp-api':
        return { primary: `${value.marketplace_count ?? '—'} Marketplaces · ${value.product_count ?? '—'} Products`, secondary: `${value.region || '—'} · Product identity ${value.product_ready ? 'READY' : 'UNKNOWN'}` };
      case 'amazon-ads':
        return { primary: `${value.profiles_count ?? '—'} Profiles · ${value.region || 'NA'}`, secondary: (item.capabilities || []).join(' · ') || 'OAuth' };
      case 'sif':
        return { primary: `${value.tool_count ?? '—'} tools · ${value.marketplace || '—'}`, secondary: `${value.server || 'SIF'} · D1 ${value.d1_bound ? 'bound' : 'unknown'}` };
      case 'email':
        return { primary: item.error?.message || '邮箱状态未知', secondary: 'Worker 在线与邮箱授权分开判断' };
      default:
        return { primary: item.error?.message || value.mode || value.service || '状态详情未配置', secondary: '无公开健康端点时按降级处理' };
    }
  }

  function connectorCard(item) {
    const config = window.__1122_CONNECTORS__.registry[item.connector_id] || {};
    const value = detail(item);
    const action = config.route && config.route !== '/connectors' ? `<a class="btn" href="#${esc(config.route)}">查看详情</a>` : '';
    return `<article class="card catalog-card">
      <div class="split-title"><div class="item-title">${esc(config.label || item.connector_id)}</div>${tag(item.status)}</div>
      <div class="catalog-summary"><strong class="strong">${esc(value.primary)}</strong><div class="item-meta">${esc(value.secondary)}</div></div>
      <div class="capability-list">${(item.capabilities || []).slice(0, 5).map(value => `<span class="capability">${esc(value)}</span>`).join('') || '<span class="capability">健康检查</span>'}</div>
      <div class="catalog-foot"><span class="item-meta">${fmtTime(item.checked_at)} · ${item.latency_ms ?? '—'} ms</span>${action}</div>
    </article>`;
  }

  async function renderConnectors({ view, setChrome, isCurrent }) {
    setChrome('对外连接', '系统 / 对外连接');
    const ids = Object.keys(window.__1122_CONNECTORS__?.registry || {});
    view.innerHTML = `
      <div class="hero">
        <div><div class="hero-eyebrow">CONNECTOR CONTROL PLANE</div><h2>连接在线，不等于业务数据已验证</h2><p>所有连接并行进行有时限的只读检查。Worker 在线、完成授权、数据新鲜和语义验证分别呈现；不会读取或显示 Secret。</p></div>
        <div class="hero-actions"><button id="connector-refresh" class="btn btn-primary" type="button">重新检查</button><a class="btn" href="#/system/overview">系统地图</a></div>
      </div>
      <div id="connector-summary" class="grid grid-4 section">
        <div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>
      </div>
      <section class="section"><div class="section-head"><div><h2>已登记连接器</h2><div class="section-sub">${ids.length} 个；未知或未配置时 fail-closed</div></div></div><div id="connector-grid" class="grid grid-3"><div class="card"><div class="skeleton skeleton-line"></div></div><div class="card"><div class="skeleton skeleton-line"></div></div><div class="card"><div class="skeleton skeleton-line"></div></div></div></section>
      <div class="notice warn section"><strong>安全边界：</strong>CORS allow-list 不是用户登录。当前读取接口仍需 Cloudflare Access 或等价会话鉴权，才能作为正式内部经营控制台的访问门槛。</div>
    `;

    let generation = 0;
    async function refresh() {
      const current = ++generation;
      const button = document.getElementById('connector-refresh');
      if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
      const values = await Promise.all(ids.map(id => window.__1122_CONNECTORS__.read(id)));
      if (current !== generation || !isCurrent()) return;
      const connected = values.filter(item => ['LIVE', 'CONNECTED'].includes(item.status)).length;
      const auth = values.filter(item => item.status === 'AUTH_REQUIRED').length;
      const degraded = values.filter(item => ['DEGRADED', 'FALLBACK'].includes(item.status)).length;
      const errors = values.filter(item => item.status === 'ERROR').length;
      const summary = document.getElementById('connector-summary');
      const grid = document.getElementById('connector-grid');
      if (summary) summary.innerHTML = `
        <div class="card metric-card"><div class="metric-label">已连接 / 在线</div><div class="metric-value">${connected}</div><div class="metric-meta">共 ${values.length} 个登记连接器</div></div>
        <div class="card metric-card"><div class="metric-label">需要配置</div><div class="metric-value">${auth}</div><div class="metric-meta">当前为 Email Bridge</div></div>
        <div class="card metric-card"><div class="metric-label">降级</div><div class="metric-value">${degraded}</div><div class="metric-meta">含无公共健康端点</div></div>
        <div class="card metric-card"><div class="metric-label">错误</div><div class="metric-value">${errors}</div><div class="metric-meta">网络或响应格式失败</div></div>`;
      if (grid) grid.innerHTML = values.map(connectorCard).join('');
      if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
      window.dispatchEvent(new CustomEvent('1122:connector-health', { detail: values }));
    }

    document.getElementById('connector-refresh')?.addEventListener('click', refresh);
    refresh();
  }

  renderers['/connectors'] = renderConnectors;
})();
