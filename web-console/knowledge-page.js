(() => {
  const renderers = window.__1122_PAGE_RENDERERS__ ||= {};
  const API = 'https://1122-data-layer.zhangshuaibing01.workers.dev/api/v1/knowledge/search';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const statusKind = value => /CONFIRMED|VALIDATED|HIGH|FRESH|ACTIVE|LIVE/i.test(String(value)) ? 'ok' : /CONFLICT|STALE|LOW|ERROR/i.test(String(value)) ? 'bad' : 'warn';
  const badge = value => `<span class="tag tag-${statusKind(value)}">${esc(value || 'UNKNOWN')}</span>`;
  const types = [
    ['', '全部类型'], ['POLICY', '政策知识'], ['OPERATING_METHOD', '运营方法'], ['MARKET_PATTERN', '市场玩法'],
    ['PRODUCT_KNOWLEDGE', '产品经营'], ['ADVERTISING_KNOWLEDGE', '广告'], ['PRICING_KNOWLEDGE', '价格促销'],
    ['CONTENT_KNOWLEDGE', 'Listing 内容'], ['CASE_LESSON', '案例复盘'], ['SYSTEM_ENGINEERING', '系统工程'],
    ['DATA_DEFINITION', '数据定义'], ['DECISION_RULE', '决策规则']
  ];
  const truths = [['', '全部真值'], ['CONFIRMED', 'CONFIRMED'], ['VALIDATED', 'VALIDATED'], ['DERIVED', 'DERIVED'], ['OBSERVED', 'OBSERVED'], ['SOURCE_ONLY', 'SOURCE_ONLY'], ['CONFLICTING', 'CONFLICTING'], ['UNKNOWN', 'UNKNOWN']];

  async function query(filters = {}) {
    const params = new URLSearchParams({ limit: '100' });
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    return window.__1122_FETCH_JSON__(`${API}?${params}`, {
      timeoutMs: 6500,
      retries: 1,
      validate: payload => payload && Number.isInteger(payload.total) && Array.isArray(payload.items)
    });
  }

  function card(item) {
    return `<article class="card">
      <div class="section-head">
        <div><div class="code">${esc(item.knowledge_id)} · v${esc(item.version)}</div><h3 style="margin-top:6px">${esc(item.title)}</h3></div>
        <div>${badge(item.truth_class)}</div>
      </div>
      <p class="item-meta" style="font-size:12px;line-height:1.65">${esc(item.summary)}</p>
      <div class="kpi-row" style="margin:12px 0">${badge(item.knowledge_type)}${badge(item.domain)}${badge(item.confidence)}${badge(item.freshness_status)}</div>
      <div class="item-meta">${esc(item.content)}</div>
      ${item.keywords?.length ? `<div class="item-meta" style="margin-top:12px">关键词：${item.keywords.map(esc).join(' · ')}</div>` : ''}
      ${item.source_refs?.length ? `<div class="item-meta" style="margin-top:8px">来源：${item.source_refs.map(value => `<span class="code">${esc(value)}</span>`).join(' · ')}</div>` : ''}
      <div class="item-meta" style="margin-top:8px">Last verified: ${esc(item.last_verified_at || '—')} · Status: ${esc(item.status)}</div>
    </article>`;
  }

  async function renderKnowledge({ data, view, setChrome, isCurrent }) {
    setChrome('知识中心', '智能与知识 / Knowledge Base');
    const stats = data.knowledge || {};
    if (!isCurrent()) return;
    view.innerHTML = `
      <div class="source-bar"><span class="source-label">知识读模型</span>${badge(stats.source_status || 'UNKNOWN')}${badge(data.live_data_verified === true ? 'SEMANTIC VERIFIED' : 'SEMANTIC PENDING')}<span>知识不授予执行权限</span></div>
      <div class="hero"><div><div class="hero-eyebrow">KNOWLEDGE BASE</div><h2>从事实、证据与方法中检索可复用知识</h2><p>统一检索政策、运营方法、市场玩法、产品经验、案例、工程规则和决策知识。Observed 不等于 Confirmed，Knowledge 不等于 Permission。</p></div></div>
      <div class="grid grid-4 section">
        <div class="card metric-card"><div class="metric-label">当前知识项</div><div class="metric-value">${esc(stats.total ?? '—')}</div><div class="metric-meta">${esc(stats.source_status || '状态未知')}</div></div>
        <div class="card metric-card"><div class="metric-label">已出现知识类型</div><div class="metric-value">${esc(stats.by_type?.length ?? '—')}</div><div class="metric-meta">Taxonomy 支持 11 类</div></div>
        <div class="card metric-card"><div class="metric-label">已出现真值层级</div><div class="metric-value">${esc(stats.by_truth?.length ?? '—')}</div><div class="metric-meta">SOURCE_ONLY → CONFIRMED</div></div>
        <div class="card metric-card"><div class="metric-label">执行权限</div><div class="metric-value compact-value">READ ONLY</div><div class="metric-meta">Knowledge ≠ Permission</div></div>
      </div>
      <section class="card section" aria-labelledby="knowledge-search-title">
        <div class="section-head"><div><h2 id="knowledge-search-title">检索知识</h2><div class="section-sub">关键词 + 类型 + 领域 + 真值等级</div></div></div>
        <div class="grid grid-4" style="align-items:end">
          <label><span class="field-label">关键词</span><input id="kb-q" class="kb-input" placeholder="例如 Review / Vine / 定价" /></label>
          <label><span class="field-label">知识类型</span><select id="kb-type" class="kb-input">${types.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
          <label><span class="field-label">领域</span><input id="kb-domain" class="kb-input" placeholder="例如 Review / System" /></label>
          <label><span class="field-label">真值等级</span><select id="kb-truth" class="kb-input">${truths.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
        </div>
        <div class="toolbar" style="margin-top:12px"><button id="kb-search" class="btn btn-primary" type="button">搜索知识</button><button id="kb-reset" class="btn" type="button">重置</button></div>
      </section>
      <div id="kb-result" class="section"><div class="empty-state compact-empty"><p>正在读取知识库…</p></div></div>
    `;

    const searchButton = document.getElementById('kb-search');
    const result = document.getElementById('kb-result');
    let requestGeneration = 0;
    async function execute() {
      const generation = ++requestGeneration;
      searchButton.disabled = true;
      searchButton.setAttribute('aria-busy', 'true');
      result.innerHTML = '<div class="empty-state compact-empty"><p>正在检索…</p></div>';
      try {
        const payload = await query({
          q: document.getElementById('kb-q').value.trim(),
          knowledge_type: document.getElementById('kb-type').value,
          domain: document.getElementById('kb-domain').value.trim(),
          truth_class: document.getElementById('kb-truth').value
        });
        if (generation !== requestGeneration || !isCurrent()) return;
        result.innerHTML = `<div class="section-head"><div><h2>检索结果</h2><div class="section-sub">${payload.total} 条 · ${esc(payload.source_status)}</div></div></div><div class="grid grid-2">${payload.items.length ? payload.items.map(card).join('') : '<div class="card empty-state compact-empty"><h3>没有匹配知识</h3><p>调整关键词或筛选条件。</p></div>'}</div>`;
      } catch (error) {
        if (generation !== requestGeneration || !isCurrent()) return;
        result.innerHTML = `<div class="notice bad">知识 API 暂不可用：${esc(error.message)}。没有使用静态内容冒充实时结果。 <button class="btn btn-quiet" id="kb-retry" type="button">重试</button></div>`;
        document.getElementById('kb-retry')?.addEventListener('click', execute);
      } finally {
        if (generation === requestGeneration && isCurrent()) {
          searchButton.disabled = false;
          searchButton.removeAttribute('aria-busy');
        }
      }
    }

    searchButton.addEventListener('click', execute);
    document.getElementById('kb-reset').addEventListener('click', () => {
      document.getElementById('kb-q').value = '';
      document.getElementById('kb-type').value = '';
      document.getElementById('kb-domain').value = '';
      document.getElementById('kb-truth').value = '';
      execute();
    });
    document.getElementById('kb-q').addEventListener('keydown', event => { if (event.key === 'Enter') execute(); });
    execute();
  }

  renderers['/knowledge'] = renderKnowledge;
})();
