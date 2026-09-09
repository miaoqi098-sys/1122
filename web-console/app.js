(async () => {
  const nav = document.getElementById('primary-nav');
  const view = document.getElementById('view');
  const pageTitle = document.getElementById('page-title');
  const breadcrumb = document.getElementById('breadcrumb');
  const sidebar = document.getElementById('sidebar');
  const search = document.getElementById('global-search');
  const sourceState = document.getElementById('data-source-state');
  const routeStatus = document.getElementById('route-status');
  const menuToggle = document.getElementById('menu-toggle');
  const sidebarClose = document.getElementById('sidebar-close');
  const backdrop = document.getElementById('sidebar-backdrop');
  const topHealth = document.getElementById('top-health');
  const systemDot = document.getElementById('system-dot');
  const safetyState = document.getElementById('system-safety-state');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const statusKind = value => /LIVE|CONNECTED|SUCCESS|READY|FRESH|VERIFIED|ALLOWED|LOW|POSITIVE|CONFIRMED/i.test(String(value)) ? 'ok' : /ERROR|FAIL|BLOCK|STALE|NONCOMPLIANT|HIGH/i.test(String(value)) ? 'bad' : 'warn';
  const tag = value => `<span class="tag tag-${statusKind(value)}">${esc(value ?? 'UNKNOWN')}</span>`;
  const moduleRegistry = window.__1122_REGISTRY__?.modules || [];
  const pageRenderers = window.__1122_PAGE_RENDERERS__ || {};
  let data;
  let renderGeneration = 0;
  let searchGeneration = 0;
  let focusAfterRender = false;

  function loadingPage() {
    return `<div class="loading-shell"><div class="skeleton" style="height:170px"></div><div class="grid grid-4"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div></div></div>`;
  }

  view.innerHTML = loadingPage();
  view.setAttribute('aria-busy', 'true');
  data = await (window.__1122_DATA_READY__ || Promise.resolve(window.__1122_DATA__ || {}));

  function routeInfo() {
    const raw = (location.hash || '#/command-center').replace(/^#/, '') || '/command-center';
    const secondHash = raw.indexOf('#');
    const beforeAnchor = secondHash >= 0 ? raw.slice(0, secondHash) : raw;
    const anchor = secondHash >= 0 ? raw.slice(secondHash + 1) : '';
    const queryIndex = beforeAnchor.indexOf('?');
    const path = queryIndex >= 0 ? beforeAnchor.slice(0, queryIndex) : beforeAnchor;
    const query = queryIndex >= 0 ? new URLSearchParams(beforeAnchor.slice(queryIndex + 1)) : new URLSearchParams();
    return { path: path || '/command-center', anchor, query };
  }

  function setChrome(title, trail) {
    pageTitle.textContent = title;
    breadcrumb.textContent = trail;
    document.title = `${title} · 1122`;
  }

  function updateSourceState() {
    const source = data.__source || { mode: 'SNAPSHOT_FALLBACK', live_data_verified: false };
    const d1 = source.source_status?.d1 || data.source_status?.d1 || 'UNKNOWN';
    sourceState.textContent = `数据源：${source.mode || 'UNKNOWN'} · ${d1}`;
    sourceState.title = `Transport: ${source.endpoint || 'snapshot'} · Semantic: ${data.live_data_verified === true ? 'verified' : 'pending'}`;
    const safe = data.read_only === true && data.production_write_authorized !== true && data.execution_authorized !== true;
    const researchProtected = (window.__1122_REGISTRY__?.connectors || []).some(connector => connector.writeMode === 'protected-research');
    systemDot.className = `dot ${safe ? 'dot-ok' : 'dot-warn'}`;
    safetyState.textContent = safe ? (researchProtected ? '生产只读 / 研究操作受保护' : '只读 / 未授权写入') : '权限状态待确认';
  }

  function stateClass(readiness) {
    if (readiness === 'LIVE_READ' || readiness === 'LIVE_EMPTY') return 'live';
    if (readiness === 'PARTIAL_LIVE') return 'partial';
    return 'design';
  }

  function renderNavChildren(parentId, depth = 1) {
    const children = moduleRegistry.filter(child => child.parent === parentId);
    if (!children.length) return '';
    return `<div class="nav-children nav-depth-group-${depth}">${children.map(child => `<div>
      <a class="nav-child nav-depth-${depth}" href="#${esc(child.route)}" data-route="${esc(child.route)}"><span class="nav-label">${esc(child.label)}</span><span class="nav-state ${stateClass(child.readiness)}" title="${esc(child.readiness || 'UNKNOWN')}"></span></a>
      ${renderNavChildren(child.id, depth + 1)}
    </div>`).join('')}</div>`;
  }

  function renderNav() {
    const groups = [
      ['overview', '总览'],
      ['business', '经营'],
      ['intelligence', '情报与知识'],
      ['automation', '自动化'],
      ['system', '系统']
    ];
    const roots = moduleRegistry.filter(item => !item.parent && item.kind !== 'support');
    nav.innerHTML = groups.map(([groupId, label]) => {
      const items = roots.filter(item => item.nav_group === groupId);
      if (!items.length) return '';
      return `<details class="nav-section" open><summary>${esc(label)}</summary><div class="nav-group">${items.map(item => {
        return `<div><a class="nav-item" href="#${esc(item.route)}" data-route="${esc(item.route)}"><span class="nav-icon" aria-hidden="true">${esc(item.icon || '•')}</span><span class="nav-label">${esc(item.label)}</span><span class="nav-state ${stateClass(item.readiness)}" title="${esc(item.readiness || 'UNKNOWN')}"></span></a>${renderNavChildren(item.id)}</div>`;
      }).join('')}</div></details>`;
    }).join('');
  }

  function setActive() {
    const path = routeInfo().path;
    const links = [...nav.querySelectorAll('[data-route]')];
    const activeLinks = links.filter(link => path === link.dataset.route || path.startsWith(`${link.dataset.route}/`));
    const current = activeLinks.sort((left, right) => right.dataset.route.length - left.dataset.route.length)[0] || null;
    links.forEach(link => {
      const linkRoute = link.dataset.route;
      const active = path === linkRoute || path.startsWith(`${linkRoute}/`);
      link.classList.toggle('active', active);
      if (link === current) link.setAttribute('aria-current', 'page');
      else if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function resolveRenderer(path) {
    if (pageRenderers[path]) return pageRenderers[path];
    if (/^\/products\/[^/]+\/policy-impact$/.test(path)) return pageRenderers['/products/:product_id/policy-impact'];
    if (/^\/products\/[^/]+$/.test(path)) return pageRenderers['/products/:product_id'];
    return null;
  }

  function renderNotFound(path) {
    setChrome('页面未找到', '系统 / 未知路由');
    view.innerHTML = `<div class="empty-state"><div class="empty-icon" aria-hidden="true">◌</div><h2>没有找到这个页面</h2><p>路由 <span class="code">${esc(path)}</span> 未在 Navigation Registry 中登记。</p><div class="toolbar" style="justify-content:center;margin-top:18px"><a class="btn btn-primary" href="#/command-center">返回指挥中心</a><a class="btn" href="#/system/overview">查看系统地图</a></div></div>`;
  }

  async function render() {
    const ticket = ++renderGeneration;
    ++searchGeneration;
    const info = routeInfo();
    setActive();
    view.setAttribute('aria-busy', 'true');
    view.innerHTML = loadingPage();
    const renderer = resolveRenderer(info.path);
    const isCurrent = () => ticket === renderGeneration && routeInfo().path === info.path;
    try {
      if (renderer) {
        await renderer({ data, route: info.path, query: info.query, anchor: info.anchor, view, setChrome, isCurrent });
      } else {
        renderNotFound(info.path);
      }
      if (!isCurrent()) return;
      view.setAttribute('aria-busy', 'false');
      routeStatus.textContent = `${pageTitle.textContent} 已加载`;
      if (focusAfterRender) {
        focusAfterRender = false;
        pageTitle.focus({ preventScroll: true });
      }
      if (info.anchor) requestAnimationFrame(() => document.getElementById(info.anchor)?.scrollIntoView({ block: 'start' }));
    } catch (error) {
      if (!isCurrent()) return;
      setChrome('页面加载失败', '系统 / 错误');
      view.setAttribute('aria-busy', 'false');
      view.innerHTML = `<div class="notice bad"><strong>页面未能完成加载：</strong>${esc(error?.message || 'UNKNOWN_ERROR')} <button id="route-retry" class="btn btn-quiet" type="button">重试</button></div>`;
      document.getElementById('route-retry')?.addEventListener('click', render);
    }
  }

  function closeDrawer({ restoreFocus = false } = {}) {
    sidebar.classList.remove('open');
    backdrop.classList.remove('visible');
    document.body.classList.remove('nav-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) menuToggle.focus();
  }

  function openDrawer() {
    sidebar.classList.add('open');
    backdrop.classList.add('visible');
    document.body.classList.add('nav-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    sidebar.querySelector('a,button')?.focus();
  }

  function updateHealth(values) {
    if (!Array.isArray(values) || !values.length) return;
    const healthy = values.filter(item => ['LIVE', 'CONNECTED'].includes(item.status)).length;
    const needsAttention = values.length - healthy;
    topHealth.className = `health-pill ${needsAttention === 0 ? 'health-ok' : healthy > 0 ? 'health-warn' : 'health-bad'}`;
    topHealth.querySelector('span:last-child').textContent = needsAttention ? `${healthy} 正常 · ${needsAttention} 待办` : `${healthy} 个连接正常`;
    topHealth.title = values.map(item => `${window.__1122_CONNECTORS__.registry[item.connector_id]?.label || item.connector_id}: ${item.status}`).join('\n');
  }

  async function refreshTopHealth() {
    const ids = Object.keys(window.__1122_CONNECTORS__?.registry || {});
    const values = await Promise.all(ids.map(id => window.__1122_CONNECTORS__.read(id)));
    updateHealth(values);
  }

  function localSearchRows(query) {
    const text = query.toLowerCase();
    const rows = [];
    moduleRegistry.forEach(item => {
      if (`${item.label} ${item.summary} ${item.id} ${item.route}`.toLowerCase().includes(text)) rows.push({ type: '模块', title: item.label, meta: item.summary, route: item.route });
    });
    (data.products || []).forEach(item => {
      if (`${item.title} ${item.asin} ${item.sku} ${item.brand}`.toLowerCase().includes(text)) rows.push({ type: '产品', title: item.title || item.asin, meta: `${item.asin || ''} · ${item.sku || ''}`, route: `/products/${encodeURIComponent(item.product_id)}` });
    });
    (data.apr || []).forEach(item => {
      if (JSON.stringify(item).toLowerCase().includes(text)) rows.push({ type: 'APR', title: item.pattern_name_cn || item.apr_id, meta: item.business_goal || item.apr_id, route: '/amazon-boundary/apr' });
    });
    (data.aom || []).forEach(item => {
      if (JSON.stringify(item).toLowerCase().includes(text)) rows.push({ type: 'AOM', title: item.method_name_cn || item.method_id, meta: item.objective || item.method_id, route: '/amazon-boundary/aom' });
    });
    (data.apb || []).forEach(item => {
      if (JSON.stringify(item).toLowerCase().includes(text)) rows.push({ type: 'APB', title: item.title_cn || item.case_id, meta: item.domain || item.case_id, route: '/amazon-boundary/apb' });
    });
    return rows;
  }

  async function runSearch(query) {
    const ticket = ++searchGeneration;
    ++renderGeneration;
    setChrome('全局搜索', `搜索 / ${query}`);
    view.setAttribute('aria-busy', 'true');
    view.innerHTML = `<div class="hero"><div><div class="hero-eyebrow">GLOBAL SEARCH</div><h2>正在搜索“${esc(query)}”</h2><p>同时检索模块、产品、APR、AOM、APB 与知识库。</p></div></div>${loadingPage()}`;
    const rows = localSearchRows(query);
    let knowledgeError = null;
    if (query.length >= 2) {
      try {
        const params = new URLSearchParams({ q: query, limit: '20' });
        const payload = await window.__1122_FETCH_JSON__(`https://1122-data-layer.zhangshuaibing01.workers.dev/api/v1/knowledge/search?${params}`, {
          timeoutMs: 5500,
          retries: 1,
          validate: value => value && Number.isInteger(value.total) && Array.isArray(value.items)
        });
        payload.items.forEach(item => rows.push({ type: '知识', title: item.title, meta: item.summary || item.knowledge_id, route: '/knowledge' }));
      } catch (error) {
        knowledgeError = error;
      }
    }
    if (ticket !== searchGeneration || search.value.trim() !== query) return;
    view.setAttribute('aria-busy', 'false');
    view.innerHTML = `
      <div class="hero"><div><div class="hero-eyebrow">GLOBAL SEARCH</div><h2>“${esc(query)}”的搜索结果</h2><p>模块、产品、边界情报和知识库使用同一个入口；点击结果进入对应只读页面。</p></div><div class="hero-actions"><button id="search-clear" class="btn" type="button">清除搜索</button></div></div>
      <section class="section"><div class="section-head"><div><h2>匹配结果</h2><div class="section-sub">${rows.length} 条${knowledgeError ? ' · 知识 API 本次不可用' : ''}</div></div></div>
        <div class="card list">${rows.length ? rows.slice(0, 100).map(item => `<a class="list-item goal-card" href="#${esc(item.route)}"><div class="split-title"><div class="item-title">${esc(item.title)}</div>${tag(item.type)}</div><div class="item-meta">${esc(item.meta || '')}</div></a>`).join('') : '<div class="empty-state compact-empty"><h3>没有匹配结果</h3><p>尝试 ASIN、产品名、模块名或业务关键词。</p></div>'}</div>
      </section>
      ${knowledgeError ? `<div class="notice warn section">知识库检索本次失败：${esc(knowledgeError.message)}；其他本地读模型结果仍可使用。</div>` : ''}
    `;
    document.getElementById('search-clear')?.addEventListener('click', () => { search.value = ''; render(); search.focus(); });
    routeStatus.textContent = `搜索完成，共 ${rows.length} 条结果`;
  }

  let searchTimer;
  search.addEventListener('input', event => {
    clearTimeout(searchTimer);
    const query = event.target.value.trim();
    if (!query) {
      render();
      return;
    }
    searchTimer = setTimeout(() => runSearch(query), 220);
  });
  search.addEventListener('keydown', event => {
    if (event.key === 'Escape' && search.value) {
      search.value = '';
      render();
    }
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      search.focus();
      search.select();
    }
    if (event.key === 'Escape' && sidebar.classList.contains('open')) closeDrawer({ restoreFocus: true });
  });

  menuToggle.addEventListener('click', () => sidebar.classList.contains('open') ? closeDrawer({ restoreFocus: true }) : openDrawer());
  sidebarClose.addEventListener('click', () => closeDrawer({ restoreFocus: true }));
  backdrop.addEventListener('click', () => closeDrawer({ restoreFocus: true }));
  nav.addEventListener('click', event => { if (event.target.closest('a')) closeDrawer(); });
  window.addEventListener('hashchange', () => {
    clearTimeout(searchTimer);
    search.value = '';
    focusAfterRender = true;
    closeDrawer();
    render();
  });
  window.addEventListener('1122:connector-health', event => updateHealth(event.detail));

  renderNav();
  updateSourceState();
  window.__1122_RENDER__ = render;
  await render();
  refreshTopHealth();
})();
