(() => {
  const renderers = window.__1122_PAGE_RENDERERS__ ||= {};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const kindFor = value => /VERIFIED|ALLOWED|LOW|POSITIVE|CONFIRMED|SUCCESS|LIVE/i.test(String(value)) ? 'ok' : /NONCOMPLIANT|HIGH|BLOCK|FAILED|ERROR/i.test(String(value)) ? 'bad' : /SEEDED|DISCOVERY|MEDIUM|UNKNOWN|CONDITIONAL|SNAPSHOT/i.test(String(value)) ? 'warn' : 'info';
  const tag = value => `<span class="tag tag-${kindFor(value)}">${esc(value ?? 'UNKNOWN')}</span>`;

  function sourceBar(data, section) {
    const status = data.__source?.source_status || data.source_status || {};
    return `<div class="source-bar"><span class="source-label">边界读模型</span>${tag(status[section] || 'UNKNOWN')}${tag(data.live_data_verified === true ? 'SEMANTIC VERIFIED' : 'SEMANTIC PENDING')}<span>非执行参考层</span></div>`;
  }

  function hero(eyebrow, title, description) {
    return `<div class="hero"><div><div class="hero-eyebrow">${eyebrow}</div><h2>${title}</h2><p>${description}</p></div><div class="hero-actions"><a class="btn" href="#/amazon-boundary">三层总览</a><a class="btn" href="#/knowledge">知识检索</a></div></div>`;
  }

  async function renderApr({ data, view, setChrome, isCurrent }) {
    setChrome('APR 市场玩法探索', '情报 / 亚马逊经营边界 / APR');
    const rows = Array.isArray(data.apr) ? data.apr : [];
    if (!isCurrent()) return;
    view.innerHTML = `
      ${sourceBar(data, 'apr')}
      ${hero('APR · MARKET PATTERN', 'Amazon 真实市场玩法雷达', '记录市场上发生了什么、可能为什么有效、持续多久、如何识别以及对我方的价值。APR 不直接产生 Amazon 或 Ads 写权限。')}
      <section class="card section">
        <div class="section-head"><div><h2>筛选探索结果</h2><div class="section-sub">名称、目标、领域或信号</div></div><span id="apr-visible" class="tag tag-info">${rows.length} 条</span></div>
        <label><span class="field-label">关键词</span><input id="apr-filter" class="field" type="search" placeholder="例如 Review / 流量 / 排名" /></label>
      </section>
      <section class="section"><div id="apr-table"></div></section>
      <div class="notice warn section">Observed ≠ Confirmed。APR 可记录合规、条件允许、未知或非合规市场现象，但永远不直接形成生产执行权。</div>
    `;
    const target = document.getElementById('apr-table');
    const count = document.getElementById('apr-visible');
    const filter = document.getElementById('apr-filter');
    function draw() {
      const query = filter.value.trim().toLowerCase();
      const visible = rows.filter(item => JSON.stringify(item).toLowerCase().includes(query));
      count.textContent = `${visible.length} 条`;
      target.innerHTML = `<div class="table-wrap"><table><caption>APR 当前显示 ${visible.length} / ${rows.length} 条。</caption><thead><tr><th scope="col">APR</th><th scope="col">域</th><th scope="col">玩法 / 模式</th><th scope="col">经营目标</th><th scope="col">观察效果</th><th scope="col">Policy</th><th scope="col">Value</th><th scope="col">Confidence</th></tr></thead><tbody>${visible.length ? visible.map(item => `<tr><td class="code">${esc(item.apr_id)}</td><td>${esc(item.domain)}</td><td><strong>${esc(item.pattern_name_cn)}</strong><div class="item-meta">${esc((item.detection_signals || []).slice(0, 2).join(' · '))}</div></td><td>${esc(item.business_goal)}</td><td>${esc(item.observed_effect)}</td><td>${tag(item.policy_relation)}</td><td>${tag(item.business_value_signal)}</td><td>${tag(item.confidence)}</td></tr>`).join('') : '<tr><td colspan="8">没有匹配结果。</td></tr>'}</tbody></table></div>`;
    }
    filter.addEventListener('input', draw);
    draw();
  }

  async function renderAom({ data, view, setChrome, isCurrent }) {
    setChrome('AOM 正向运营方法', '情报 / 亚马逊经营边界 / AOM');
    const rows = Array.isArray(data.aom) ? data.aom : [];
    if (!isCurrent()) return;
    view.innerHTML = `
      ${sourceBar(data, 'aom')}
      ${hero('AOM · OPERATING METHOD', '从经营目标出发选择正向方法', '每条方法保留目标、条件、预期影响、衡量指标、政策状态与风险。页面提供候选，不自动授权执行。')}
      <section class="card section"><div class="section-head"><div><h2>筛选方法</h2><div class="section-sub">方法名称、目标或衡量指标</div></div><span id="aom-visible" class="tag tag-info">${rows.length} 条</span></div><label><span class="field-label">关键词</span><input id="aom-filter" class="field" type="search" placeholder="例如 Review / 转化 / 广告" /></label></section>
      <section id="aom-grid" class="grid grid-3 section"></section>
    `;
    const target = document.getElementById('aom-grid');
    const count = document.getElementById('aom-visible');
    const filter = document.getElementById('aom-filter');
    function draw() {
      const query = filter.value.trim().toLowerCase();
      const visible = rows.filter(item => JSON.stringify(item).toLowerCase().includes(query));
      count.textContent = `${visible.length} 条`;
      target.innerHTML = visible.length ? visible.map(item => `
        <article class="card"><div class="code muted">${esc(item.method_id)}</div><div class="item-title" style="margin-top:8px">${esc(item.method_name_cn)}</div><div class="item-meta">${esc(item.objective)}</div><p class="compact">${esc(item.impact)}</p><div class="kpi-row">${tag(item.policy_status)}${tag(`Risk ${item.risk_level}`)}</div><div class="item-meta" style="margin-top:12px">衡量：${esc((item.measurement || []).join(' · '))}</div></article>`).join('') : '<div class="card empty-state compact-empty"><h3>没有匹配方法</h3><p>调整关键词后重试。</p></div>';
    }
    filter.addEventListener('input', draw);
    draw();
  }

  async function renderApb({ data, view, setChrome, isCurrent }) {
    setChrome('APB 政策与边界证据', '情报 / 亚马逊经营边界 / APB');
    const rows = Array.isArray(data.apb) ? data.apb : [];
    const domains = Array.isArray(data.domains) ? data.domains : [];
    if (!isCurrent()) return;
    view.innerHTML = `
      ${sourceBar(data, 'apb')}
      ${hero('APB · POLICY EVIDENCE', '政策证据、Expected State 与 Observed State', 'APB 管理官方证据、Policy Diff、边界信号与商品影响。它负责证据与边界，不是运营方法首页。')}
      <div class="grid grid-4 section">${domains.map(domain => `<article class="card"><div class="code">APB-${esc(domain[0])}</div><div class="item-title" style="margin-top:7px">${esc(domain[2])}</div><div class="item-meta">${esc(domain[1])}</div><div style="margin-top:10px">${tag(domain[3])}</div></article>`).join('')}</div>
      <section class="section"><div class="section-head"><div><h2>当前政策与边界记录</h2><div class="section-sub">${rows.length} 条</div></div></div><div class="table-wrap"><table><caption>APB 记录按当前仓库 / D1 读模型展示。</caption><thead><tr><th scope="col">编号</th><th scope="col">域</th><th scope="col">类型</th><th scope="col">状态</th><th scope="col">标题</th><th scope="col">Confidence</th></tr></thead><tbody>${rows.length ? rows.map(item => `<tr><td class="code">${esc(item.case_id)}</td><td>${esc(item.domain)}</td><td>${esc(item.result_type)}</td><td>${tag(item.status)}</td><td>${esc(item.title_cn)}</td><td>${tag(item.confidence)}</td></tr>`).join('') : '<tr><td colspan="6">当前没有 APB 记录。</td></tr>'}</tbody></table></div></section>
    `;
  }

  renderers['/amazon-boundary/apr'] = renderApr;
  renderers['/amazon-boundary/aom'] = renderAom;
  renderers['/amazon-boundary/apb'] = renderApb;
})();
