(() => {
  const renderers = window.__1122_PAGE_RENDERERS__ ||= {};
  const API_BASE = 'https://sif-api.sorilo-uk.com';
  const TERMINAL = new Set(['SUCCEEDED', 'PARTIAL', 'FAILED']);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const knownNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const fmtNumber = (value, digits = 0) => knownNumber(value) ? Number(value).toLocaleString('zh-CN', { maximumFractionDigits: digits }) : '—';
  const fmtTime = value => value ? new Date(value).toLocaleString('zh-CN') : '—';
  const fmtPercent = value => knownNumber(value) ? `${(Number(value) * 100).toFixed(1)}%` : '—';
  const statusKind = value => /SUCCEEDED|CONNECTED|READY|RELEVANT/i.test(String(value)) ? 'ok' : /FAILED|ERROR|INVALID/i.test(String(value)) ? 'bad' : 'warn';
  const tag = value => `<span class="tag tag-${statusKind(value)}">${esc(value ?? 'UNKNOWN')}</span>`;
  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const hasJobShape = value => isRecord(value?.job) && typeof value.job.job_id === 'string' && typeof value.job.status === 'string';
  let accessKey = '';
  let taxonomy = null;
  let capability = null;
  let activeJobId = null;
  let activeKeywordItems = [];
  let keywordCursor = null;
  let pollGeneration = 0;

  function hero(actions = '') {
    return `<div class="hero"><div><div class="hero-eyebrow">COMPETITOR KEYWORD WORKSPACE</div><h2>竞品关键词工作台</h2><p>输入最多 10 个竞品 ASIN，通过 SIF 分页读取所选周期内可见的流量词，严格去重后按版本化规则分类，并长期保存每个词的来源 ASIN。</p></div>${actions ? `<div class="hero-actions">${actions}</div>` : ''}</div>`;
  }

  async function api(path, options = {}) {
    const method = options.method || 'GET';
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (options.auth !== false && accessKey) headers.Authorization = `Bearer ${accessKey}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const attempts = method === 'GET' ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 12_000);
      try {
        const response = await fetch(`${API_BASE}${path}`, {
          method,
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
        });
        let payload;
        try { payload = await response.json(); } catch { throw new Error('接口返回内容无法识别'); }
        if (!payload || typeof payload !== 'object') throw new Error('接口返回结构不完整');
        if (!response.ok || payload.success !== true) {
          if (attempt + 1 < attempts && [502, 503, 504].includes(response.status)) continue;
          const error = new Error(payload.error?.message || payload.message || `HTTP ${response.status}`);
          error.code = payload.error?.code || `HTTP_${response.status}`;
          error.status = response.status;
          error.validation = payload.validation;
          throw error;
        }
        if (options.validate && !options.validate(payload)) throw new Error('接口返回结构不完整');
        return payload;
      } catch (error) {
        if (error?.name === 'AbortError') {
          if (attempt + 1 < attempts) continue;
          const timeoutError = new Error('接口响应超时，请稍后重试');
          timeoutError.code = 'TIMEOUT';
          throw timeoutError;
        }
        if (attempt + 1 < attempts && !error?.status) continue;
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error('接口请求未完成');
  }

  function defaultPeriodStart() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-01`;
  }

  function parseAsins(value) {
    const seen = new Set();
    const valid = [];
    const invalid = [];
    let duplicateCount = 0;
    for (const raw of String(value || '').split(/[\s,;，；]+/)) {
      const asin = raw.trim().toUpperCase();
      if (!asin) continue;
      if (!/^[A-Z0-9]{10}$/.test(asin)) { invalid.push(asin); continue; }
      if (seen.has(asin)) { duplicateCount += 1; continue; }
      seen.add(asin);
      valid.push(asin);
    }
    return { valid, invalid, duplicateCount };
  }

  function categoryMap() {
    return new Map((taxonomy?.categories || []).map(item => [item.code, item.label]));
  }

  function categoryLabel(code) {
    return categoryMap().get(code) || code || '未分类';
  }

  function lockedShell(message, configured) {
    return `${hero('<a class="btn" href="#/operations/competitors">返回竞品中心</a>')}
      <div class="grid grid-3 section">
        <div class="card metric-card"><div class="metric-label">SIF 数据源</div><div class="metric-value compact-value">周期流量词</div><div class="metric-meta">分页读取，不用 ABA Top3 冒充全部词</div></div>
        <div class="card metric-card"><div class="metric-label">单次竞品</div><div class="metric-value">${capability?.limits?.max_asins_per_job ?? 10}</div><div class="metric-meta">输入内自动去重，不静默截断</div></div>
        <div class="card metric-card"><div class="metric-label">分类规则</div><div class="metric-value compact-value">${esc(capability?.taxonomy_version || taxonomy?.taxonomy_version || 'v1')}</div><div class="metric-meta">10 个主分类 + 长尾 / 核心层级标签</div></div>
      </div>
      <section class="card card-elevated section research-unlock">
        <div>
          <div class="item-title">${configured ? '输入关键词研究操作密钥' : '先在 Cloudflare 配置关键词研究操作密钥'}</div>
          <div class="item-meta">${esc(message)}</div>
        </div>
        <div class="research-unlock-controls">
          <label><span class="field-label">操作密钥（只保存在当前页面内存）</span><input id="research-access-key" class="field" type="password" autocomplete="off" spellcheck="false" ${configured ? '' : 'disabled'} /></label>
          <button id="research-unlock" class="btn btn-primary" type="button" ${configured ? '' : 'disabled'}>进入工作台</button>
        </div>
      </section>
      <div id="research-unlock-error" class="section"></div>
      <div class="notice warn section"><strong>为什么需要单独密钥：</strong>新建任务会消耗 SIF 查询额度。CORS 只能限制普通浏览器跨域，不能验证操作者身份，因此这里不会把付费查询接口直接公开。</div>
      ${taxonomyPanel()}`;
  }

  function taxonomyPanel() {
    const rows = taxonomy?.categories || [];
    return `<section class="section"><div class="section-head"><div><h2>关键词分类法</h2><div class="section-sub">每个词只有一个主分类，长尾、核心层级和待复核是独立标签</div></div></div>
      <div class="grid grid-auto">${rows.map((item, index) => `<article class="card taxonomy-card"><div class="split-title"><div class="item-title">${index + 1}. ${esc(item.label)}</div><span class="code">${esc(item.code)}</span></div><div class="item-meta">${esc(item.description)}</div></article>`).join('')}</div>
    </section>`;
  }

  function formPanel() {
    return `<section class="card card-elevated" id="research-new-panel">
      <div class="section-head"><div><h2>新建竞品词研究</h2><div class="section-sub">默认读取本月 SIF 可见流量词；任务提交后由队列继续处理</div></div>${tag('PROTECTED ACTION')}</div>
      <form id="keyword-research-form" class="research-form">
        <label class="research-form-wide"><span class="field-label">竞品 ASIN（每行一个，也支持逗号或空格）</span><textarea id="research-asins" class="field research-textarea" rows="6" placeholder="B0XXXXXXXX&#10;B0YYYYYYYY" required></textarea><span id="asin-validation" class="field-help">0 个有效 ASIN · 最多 10 个</span></label>
        <label><span class="field-label">任务名称（可选）</span><input id="research-job-name" class="field" maxlength="80" placeholder="例如：麻将套装核心竞品 · 9 月" /></label>
        <label><span class="field-label">我方品牌（可选）</span><input id="research-own-brands" class="field" maxlength="300" placeholder="多个品牌用逗号分隔" /><span class="field-help">用于识别“自有品牌词”，不会发送给 Amazon</span></label>
        <label><span class="field-label">市场</span><select id="research-marketplace" class="field"><option value="US">美国（US）</option></select></label>
        <label><span class="field-label">时间粒度</span><select id="research-granularity" class="field"><option value="month">月</option><option value="week">周</option><option value="day">日</option></select></label>
        <label><span class="field-label">SIF 周期锚点</span><input id="research-period" class="field" type="date" value="${defaultPeriodStart()}" required /></label>
        <div class="research-form-wide notice">数据范围是<strong>所选周期内 SIF 能观测到的竞品流量词</strong>，不是 Amazon 所有搜索查询。系统逐页读取，达到安全上限时会明确标记“已截断”。</div>
        <div class="research-form-wide toolbar"><button id="research-submit" class="btn btn-primary" type="submit">开始分析</button><span class="field-help">每小时最多 ${capability?.limits?.max_asins_per_hour ?? 100} 个 ASIN；任务不会因关闭页面而丢失。</span></div>
      </form>
      <div id="research-form-message" class="section"></div>
    </section>`;
  }

  function historyPanel(jobs) {
    return `<section class="card research-history"><div class="section-head"><div><h2>最近任务</h2><div class="section-sub">结果保存在 1122-core D1，不保存到浏览器</div></div><button id="research-refresh-jobs" class="btn btn-quiet" type="button">刷新</button></div>
      <div class="list">${jobs.length ? jobs.map(job => `<a class="list-item goal-card research-job-link" href="#/operations/competitors/keywords?job_id=${encodeURIComponent(job.job_id)}">
        <div class="split-title"><div class="item-title">${esc(job.job_name || job.input_asins.join(' · '))}</div>${tag(job.status)}</div>
        <div class="item-meta">${fmtTime(job.created_at)} · ${job.input_asin_count} ASIN · ${fmtNumber(job.unique_keyword_count)} 唯一词</div>
      </a>`).join('') : '<div class="empty-state compact-empty"><h3>还没有研究任务</h3><p>从左侧输入竞品 ASIN 创建第一份可追溯词库。</p></div>'}</div>
    </section>`;
  }

  function workspaceShell(jobs) {
    return `${hero('<button id="research-lock" class="btn" type="button">锁定工作台</button><a class="btn" href="#/operations/competitors">竞品中心</a>')}
      <div class="notice section"><strong>安全边界：</strong>操作密钥仅保存在当前页面内存；刷新页面后需要重新输入。SIF 密钥始终只存在 Worker Secret 中。</div>
      <div class="research-layout section"><div>${formPanel()}</div><div>${historyPanel(jobs)}</div></div>
      <div id="research-result" class="section">${activeJobId ? '<div class="card"><div class="skeleton skeleton-line"></div></div>' : '<div class="empty-state"><div class="empty-icon">⌕</div><h2>选择任务查看去重词库</h2><p>任务完成后可以按分类、核心层级、来源 ASIN 和关键词筛选。</p></div>'}</div>
      ${taxonomyPanel()}`;
  }

  function categoryDistribution(detail) {
    const total = Number(detail.job.unique_keyword_count || 0);
    return `<div class="category-distribution">${(taxonomy?.categories || []).map(item => {
      const row = (detail.category_counts || []).find(value => value.category === item.code);
      const count = Number(row?.keyword_count || 0);
      const width = total ? Math.max(2, (count / total) * 100) : 0;
      return `<button class="category-row" type="button" data-category="${esc(item.code)}"><span>${esc(item.label)}</span><strong>${fmtNumber(count)}</strong><span class="category-bar"><i style="width:${width}%"></i></span></button>`;
    }).join('')}</div>`;
  }

  function asinTable(asins) {
    return `<div class="table-wrap"><table><caption>${asins.length} 个输入 ASIN 的独立处理状态。</caption><thead><tr><th>ASIN / 产品</th><th>状态</th><th>返回范围</th><th>分页</th><th>观察时间</th></tr></thead><tbody>${asins.map(row => `<tr>
      <td><strong class="code">${esc(row.asin)}</strong>${row.title ? `<div class="item-meta">${esc(row.title)}</div>` : ''}${row.brand ? `<div class="item-meta">品牌：${esc(row.brand)}</div>` : ''}</td>
      <td>${tag(row.status)}${row.error ? `<div class="item-meta">${esc(row.error.message)}</div>` : ''}</td>
      <td>${fmtNumber(row.fetched_keyword_count)} / ${fmtNumber(row.expected_keyword_count)}${row.is_truncated ? '<div class="item-meta bad-text">已达到安全上限</div>' : ''}</td>
      <td>${fmtNumber(row.fetched_page_count)} 页</td><td>${fmtTime(row.observed_at)}</td>
    </tr>`).join('')}</tbody></table></div>`;
  }

  function keywordFilters(detail) {
    return `<div class="keyword-filter-grid">
      <label><span class="field-label">搜索关键词</span><input id="keyword-filter-q" class="field" placeholder="输入英文词组" /></label>
      <label><span class="field-label">主分类</span><select id="keyword-filter-category" class="field"><option value="">全部 10 类</option>${(taxonomy?.categories || []).map(item => `<option value="${esc(item.code)}">${esc(item.label)}</option>`).join('')}</select></label>
      <label><span class="field-label">核心层级</span><select id="keyword-filter-tier" class="field"><option value="">全部层级</option><option value="CORE">核心</option><option value="SUPPORT">支撑</option><option value="LONG_TAIL">长尾</option><option value="NICHE">细分</option></select></label>
      <label><span class="field-label">来源 ASIN</span><select id="keyword-filter-asin" class="field"><option value="">全部竞品</option>${(detail.asins || []).filter(row => row.status === 'SUCCEEDED').map(row => `<option value="${esc(row.asin)}">${esc(row.asin)}</option>`).join('')}</select></label>
      <label><span class="field-label">排序</span><select id="keyword-filter-sort" class="field"><option value="search_volume">搜索量</option><option value="source_count">竞品覆盖数</option><option value="keyword">关键词 A-Z</option></select></label>
      <label class="checkbox-field"><input id="keyword-filter-review" type="checkbox" /> 只看待复核</label>
      <button id="keyword-filter-apply" class="btn btn-primary" type="button">应用筛选</button>
    </div>`;
  }

  function keywordTable(items, total, append = false) {
    const rows = items.map(item => `<tr>
      <td><strong>${esc(item.keyword)}</strong><div class="item-meta">${esc(item.strategic_tier)} · ${esc(item.query_shape)}${item.needs_review ? ' · 待复核' : ''}</div></td>
      <td><span class="tag tag-info">${esc(categoryLabel(item.primary_category))}</span><div class="item-meta" title="${esc(item.classification_reason)}">置信度 ${Math.round(item.classification_confidence * 100)}%</div></td>
      <td><strong>${fmtNumber(item.source_asin_count)}</strong><div class="source-asins">${(item.source_asins || []).map(asin => `<span class="code">${esc(asin)}</span>`).join('')}</div></td>
      <td>${fmtNumber(item.search_volume)}<div class="item-meta">ABA 排名 ${fmtNumber(item.best_aba_rank)}</div></td>
      <td>${fmtPercent(item.max_traffic_share)}<div class="item-meta">得分 ${fmtNumber(item.max_traffic_score, 2)}</div></td>
      <td>${fmtNumber(item.best_organic_rank, 1)}<div class="item-meta">SP ${fmtNumber(item.best_sp_rank, 1)}</div></td>
    </tr>`).join('');
    if (append) return rows;
    return `<div class="table-wrap"><table><caption>当前筛选共 ${fmtNumber(total)} 个严格去重关键词；搜索量取各 ASIN 返回值的最大值，不跨 ASIN 相加。</caption><thead><tr><th>关键词 / 层级</th><th>主分类</th><th>来源竞品</th><th>搜索量 / ABA</th><th>最高流量占比</th><th>自然 / SP 位</th></tr></thead><tbody id="keyword-table-body">${rows || '<tr><td colspan="6">当前筛选没有关键词。</td></tr>'}</tbody></table></div>`;
  }

  function resultPanel(detail, keywordPayload) {
    const job = detail.job;
    const duplicates = Number(job.duplicate_keyword_count || 0);
    const dedupeRate = job.raw_keyword_count ? duplicates / job.raw_keyword_count : 0;
    const running = !TERMINAL.has(job.status);
    const truncated = (detail.asins || []).some(row => row.is_truncated);
    return `<section class="result-hero card card-elevated"><div class="split-title"><div><div class="hero-eyebrow">RESEARCH RUN</div><h2>${esc(job.job_name || job.input_asins.join(' · '))}</h2><div class="item-meta">${esc(job.marketplace)} · ${esc(job.granularity)} ${esc(job.period_start)} · ${esc(job.source_tool)}</div></div>${tag(job.status)}</div>
      ${running ? `<div class="research-progress"><span></span></div><div class="item-meta">${job.status === 'CLASSIFYING' ? `正在分类 ${fmtNumber(job.classified_keyword_count)} / ${fmtNumber(job.unique_keyword_count)} 个去重词` : job.status === 'CLASSIFICATION_PENDING' ? '已完成采集，正在启动分类' : '任务正在后台分页采集'}；本页将在有限时间内自动刷新。</div>` : ''}
      <div class="toolbar section"><button id="research-refresh-result" class="btn" type="button">刷新结果</button><a class="btn btn-quiet" href="#/operations/competitors/keywords">清除选择</a></div>
    </section>
    <div class="grid grid-4 section">
      <div class="card metric-card"><div class="metric-label">输入 ASIN</div><div class="metric-value">${fmtNumber(job.input_asin_count)}</div><div class="metric-meta">成功 ${fmtNumber(job.successful_asin_count)} · 失败 ${fmtNumber(job.failed_asin_count)}</div></div>
      <div class="card metric-card"><div class="metric-label">SIF 原始词行</div><div class="metric-value">${fmtNumber(job.raw_keyword_count)}</div><div class="metric-meta">逐 ASIN、逐页真实计数</div></div>
      <div class="card metric-card"><div class="metric-label">严格去重后</div><div class="metric-value">${fmtNumber(job.unique_keyword_count)}</div><div class="metric-meta">合并 ${fmtNumber(duplicates)} 行 · ${fmtPercent(dedupeRate)}</div></div>
      <div class="card metric-card"><div class="metric-label">完成时间</div><div class="metric-value compact-value">${fmtTime(job.completed_at)}</div><div class="metric-meta">${esc(job.taxonomy_version)}</div></div>
    </div>
    ${truncated ? '<div class="notice warn section"><strong>存在截断：</strong>至少一个 ASIN 的总词数超过单 ASIN 安全页数上限。已保存的数据真实有效，但不能标记为完整覆盖。</div>' : ''}
    ${job.status === 'PARTIAL' ? '<div class="notice warn section"><strong>部分完成：</strong>成功 ASIN 的词已保存；失败 ASIN 不会阻止查看现有结果。</div>' : ''}
    ${job.status === 'FAILED' && job.error ? `<div class="notice bad section"><strong>${esc(job.error.stage)}：</strong>${esc(job.error.message)}</div>` : ''}
    <div class="grid grid-2 section"><section class="card"><div class="section-head"><div><h2>10 类分布</h2><div class="section-sub">点击类别可直接筛选词表</div></div></div>${categoryDistribution(detail)}</section><section><div class="section-head"><div><h2>ASIN 处理明细</h2><div class="section-sub">失败和截断不会被隐藏</div></div></div>${asinTable(detail.asins || [])}</section></div>
    <section class="section"><div class="section-head"><div><h2>去重分类词库</h2><div class="section-sub">显示来源 ASIN，并可按 ASIN 筛选；近似词只提示，不自动合并</div></div></div>${keywordFilters(detail)}<div id="keyword-table-shell">${keywordTable(keywordPayload?.items || [], keywordPayload?.total || 0)}</div>${keywordPayload?.next_cursor ? '<div class="toolbar load-more-row"><button id="keyword-load-more" class="btn" type="button">加载更多</button></div>' : ''}</section>`;
  }

  function showMessage(targetId, message, kind = 'bad') {
    const target = document.getElementById(targetId);
    if (target) target.innerHTML = message ? `<div class="notice ${kind}">${esc(message)}</div>` : '';
  }

  async function loadTaxonomyAndCapability() {
    const [status, taxonomyPayload] = await Promise.all([
      api('/research-status', { auth: false, validate: value => isRecord(value.research) }),
      api('/api/v1/keyword-taxonomy', {
        auth: false,
        validate: value => typeof value.taxonomy_version === 'string'
          && Array.isArray(value.categories) && value.categories.length === 10,
      }),
    ]);
    capability = status.research;
    taxonomy = taxonomyPayload;
  }

  async function loadKeywords(jobId, { append = false } = {}) {
    const params = new URLSearchParams({ limit: '100' });
    const q = document.getElementById('keyword-filter-q')?.value.trim();
    const category = document.getElementById('keyword-filter-category')?.value;
    const tier = document.getElementById('keyword-filter-tier')?.value;
    const asin = document.getElementById('keyword-filter-asin')?.value;
    const sort = document.getElementById('keyword-filter-sort')?.value;
    const review = document.getElementById('keyword-filter-review')?.checked;
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    if (tier) params.set('tier', tier);
    if (asin) params.set('asin', asin);
    if (sort) params.set('sort', sort);
    if (review) params.set('review', '1');
    if (append && keywordCursor) params.set('cursor', keywordCursor);
    const payload = await api(`/api/v1/competitor-keyword-runs/${encodeURIComponent(jobId)}/keywords?${params}`, {
      validate: value => Array.isArray(value.items) && Number.isInteger(value.total)
        && (value.next_cursor === null || typeof value.next_cursor === 'string'),
    });
    keywordCursor = payload.next_cursor;
    activeKeywordItems = append ? [...activeKeywordItems, ...payload.items] : payload.items;
    return { ...payload, items: activeKeywordItems };
  }

  async function renderSelectedJob(isCurrent, { poll = true } = {}) {
    const pollTicket = ++pollGeneration;
    if (!activeJobId || !isCurrent()) return;
    const result = document.getElementById('research-result');
    if (!result) return;
    try {
      const detail = await api(`/api/v1/competitor-keyword-runs/${encodeURIComponent(activeJobId)}`, {
        validate: value => hasJobShape(value) && Array.isArray(value.asins) && Array.isArray(value.category_counts),
      });
      if (!isCurrent()) return;
      activeKeywordItems = [];
      keywordCursor = null;
      const keywords = detail.job.unique_keyword_count > 0 ? await loadKeywords(activeJobId) : { items: [], total: 0, next_cursor: null };
      if (!isCurrent()) return;
      result.innerHTML = resultPanel(detail, keywords);
      bindResultEvents(detail, isCurrent);
      if (poll && !TERMINAL.has(detail.job.status)) pollJob(isCurrent, 0, pollTicket);
    } catch (error) {
      if (isCurrent()) result.innerHTML = `<div class="notice bad">${esc(error.message)}</div>`;
    }
  }

  function bindResultEvents(detail, isCurrent) {
    document.getElementById('research-refresh-result')?.addEventListener('click', () => renderSelectedJob(isCurrent));
    document.getElementById('keyword-filter-apply')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.setAttribute('aria-busy', 'true');
      try {
        activeKeywordItems = [];
        keywordCursor = null;
        const payload = await loadKeywords(activeJobId);
        document.getElementById('keyword-table-shell').innerHTML = keywordTable(payload.items, payload.total);
        updateLoadMore(payload.next_cursor, detail, isCurrent);
      } catch (error) {
        document.getElementById('keyword-table-shell').innerHTML = `<div class="notice bad">${esc(error.message)}</div>`;
      } finally { button.removeAttribute('aria-busy'); }
    });
    document.querySelectorAll('.category-row').forEach(button => button.addEventListener('click', () => {
      const select = document.getElementById('keyword-filter-category');
      if (select) select.value = button.dataset.category;
      document.getElementById('keyword-filter-apply')?.click();
    }));
    updateLoadMore(keywordCursor, detail, isCurrent);
  }

  function updateLoadMore(cursor, detail, isCurrent) {
    const existing = document.querySelector('.load-more-row');
    if (!cursor) { existing?.remove(); return; }
    const section = document.getElementById('keyword-table-shell')?.parentElement;
    if (!section) return;
    let row = existing;
    if (!row) {
      row = document.createElement('div');
      row.className = 'toolbar load-more-row';
      row.innerHTML = '<button id="keyword-load-more" class="btn" type="button">加载更多</button>';
      section.appendChild(row);
    }
    const button = document.getElementById('keyword-load-more');
    if (!button) return;
    button.onclick = async () => {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      try {
        const before = activeKeywordItems.length;
        const payload = await loadKeywords(activeJobId, { append: true });
        const body = document.getElementById('keyword-table-body');
        if (body) body.insertAdjacentHTML('beforeend', keywordTable(payload.items.slice(before), payload.total, true));
        updateLoadMore(payload.next_cursor, detail, isCurrent);
      } catch (error) {
        showMessage('research-form-message', error.message);
      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    };
  }

  function pollJob(isCurrent, attempt, pollTicket) {
    if (!isCurrent() || pollTicket !== pollGeneration) return;
    if (attempt >= 120) {
      const result = document.getElementById('research-result');
      result?.insertAdjacentHTML('afterbegin', '<div class="notice warn section"><strong>自动刷新已暂停：</strong>后台任务不会停止。稍后点击“刷新结果”即可继续查看，页面不会无限等待。</div>');
      return;
    }
    setTimeout(async () => {
      if (!isCurrent() || pollTicket !== pollGeneration) return;
      try {
        const detail = await api(`/api/v1/competitor-keyword-runs/${encodeURIComponent(activeJobId)}`, {
          validate: value => hasJobShape(value) && Array.isArray(value.asins) && Array.isArray(value.category_counts),
        });
        if (!isCurrent()) return;
        if (TERMINAL.has(detail.job.status)) await renderSelectedJob(isCurrent, { poll: false });
        else {
          const result = document.getElementById('research-result');
          if (result) result.innerHTML = resultPanel(detail, { items: [], total: 0, next_cursor: null });
          bindResultEvents(detail, isCurrent);
          pollJob(isCurrent, attempt + 1, pollTicket);
        }
      } catch { if (isCurrent() && pollTicket === pollGeneration) pollJob(isCurrent, attempt + 1, pollTicket); }
    }, 5_000);
  }

  function bindWorkspaceEvents(jobs, isCurrent) {
    document.getElementById('research-lock')?.addEventListener('click', () => {
      accessKey = '';
      activeJobId = null;
      location.hash = '/operations/competitors/keywords';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    document.getElementById('research-refresh-jobs')?.addEventListener('click', () => window.dispatchEvent(new HashChangeEvent('hashchange')));
    const asinInput = document.getElementById('research-asins');
    const validation = document.getElementById('asin-validation');
    asinInput?.addEventListener('input', () => {
      const parsed = parseAsins(asinInput.value);
      validation.textContent = `${parsed.valid.length} 个有效 · ${parsed.duplicateCount} 个重复 · ${parsed.invalid.length} 个无效 · 最多 ${capability?.limits?.max_asins_per_job ?? 10} 个`;
      validation.className = `field-help ${parsed.invalid.length || parsed.valid.length > 10 ? 'bad-text' : ''}`;
    });
    document.getElementById('keyword-research-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const button = document.getElementById('research-submit');
      const parsed = parseAsins(asinInput.value);
      if (parsed.invalid.length || parsed.valid.length < 1 || parsed.valid.length > 10) {
        showMessage('research-form-message', '请保留 1–10 个合法的 10 位 ASIN，并修正无效项。');
        return;
      }
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      showMessage('research-form-message', '任务正在创建，请稍候…', '');
      try {
        const payload = await api('/api/v1/competitor-keyword-runs', {
          method: 'POST', timeoutMs: 20_000,
          validate: value => hasJobShape(value),
          body: {
            asins: parsed.valid,
            marketplace: document.getElementById('research-marketplace').value,
            job_name: document.getElementById('research-job-name').value,
            own_brands: document.getElementById('research-own-brands').value,
            granularity: document.getElementById('research-granularity').value,
            period_start: document.getElementById('research-period').value,
          },
        });
        activeJobId = payload.job.job_id;
        location.hash = `/operations/competitors/keywords?job_id=${encodeURIComponent(activeJobId)}`;
      } catch (error) {
        const extra = error.validation?.invalid?.length ? ` 无效项：${error.validation.invalid.join('、')}` : '';
        showMessage('research-form-message', `${error.message}${extra}`);
      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    });
  }

  async function renderLocked(view, isCurrent, message = '') {
    const configured = Boolean(capability?.access_key_configured);
    view.innerHTML = lockedShell(message || (configured
      ? '请输入你在 1122-sif-bridge 中设置的 SIF_RESEARCH_ACCESS_KEY。密钥不会写入 localStorage。'
      : '在 1122-sif-bridge 的 Worker Secrets 新增 SIF_RESEARCH_ACCESS_KEY，值由你自行生成并保管。'), configured);
    document.getElementById('research-unlock')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const value = document.getElementById('research-access-key')?.value.trim() || '';
      if (!value) { showMessage('research-unlock-error', '请输入操作密钥。'); return; }
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      accessKey = value;
      try {
        await api('/api/v1/competitor-keyword-runs?limit=1', { validate: value => Array.isArray(value.jobs) });
        if (isCurrent()) window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (error) {
        accessKey = '';
        showMessage('research-unlock-error', error.message);
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    });
    document.getElementById('research-access-key')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') document.getElementById('research-unlock')?.click();
    });
  }

  async function renderCompetitorKeywords({ query, view, setChrome, isCurrent }) {
    setChrome('竞品关键词工作台', '经营 / 运营 / 竞品 / 关键词工作台');
    view.innerHTML = `${hero()}<div class="section"><div class="card"><div class="skeleton skeleton-line"></div></div></div>`;
    try {
      if (!taxonomy || !capability) await loadTaxonomyAndCapability();
    } catch (error) {
      if (isCurrent()) view.innerHTML = `${hero()}<div class="notice bad section">SIF 关键词工作台状态读取失败：${esc(error.message)}</div>`;
      return;
    }
    if (!isCurrent()) return;
    activeJobId = query.get('job_id') || null;
    if (!accessKey || !capability.access_key_configured) {
      await renderLocked(view, isCurrent);
      return;
    }
    try {
      const payload = await api('/api/v1/competitor-keyword-runs?limit=20', {
        validate: value => Array.isArray(value.jobs) && value.jobs.every(job => isRecord(job) && typeof job.job_id === 'string'),
      });
      if (!isCurrent()) return;
      view.innerHTML = workspaceShell(payload.jobs || []);
      bindWorkspaceEvents(payload.jobs || [], isCurrent);
      if (activeJobId) await renderSelectedJob(isCurrent);
    } catch (error) {
      if (error.status === 401) {
        accessKey = '';
        await renderLocked(view, isCurrent, '操作密钥无效或已轮换，请重新输入。');
      } else {
        view.innerHTML = `${hero()}<div class="notice bad section">${esc(error.message)}</div>`;
      }
    }
  }

  renderers['/operations/competitors/keywords'] = renderCompetitorKeywords;
})();
