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
  const MAX_UI_BATCH_ASINS = 100;
  let accessKey = '';
  let taxonomy = null;
  let capability = null;
  let groups = [];
  let groupsLoadError = '';
  let unlockMessage = '';
  let activeJobId = null;
  let activeGroupId = null;
  let activeKeywordItems = [];
  let keywordCursor = null;
  let activeGroupKeywordItems = [];
  let groupKeywordCursor = null;
  let pollGeneration = 0;

  function perJobAsinLimit() {
    const limit = Number(capability?.limits?.max_asins_per_job || 10);
    return Number.isInteger(limit) && limit > 0 ? limit : 10;
  }

  function batchAsinLimit() {
    const perJob = perJobAsinLimit();
    const hourly = Number(capability?.limits?.max_asins_per_hour || MAX_UI_BATCH_ASINS);
    const jobsHourly = Number(capability?.limits?.max_jobs_per_hour || 20);
    const safeHourly = Number.isFinite(hourly) && hourly > 0 ? Math.floor(hourly) : MAX_UI_BATCH_ASINS;
    const safeJobs = Number.isFinite(jobsHourly) && jobsHourly > 0 ? Math.floor(jobsHourly) : 20;
    return Math.min(MAX_UI_BATCH_ASINS, safeHourly, perJob * safeJobs);
  }

  function splitAsins(asins, size) {
    const chunks = [];
    for (let index = 0; index < asins.length; index += size) chunks.push(asins.slice(index, index + size));
    return chunks;
  }

  function batchJobName(value, index, total) {
    const base = String(value || '').trim();
    if (total === 1) return base;
    const suffix = ` · ${index + 1}/${total}`;
    return `${(base || '批量竞品关键词').slice(0, Math.max(1, 80 - suffix.length))}${suffix}`;
  }

  function hero(actions = '') {
    return `<div class="hero"><div><div class="hero-eyebrow">COMPETITOR KEYWORD WORKSPACE</div><h2>竞品关键词工作台</h2><p>一次可输入最多 ${batchAsinLimit()} 个竞品 ASIN；系统按每 ${perJobAsinLimit()} 个自动拆分为受控 SIF 任务，在同一产品分组内严格去重、分类并长期保留来源 ASIN。</p></div>${actions ? `<div class="hero-actions">${actions}</div>` : ''}</div>`;
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

  // This draft intentionally lives only in the current page process. It makes
  // an unlock/re-render safe without putting ASINs or the operation key in
  // localStorage, sessionStorage, or a URL.
  const researchDraft = {
    asins: '',
    jobName: '',
    ownBrands: '',
    marketplace: 'US',
    granularity: 'month',
    periodStart: defaultPeriodStart(),
    groupId: '',
    groupName: '',
    groupDescription: '',
  };

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

  function workbenchHref({ jobId = '', groupId = '' } = {}) {
    const params = new URLSearchParams();
    if (jobId) params.set('job_id', jobId);
    if (groupId) params.set('group_id', groupId);
    return `#/operations/competitors/keywords${params.size ? `?${params.toString()}` : ''}`;
  }

  function executionReady() {
    return Boolean(accessKey && capability?.access_key_configured);
  }

  function groupLabel(group, fallback = '历史未分组') {
    return group?.group_name || fallback;
  }

  function selectedGroup() {
    return groups.find(group => group.group_id === researchDraft.groupId) || null;
  }

  function rememberResearchDraft() {
    const read = id => document.getElementById(id)?.value;
    const values = [
      ['asins', 'research-asins'],
      ['jobName', 'research-job-name'],
      ['ownBrands', 'research-own-brands'],
      ['marketplace', 'research-marketplace'],
      ['granularity', 'research-granularity'],
      ['periodStart', 'research-period'],
      ['groupId', 'research-group-id'],
      ['groupName', 'research-group-name'],
      ['groupDescription', 'research-group-description'],
    ];
    values.forEach(([key, id]) => {
      const value = read(id);
      if (value !== undefined) researchDraft[key] = value;
    });
  }

  function overviewCards() {
    return `<div class="grid grid-3 section">
        <div class="card metric-card"><div class="metric-label">SIF 数据源</div><div class="metric-value compact-value">周期流量词</div><div class="metric-meta">分页读取，不用 ABA Top3 冒充全部词</div></div>
        <div class="card metric-card"><div class="metric-label">自动分批</div><div class="metric-value">${perJobAsinLimit()}</div><div class="metric-meta">每任务上限；同组可一次提交 ${batchAsinLimit()} 个</div></div>
        <div class="card metric-card"><div class="metric-label">分类规则</div><div class="metric-value compact-value">${esc(capability?.taxonomy_version || taxonomy?.taxonomy_version || 'v1')}</div><div class="metric-meta">10 个主分类 + 长尾 / 核心层级标签</div></div>
      </div>`;
  }

  function unlockPanel(message = '') {
    const configured = Boolean(capability?.access_key_configured);
    const ready = executionReady();
    return `<section class="card card-elevated section research-unlock">
        <div>
          <div class="item-title">${ready ? '关键词研究操作已解锁' : (configured ? '输入关键词研究操作密钥以启用执行' : '关键词研究执行尚未配置')}</div>
          <div class="item-meta">${esc(message || (ready
            ? 'ASIN 输入和分组草稿只保留在当前页面内存。'
            : configured
              ? 'ASIN 与分组输入区始终可用；输入正确的操作密钥后才能提交 SIF 查询。'
              : 'ASIN 与分组输入区已经可填写，但 Worker 尚未配置 SIF_RESEARCH_ACCESS_KEY，因此不能提交付费查询。'))}</div>
        </div>
        <div class="research-unlock-controls">
          <label><span class="field-label">操作密钥（只保存在当前页面内存）</span><input id="research-access-key" class="field" type="password" autocomplete="off" spellcheck="false" ${configured && !ready ? '' : 'disabled'} /></label>
          <button id="research-unlock" class="btn btn-primary" type="button" ${configured && !ready ? '' : 'disabled'}>${ready ? '已解锁' : '解锁执行'}</button>
        </div>
      </section>
      <div id="research-unlock-error" class="section"></div>
      ${ready ? '' : '<div class="notice warn section"><strong>执行边界：</strong>新建任务会消耗 SIF 查询额度。CORS 不能验证操作者身份，因此页面不会在没有独立操作密钥时提交查询；这不会隐藏 ASIN 输入窗口。</div>'}`;
  }

  function taxonomyPanel() {
    const rows = taxonomy?.categories || [];
    return `<section class="section"><div class="section-head"><div><h2>关键词分类法</h2><div class="section-sub">每个词只有一个主分类，长尾、核心层级和待复核是独立标签</div></div></div>
      <div class="grid grid-auto">${rows.map((item, index) => `<article class="card taxonomy-card"><div class="split-title"><div class="item-title">${index + 1}. ${esc(item.label)}</div><span class="code">${esc(item.code)}</span></div><div class="item-meta">${esc(item.description)}</div></article>`).join('')}</div>
    </section>`;
  }

  function formPanel() {
    const ready = executionReady();
    const existingGroup = selectedGroup();
    const groupOptions = groups.map(group => `<option value="${esc(group.group_id)}" ${group.group_id === researchDraft.groupId ? 'selected' : ''}>${esc(group.group_name)}${group.status === 'ARCHIVED' ? '（已归档）' : ''}</option>`).join('');
    return `<section class="card card-elevated" id="research-new-panel">
      <div class="section-head"><div><h2>新建竞品词研究</h2><div class="section-sub">先用自定义产品分组隔离词库，再输入 1–${batchAsinLimit()} 个竞品 ASIN；系统每 ${perJobAsinLimit()} 个自动建立一个任务，10 类关键词分类仍是独立维度。</div></div>${tag(ready ? 'PROTECTED ACTION' : 'EXECUTION LOCKED')}</div>
      <form id="keyword-research-form" class="research-form">
        <label><span class="field-label">产品关键词分组</span><select id="research-group-id" class="field"><option value="" ${existingGroup ? '' : 'selected'}>＋ 新建自定义分组</option>${groupOptions}</select><span class="field-help">分组用于隔离产品线词库，例如“毛绒玩具”与“厨房用品”。</span></label>
        <div class="toolbar" style="align-items:end"><button id="research-open-group-library" class="btn btn-quiet" type="button" ${existingGroup ? '' : 'disabled'}>查看当前分组词库</button><span class="field-help">同一分组可累计多个研究任务；不同分组默认隔离。</span></div>
        <div id="research-new-group-fields" class="research-form-wide grid grid-2" ${existingGroup ? 'hidden' : ''}>
          <label><span class="field-label">新分组名称</span><input id="research-group-name" class="field" maxlength="80" value="${esc(researchDraft.groupName)}" placeholder="例如：毛绒玩具" /><span class="field-help">名称可自定义；同一市场下同名分组会复用，避免词库混杂。</span></label>
          <label><span class="field-label">分组说明（可选）</span><input id="research-group-description" class="field" maxlength="300" value="${esc(researchDraft.groupDescription)}" placeholder="例如：US 站毛绒动物玩具核心竞品" /></label>
        </div>
        <label class="research-form-wide"><span class="field-label">竞品 ASIN（每行一个，也支持逗号或空格）</span><textarea id="research-asins" class="field research-textarea" rows="6" placeholder="B0XXXXXXXX&#10;B0YYYYYYYY" required>${esc(researchDraft.asins)}</textarea><span id="asin-validation" class="field-help">0 个有效 ASIN · 将按每 ${perJobAsinLimit()} 个自动分批</span></label>
        <label><span class="field-label">任务名称（可选）</span><input id="research-job-name" class="field" maxlength="80" value="${esc(researchDraft.jobName)}" placeholder="例如：毛绒玩具核心竞品 · 9 月" /></label>
        <label><span class="field-label">我方品牌（可选）</span><input id="research-own-brands" class="field" maxlength="300" value="${esc(researchDraft.ownBrands)}" placeholder="多个品牌用逗号分隔" /><span class="field-help">用于识别“自有品牌词”，不会发送给 Amazon</span></label>
        <label><span class="field-label">市场</span><select id="research-marketplace" class="field"><option value="US" ${researchDraft.marketplace === 'US' ? 'selected' : ''}>美国（US）</option></select></label>
        <label><span class="field-label">时间粒度</span><select id="research-granularity" class="field"><option value="month" ${researchDraft.granularity === 'month' ? 'selected' : ''}>月</option><option value="week" ${researchDraft.granularity === 'week' ? 'selected' : ''}>周</option><option value="day" ${researchDraft.granularity === 'day' ? 'selected' : ''}>日</option></select></label>
        <label><span class="field-label">SIF 周期锚点</span><input id="research-period" class="field" type="date" value="${esc(researchDraft.periodStart)}" required /></label>
        <div class="research-form-wide notice">数据范围是<strong>所选周期内 SIF 能观测到的竞品流量词</strong>，不是 Amazon 所有搜索查询。系统逐页读取，达到安全上限时会明确标记“已截断”。</div>
        <div class="research-form-wide toolbar"><button id="research-submit" class="btn btn-primary" type="submit" ${ready ? '' : 'disabled aria-disabled="true"'}>${ready ? '开始分析' : '等待执行授权'}</button><span class="field-help">${ready ? `每小时最多 ${capability?.limits?.max_asins_per_hour ?? 100} 个 ASIN；超过 ${perJobAsinLimit()} 个会自动拆分，同一分组最终统一去重。` : 'ASIN 与分组草稿会保留到本次页面解锁；配置并输入操作密钥后即可提交。'}</span></div>
      </form>
      <div id="research-form-message" class="section"></div>
    </section>`;
  }

  function historyPanel(jobs) {
    const groupFilterOptions = groups.map(group => `<option value="${esc(group.group_id)}" ${group.group_id === activeGroupId ? 'selected' : ''}>${esc(group.group_name)}</option>`).join('');
    return `<section class="card research-history"><div class="section-head"><div><h2>最近任务</h2><div class="section-sub">结果保存在 1122-core D1；任务和词库按产品分组隔离。</div></div><button id="research-refresh-jobs" class="btn btn-quiet" type="button">刷新</button></div>
      <label><span class="field-label">查看分组</span><select id="research-history-group-filter" class="field"><option value="">全部分组（含历史未分组）</option>${groupFilterOptions}</select></label>
      ${activeGroupId ? `<div class="toolbar section"><a class="btn btn-quiet" href="${esc(workbenchHref({ groupId: activeGroupId }))}">打开“${esc(groupLabel(groups.find(group => group.group_id === activeGroupId), '当前分组'))}”词库</a></div>` : ''}
      <div class="list">${jobs.length ? jobs.map(job => `<a class="list-item goal-card research-job-link" href="${esc(workbenchHref({ jobId: job.job_id, groupId: job.group_id || activeGroupId }))}">
        <div class="split-title"><div class="item-title">${esc(job.job_name || job.input_asins.join(' · '))}</div>${tag(job.status)}</div>
        <div class="item-meta">分组：${esc(groupLabel(job.group))} · ${fmtTime(job.created_at)} · ${job.input_asin_count} ASIN · ${fmtNumber(job.unique_keyword_count)} 唯一词</div>
      </a>`).join('') : '<div class="empty-state compact-empty"><h3>还没有研究任务</h3><p>在左侧选择或新建产品分组后，输入竞品 ASIN 创建第一份可追溯词库。</p></div>'}</div>
    </section>`;
  }

  function workspaceShell(jobs) {
    const ready = executionReady();
    const shouldLoadResult = ready && (activeJobId || activeGroupId);
    const emptyTitle = ready ? '选择分组或任务查看词库' : '输入区已就绪，等待执行授权';
    const emptyText = ready
      ? '任务完成后可以按 10 类分类、核心层级、来源 ASIN 和关键词筛选；分组用于隔离不同产品线。'
      : '填写或选择产品分组并输入 ASIN 后，配置并输入操作密钥即可提交；页面不会隐藏输入窗口。';
    const resultShell = shouldLoadResult
      ? '<div class="card"><div class="skeleton skeleton-line"></div></div>'
      : `<div class="empty-state"><div class="empty-icon">⌕</div><h2>${emptyTitle}</h2><p>${emptyText}</p></div>`;
    return `${hero(`${executionReady() ? '<button id="research-lock" class="btn" type="button">锁定执行</button>' : ''}<a class="btn" href="#/operations/competitors">竞品中心</a>`)}
      ${overviewCards()}
      ${unlockPanel(unlockMessage)}
      <div class="research-layout section"><div>${formPanel()}</div><div>${historyPanel(jobs)}</div></div>
      ${groupsLoadError ? `<div class="notice warn section"><strong>分组列表暂时不可读取：</strong>${esc(groupsLoadError)}。你仍可填写新分组名称；解锁后重试即可加载已保存分组。</div>` : ''}
      <div id="research-result" class="section">${resultShell}</div>
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

  function groupKeywordFilters() {
    return `<div class="keyword-filter-grid">
      <label><span class="field-label">搜索关键词</span><input id="group-keyword-filter-q" class="field" placeholder="输入英文词组" /></label>
      <label><span class="field-label">10 类主分类</span><select id="group-keyword-filter-category" class="field"><option value="">全部 10 类</option>${(taxonomy?.categories || []).map(item => `<option value="${esc(item.code)}">${esc(item.label)}</option>`).join('')}</select></label>
      <label><span class="field-label">排序</span><select id="group-keyword-filter-sort" class="field"><option value="search_volume">搜索量</option><option value="source_count">竞品覆盖数</option><option value="keyword">关键词 A-Z</option></select></label>
      <button id="group-keyword-filter-apply" class="btn btn-primary" type="button">应用筛选</button>
    </div>`;
  }

  function groupKeywordTable(items, total, append = false) {
    const rows = items.map(item => {
      const labels = (item.primary_categories || [item.primary_category]).map(categoryLabel).join(' / ');
      const review = item.classification_conflict ? ' · 分类待复核' : (item.needs_review ? ' · 待复核' : '');
      return `<tr>
        <td><strong>${esc(item.keyword)}</strong><div class="item-meta">${fmtTime(item.observed_at)}${review}</div></td>
        <td><span class="tag tag-info">${esc(labels || '未分类')}</span><div class="item-meta">${item.classification_conflict ? '跨任务分类不同，未静默合并' : '分组内主分类'}</div></td>
        <td><strong>${fmtNumber(item.source_job_count)}</strong><div class="item-meta">${fmtNumber(item.source_asin_count)} 个来源 ASIN</div></td>
        <td>${fmtNumber(item.search_volume)}<div class="item-meta">ABA 排名 ${fmtNumber(item.best_aba_rank)}</div></td>
        <td>${fmtPercent(item.max_traffic_share)}<div class="item-meta">得分 ${fmtNumber(item.max_traffic_score, 2)}</div></td>
        <td><div class="source-asins">${(item.source_asins || []).map(asin => `<span class="code">${esc(asin)}</span>`).join('')}</div></td>
      </tr>`;
    }).join('');
    if (append) return rows;
    return `<div class="table-wrap"><table><caption>当前“产品关键词分组”共 ${fmtNumber(total)} 个严格去重关键词。仅聚合此分组内的任务；全局词典不会把其他产品线的词带入。</caption><thead><tr><th>关键词 / 最近观察</th><th>10 类分类</th><th>覆盖任务 / ASIN</th><th>搜索量 / ABA</th><th>最高流量占比</th><th>来源 ASIN</th></tr></thead><tbody id="group-keyword-table-body">${rows || '<tr><td colspan="6">该分组尚没有已完成的关键词。</td></tr>'}</tbody></table></div>`;
  }

  function groupLibraryPanel(payload) {
    const group = payload.group || groups.find(item => item.group_id === activeGroupId) || {};
    return `<section class="result-hero card card-elevated"><div class="split-title"><div><div class="hero-eyebrow">PRODUCT GROUP LIBRARY</div><h2>${esc(groupLabel(group, '产品关键词分组'))}</h2><div class="item-meta">${esc(group.marketplace || 'US')} · ${esc(group.description || '自定义产品线；不同分组默认不互相混合。')}</div></div>${tag(group.status || 'ACTIVE')}</div>
      <div class="notice section"><strong>分组边界：</strong>这里仅汇总当前分组中的任务。十类分类仍按每个关键词展示；若同一个词在不同历史任务中出现不同分类，会明确标记为待复核。</div>
      <div class="toolbar"><a class="btn btn-quiet" href="${esc(workbenchHref())}">返回全部任务</a></div>
    </section>
    <section class="section"><div class="section-head"><div><h2>分组去重词库</h2><div class="section-sub">按当前分组跨任务严格去重，并保留任务数、来源 ASIN 与分类冲突信号。</div></div></div>${groupKeywordFilters()}<div id="group-keyword-table-shell">${groupKeywordTable(payload.items || [], payload.total || 0)}</div>${payload.next_cursor ? '<div class="toolbar group-load-more-row"><button id="group-keyword-load-more" class="btn" type="button">加载更多</button></div>' : ''}</section>`;
  }

  function resultPanel(detail, keywordPayload) {
    const job = detail.job;
    const duplicates = Number(job.duplicate_keyword_count || 0);
    const dedupeRate = job.raw_keyword_count ? duplicates / job.raw_keyword_count : 0;
    const running = !TERMINAL.has(job.status);
    const truncated = (detail.asins || []).some(row => row.is_truncated);
    const groupLink = job.group?.group_id ? `<a class="btn btn-quiet" href="${esc(workbenchHref({ groupId: job.group.group_id }))}">查看“${esc(groupLabel(job.group))}”分组词库</a>` : '';
    return `<section class="result-hero card card-elevated"><div class="split-title"><div><div class="hero-eyebrow">RESEARCH RUN</div><h2>${esc(job.job_name || job.input_asins.join(' · '))}</h2><div class="item-meta">${esc(job.marketplace)} · ${esc(job.granularity)} ${esc(job.period_start)} · ${esc(job.source_tool)}</div></div>${tag(job.status)}</div>
      <div class="item-meta section">产品关键词分组：${job.group ? `<strong>${esc(groupLabel(job.group))}</strong>${job.group.description ? ` · ${esc(job.group.description)}` : ''}` : '历史未分组（该任务不会被自动并入任何产品线词库）'}</div>
      ${running ? `<div class="research-progress"><span></span></div><div class="item-meta">${job.status === 'CLASSIFYING' ? `正在分类 ${fmtNumber(job.classified_keyword_count)} / ${fmtNumber(job.unique_keyword_count)} 个去重词` : job.status === 'CLASSIFICATION_PENDING' ? '已完成采集，正在启动分类' : '任务正在后台分页采集'}；本页将在有限时间内自动刷新。</div>` : ''}
      <div class="toolbar section"><button id="research-refresh-result" class="btn" type="button">刷新结果</button>${groupLink}<a class="btn btn-quiet" href="${esc(workbenchHref({ groupId: job.group?.group_id || '' }))}">${job.group?.group_id ? '返回分组' : '清除选择'}</a></div>
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

  async function loadGroups() {
    const marketplace = researchDraft.marketplace || 'US';
    const payload = await api(`/api/v1/competitor-keyword-groups?marketplace=${encodeURIComponent(marketplace)}`, {
      validate: value => Array.isArray(value.groups),
    });
    groups = payload.groups.filter(group => isRecord(group) && typeof group.group_id === 'string' && typeof group.group_name === 'string');
    groupsLoadError = '';
    return groups;
  }

  async function loadJobs(groupId = '') {
    const params = new URLSearchParams({ limit: '20' });
    if (groupId) params.set('group_id', groupId);
    return api(`/api/v1/competitor-keyword-runs?${params.toString()}`, {
      validate: value => Array.isArray(value.jobs) && value.jobs.every(job => isRecord(job) && typeof job.job_id === 'string'),
    });
  }

  async function loadGroupKeywords(groupId, { append = false } = {}) {
    const params = new URLSearchParams({ limit: '100' });
    const q = document.getElementById('group-keyword-filter-q')?.value.trim();
    const category = document.getElementById('group-keyword-filter-category')?.value;
    const sort = document.getElementById('group-keyword-filter-sort')?.value;
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    if (sort) params.set('sort', sort);
    if (append && groupKeywordCursor) params.set('cursor', groupKeywordCursor);
    const payload = await api(`/api/v1/competitor-keyword-groups/${encodeURIComponent(groupId)}/keywords?${params.toString()}`, {
      validate: value => isRecord(value.group) && Array.isArray(value.items) && Number.isInteger(value.total)
        && (value.next_cursor === null || typeof value.next_cursor === 'string'),
    });
    groupKeywordCursor = payload.next_cursor;
    activeGroupKeywordItems = append ? [...activeGroupKeywordItems, ...payload.items] : payload.items;
    return { ...payload, items: activeGroupKeywordItems };
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

  async function renderSelectedGroup(isCurrent) {
    if (!activeGroupId || activeJobId || !isCurrent()) return;
    const result = document.getElementById('research-result');
    if (!result) return;
    try {
      activeGroupKeywordItems = [];
      groupKeywordCursor = null;
      const payload = await loadGroupKeywords(activeGroupId);
      if (!isCurrent()) return;
      result.innerHTML = groupLibraryPanel(payload);
      bindGroupResultEvents(activeGroupId, isCurrent);
    } catch (error) {
      if (isCurrent()) result.innerHTML = `<div class="notice bad">无法读取当前分组词库：${esc(error.message)}</div>`;
    }
  }

  function bindGroupResultEvents(groupId, isCurrent) {
    document.getElementById('group-keyword-filter-apply')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.setAttribute('aria-busy', 'true');
      try {
        activeGroupKeywordItems = [];
        groupKeywordCursor = null;
        const payload = await loadGroupKeywords(groupId);
        document.getElementById('group-keyword-table-shell').innerHTML = groupKeywordTable(payload.items, payload.total);
        updateGroupLoadMore(payload.next_cursor, groupId, isCurrent);
      } catch (error) {
        document.getElementById('group-keyword-table-shell').innerHTML = `<div class="notice bad">${esc(error.message)}</div>`;
      } finally { button.removeAttribute('aria-busy'); }
    });
    updateGroupLoadMore(groupKeywordCursor, groupId, isCurrent);
  }

  function updateGroupLoadMore(cursor, groupId, isCurrent) {
    const existing = document.querySelector('.group-load-more-row');
    if (!cursor) { existing?.remove(); return; }
    const section = document.getElementById('group-keyword-table-shell')?.parentElement;
    if (!section) return;
    let row = existing;
    if (!row) {
      row = document.createElement('div');
      row.className = 'toolbar group-load-more-row';
      row.innerHTML = '<button id="group-keyword-load-more" class="btn" type="button">加载更多</button>';
      section.appendChild(row);
    }
    const button = document.getElementById('group-keyword-load-more');
    if (!button) return;
    button.onclick = async () => {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      try {
        const before = activeGroupKeywordItems.length;
        const payload = await loadGroupKeywords(groupId, { append: true });
        const body = document.getElementById('group-keyword-table-body');
        if (body) body.insertAdjacentHTML('beforeend', groupKeywordTable(payload.items.slice(before), payload.total, true));
        updateGroupLoadMore(payload.next_cursor, groupId, isCurrent);
      } catch (error) {
        const shell = document.getElementById('group-keyword-table-shell');
        if (shell) shell.insertAdjacentHTML('beforebegin', `<div class="notice bad">${esc(error.message)}</div>`);
      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    };
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

  function updateAsinValidation() {
    const asinInput = document.getElementById('research-asins');
    const validation = document.getElementById('asin-validation');
    if (!asinInput || !validation) return;
    const parsed = parseAsins(asinInput.value);
    const perJob = perJobAsinLimit();
    const batchLimit = batchAsinLimit();
    const batches = Math.ceil(parsed.valid.length / perJob);
    validation.textContent = `${parsed.valid.length} 个有效 · ${parsed.duplicateCount} 个重复 · ${parsed.invalid.length} 个无效 · ${parsed.valid.length ? `将建立 ${batches} 个任务（每个最多 ${perJob}）` : `最多 ${batchLimit} 个`}`;
    validation.className = `field-help ${parsed.invalid.length || parsed.valid.length > batchLimit ? 'bad-text' : ''}`;
  }

  function updateGroupFormState() {
    const select = document.getElementById('research-group-id');
    const fields = document.getElementById('research-new-group-fields');
    const name = document.getElementById('research-group-name');
    const description = document.getElementById('research-group-description');
    const library = document.getElementById('research-open-group-library');
    const groupId = select?.value || '';
    researchDraft.groupId = groupId;
    if (fields) fields.hidden = Boolean(groupId);
    if (name) name.disabled = Boolean(groupId);
    if (description) description.disabled = Boolean(groupId);
    if (library) library.disabled = !groupId;
  }

  function bindWorkspaceEvents(isCurrent) {
    document.getElementById('research-lock')?.addEventListener('click', () => {
      rememberResearchDraft();
      accessKey = '';
      pollGeneration += 1;
      activeJobId = null;
      activeGroupId = null;
      unlockMessage = '';
      location.hash = workbenchHref();
    });
    document.getElementById('research-refresh-jobs')?.addEventListener('click', () => {
      rememberResearchDraft();
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    const form = document.getElementById('keyword-research-form');
    const asinInput = document.getElementById('research-asins');
    asinInput?.addEventListener('input', () => {
      researchDraft.asins = asinInput.value;
      updateAsinValidation();
    });
    form?.addEventListener('input', rememberResearchDraft);
    form?.addEventListener('change', rememberResearchDraft);
    document.getElementById('research-group-id')?.addEventListener('change', () => {
      updateGroupFormState();
      rememberResearchDraft();
    });
    updateGroupFormState();
    updateAsinValidation();

    document.getElementById('research-open-group-library')?.addEventListener('click', () => {
      rememberResearchDraft();
      const groupId = document.getElementById('research-group-id')?.value || '';
      if (groupId) location.hash = workbenchHref({ groupId });
    });
    document.getElementById('research-history-group-filter')?.addEventListener('change', event => {
      rememberResearchDraft();
      const groupId = event.currentTarget.value || '';
      researchDraft.groupId = groupId;
      location.hash = workbenchHref({ groupId });
    });

    form?.addEventListener('submit', async event => {
      event.preventDefault();
      rememberResearchDraft();
      if (!executionReady()) {
        showMessage('research-form-message', capability?.access_key_configured
          ? '请先输入正确的关键词研究操作密钥，再开始分析。'
          : 'SIF_RESEARCH_ACCESS_KEY 尚未配置；ASIN 与分组草稿不会丢失，但当前不能提交查询。');
        return;
      }
      const button = document.getElementById('research-submit');
      const parsed = parseAsins(researchDraft.asins);
      const groupId = researchDraft.groupId.trim();
      const groupName = researchDraft.groupName.trim();
      const perJob = perJobAsinLimit();
      const batchLimit = batchAsinLimit();
      if (parsed.invalid.length || parsed.valid.length < 1 || parsed.valid.length > batchLimit) {
        showMessage('research-form-message', `请保留 1–${batchLimit} 个合法的 10 位 ASIN，并修正无效项。`);
        return;
      }
      if (!groupId && !groupName) {
        showMessage('research-form-message', '请选择已有产品分组，或填写一个新的分组名称。');
        return;
      }
      if (!button) return;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      const chunks = splitAsins(parsed.valid, perJob);
      showMessage('research-form-message', `将创建 ${chunks.length} 个任务；同一产品分组会在结果层统一去重。`, '');
      const createdJobs = [];
      let effectiveGroupId = groupId;
      try {
        for (let index = 0; index < chunks.length; index += 1) {
          const body = {
            asins: chunks[index],
            marketplace: researchDraft.marketplace,
            job_name: batchJobName(researchDraft.jobName, index, chunks.length),
            own_brands: researchDraft.ownBrands,
            granularity: researchDraft.granularity,
            period_start: researchDraft.periodStart,
          };
          // The first request either selects an existing group or atomically
          // creates a new one. Every later request uses that returned group id;
          // the Worker rejects ambiguous group_id + group_name payloads.
          if (effectiveGroupId) body.group_id = effectiveGroupId;
          else {
            body.group_name = groupName;
            if (researchDraft.groupDescription.trim()) body.group_description = researchDraft.groupDescription.trim();
          }
          showMessage('research-form-message', `正在创建第 ${index + 1}/${chunks.length} 个任务（${chunks[index].length} 个 ASIN）…`, '');
          const payload = await api('/api/v1/competitor-keyword-runs', {
            method: 'POST', timeoutMs: 20_000,
            validate: value => hasJobShape(value),
            body,
          });
          const createdGroupId = payload.job.group_id || payload.group?.group_id || effectiveGroupId;
          if (!createdGroupId) throw new Error('产品分组创建结果不完整，已停止后续任务。');
          effectiveGroupId = createdGroupId;
          createdJobs.push(payload.job);
        }
        researchDraft.groupId = effectiveGroupId;
        researchDraft.groupName = '';
        researchDraft.groupDescription = '';
        activeJobId = createdJobs.length === 1 ? createdJobs[0].job_id : null;
        activeGroupId = effectiveGroupId;
        location.hash = workbenchHref({ jobId: activeJobId || '', groupId: activeGroupId || '' });
      } catch (error) {
        const extra = error.validation?.invalid?.length ? ` 无效项：${error.validation.invalid.join('、')}` : '';
        if (createdJobs.length && effectiveGroupId) {
          researchDraft.groupId = effectiveGroupId;
          researchDraft.groupName = '';
          researchDraft.groupDescription = '';
          activeGroupId = effectiveGroupId;
        }
        const progress = createdJobs.length ? `已成功创建 ${createdJobs.length}/${chunks.length} 个任务；剩余 ASIN 尚未创建。` : '';
        showMessage('research-form-message', `${progress}${progress ? ' ' : ''}${error.message}${extra}`);
      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    });
  }

  function bindUnlockEvents(isCurrent) {
    document.getElementById('research-unlock')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const value = document.getElementById('research-access-key')?.value.trim() || '';
      if (!value) { showMessage('research-unlock-error', '请输入操作密钥。'); return; }
      rememberResearchDraft();
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      accessKey = value;
      try {
        await loadJobs(activeGroupId || '');
        unlockMessage = '';
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
    activeGroupId = query.get('group_id') || null;
    let jobs = [];
    groupsLoadError = '';

    if (executionReady()) {
      try {
        await loadGroups();
        if (activeGroupId && groups.some(group => group.group_id === activeGroupId)) researchDraft.groupId = activeGroupId;
      } catch (error) {
        groups = [];
        groupsLoadError = error.message;
      }
      try {
        const payload = await loadJobs(activeGroupId || '');
        jobs = payload.jobs || [];
      } catch (error) {
        if (error.status === 401) {
          accessKey = '';
          unlockMessage = '操作密钥无效或已轮换，请重新输入。';
        } else {
          groupsLoadError = groupsLoadError ? `${groupsLoadError}；任务列表：${error.message}` : `任务列表：${error.message}`;
        }
      }
    } else {
      // Do not retain a private server-side group list after the operator locks
      // the page. The editable new-group fields remain available.
      groups = [];
    }

    if (!isCurrent()) return;
    view.innerHTML = workspaceShell(jobs);
    bindUnlockEvents(isCurrent);
    bindWorkspaceEvents(isCurrent);
    if (!executionReady()) return;
    if (activeJobId) await renderSelectedJob(isCurrent);
    else if (activeGroupId) await renderSelectedGroup(isCurrent);
  }

  renderers['/operations/competitors/keywords'] = renderCompetitorKeywords;
})();
