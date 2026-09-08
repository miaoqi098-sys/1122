(() => {
  const renderers = window.__1122_PAGE_RENDERERS__ ||= {};
  const catalog = window.__1122_SYSTEM_CATALOG__ || { modules: [], repository: {}, cloudflare: {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const knownNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const fmtNumber = (value, digits = 0) => knownNumber(value) ? Number(value).toLocaleString('zh-CN', { maximumFractionDigits: digits }) : '—';
  const fmtTime = value => value ? new Date(value).toLocaleString('zh-CN') : '—';
  const statusKind = value => /LIVE|CONNECTED|SUCCESS|READY|FRESH|ACTIVE|RESOLVED|VERIFIED/i.test(String(value)) ? 'ok' : /ERROR|FAIL|BLOCK|STALE|P0|P1/i.test(String(value)) ? 'bad' : 'warn';
  const tag = value => `<span class="tag tag-${statusKind(value)}">${esc(value ?? 'UNKNOWN')}</span>`;
  const readiness = {
    LIVE_READ: ['真实只读', 'ok', 100],
    PARTIAL_LIVE: ['部分真实', 'warn', 68],
    LIVE_EMPTY: ['真实空集', 'ok', 78],
    CONTRACT_READY: ['契约就绪', 'info', 42],
    DESIGN_ONLY: ['设计态', 'neutral', 20],
    TRACKED: ['持续跟踪', 'warn', 55]
  };

  function hero(eyebrow, title, description, actions = '') {
    return `<div class="hero"><div><div class="hero-eyebrow">${esc(eyebrow)}</div><h2>${esc(title)}</h2><p>${esc(description)}</p></div>${actions ? `<div class="hero-actions">${actions}</div>` : ''}</div>`;
  }

  function moduleCard(item) {
    const [label, kind, progress] = readiness[item.readiness] || ['状态未知', 'neutral', 10];
    return `<article class="card catalog-card">
      <div class="split-title"><div class="item-title">${esc(item.label)}</div><span class="tag tag-${kind}">${label}</span></div>
      <div class="catalog-path code">${esc(item.source_path)} · ${fmtNumber(item.file_count)} files</div>
      <div class="catalog-summary">${esc(item.summary)}</div>
      <div class="readiness-bar" aria-label="${esc(label)}"><span style="width:${progress}%"></span></div>
      <div class="capability-list">${(item.live_surfaces || []).slice(0, 3).map(value => `<span class="capability">${esc(value)}</span>`).join('') || '<span class="capability">暂无真实数据面</span>'}</div>
      <div class="catalog-foot"><span class="item-meta">${esc(item.owner)}</span><a class="route-link" href="#${esc(item.route)}">打开 →</a></div>
    </article>`;
  }

  function connectorSummary(item) {
    const details = item.details || {};
    if (item.connector_id === 'amazon-ads') return `${details.profiles_count ?? '—'} Profiles · ${esc(details.region || 'NA')}`;
    if (item.connector_id === 'amazon-sp-api') return `${details.marketplace_count ?? '—'} marketplaces · ${details.product_count ?? '—'} products`;
    if (item.connector_id === 'sif') return `${details.tool_count ?? '—'} tools · ${esc(details.marketplace || '—')}`;
    if (item.connector_id === 'email') return item.error?.message || '邮箱状态未知';
    if (item.connector_id === 'cloudflare') return `${details.pages?.projectName || 'Pages'} · ${details.zone?.name || 'Zone'}`;
    return item.error?.message || details.mode || details.service || '只读健康检查';
  }

  async function renderSystemOverview({ data, view, setChrome, isCurrent }) {
    setChrome('系统地图', '系统 / GitHub 与 Cloudflare');
    const repo = catalog.repository || {};
    const cf = catalog.cloudflare || {};
    if (!isCurrent()) return;
    view.innerHTML = `
      ${hero('SYSTEM MAP', '1122 GitHub 架构与 Cloudflare 运行面', '本页把仓库中 12 个一级板块、UI 设计区、冲突库和线上基础设施放在同一张地图中。文件数为本次 Git 扫描快照；连接状态会实时刷新。', '<a class="btn btn-primary" href="#/connectors">查看连接器</a><a class="btn" href="#/data">数据健康</a>')}
      <div class="grid grid-4 section">
        <div class="card metric-card"><div class="metric-label">正式架构</div><div class="metric-value compact-value">${esc(repo.architecture || '12 + 1 + 1')}</div><div class="metric-meta">12 个一级板块 + UI + 冲突库</div></div>
        <div class="card metric-card"><div class="metric-label">Git 跟踪文件快照</div><div class="metric-value">${fmtNumber(repo.tracked_files_at_scan)}</div><div class="metric-meta">扫描基线 ${esc(catalog.scan_commit || '—')} · ${esc(catalog.scanned_at || '—')}</div></div>
        <div class="card metric-card"><div class="metric-label">Cloudflare Pages</div><div class="metric-value">${(cf.pages || []).length}</div><div class="metric-meta">${(cf.pages || []).map(esc).join(' · ')}</div></div>
        <div class="card metric-card"><div class="metric-label">Cloudflare Workers</div><div class="metric-value">${(cf.workers || []).length}</div><div class="metric-meta">均保留 workers.dev 运行入口</div></div>
      </div>
      <section class="section"><div class="section-head"><div><h2>实时连接状态</h2><div class="section-sub">并行、有超时、失败关闭；不读取 Secret 值</div></div></div><div id="system-connector-grid" class="grid grid-3"><div class="card"><div class="skeleton skeleton-line"></div></div><div class="card"><div class="skeleton skeleton-line"></div></div><div class="card"><div class="skeleton skeleton-line"></div></div></div></section>
      <section class="section"><div class="section-head"><div><h2>仓库模块盘点</h2><div class="section-sub">真实只读、部分真实、契约就绪与设计态明确分开</div></div></div><div class="grid grid-3">${(catalog.modules || []).map(moduleCard).join('')}</div></section>
      <section class="section"><div class="section-head"><div><h2>存储资源</h2><div class="section-sub">2026-09-08 Cloudflare 只读盘点</div></div></div>
        <div class="grid grid-3">
          <div class="card"><div class="split-title"><div class="item-title">D1 · ${esc(cf.d1?.name || '1122-core')}</div>${tag('RUNTIME BOUND')}</div><div class="item-meta">Worker 运行绑定可用；账户级清单权限与运行证据分开记录。</div></div>
          <div class="card"><div class="split-title"><div class="item-title">KV · ${esc((cf.kv || [])[0] || '—')}</div>${tag((cf.kv || []).length ? 'AVAILABLE' : 'UNKNOWN')}</div><div class="item-meta">当前状态缓存；允许覆盖，不作为长期历史真值。</div></div>
          <div class="card"><div class="split-title"><div class="item-title">R2 Archive</div>${tag(cf.r2?.enabled ? 'AVAILABLE' : 'NOT ENABLED')}</div><div class="item-meta">检测到的凭据名称不等于服务已启用；当前 bucket 数 ${cf.r2?.bucket_count ?? '—'}。</div></div>
        </div>
      </section>
      <div class="notice warn section"><strong>访问控制待办：</strong>现有 CORS allow-list 不是登录认证。正式承载内部经营数据前，需要为 Pages 与读取 Worker 增加 Cloudflare Access 或等价的会话鉴权；本次未在不知道允许用户身份的情况下擅自锁定站点。</div>
    `;
    const ids = Object.keys(window.__1122_CONNECTORS__?.registry || {});
    const health = await Promise.all(ids.map(id => window.__1122_CONNECTORS__.read(id)));
    if (!isCurrent()) return;
    const target = document.getElementById('system-connector-grid');
    if (!target) return;
    target.innerHTML = health.map(item => `
      <article class="card">
        <div class="split-title"><div class="item-title">${esc(window.__1122_CONNECTORS__.registry[item.connector_id]?.label || item.connector_id)}</div>${tag(item.status)}</div>
        <div class="item-meta">${esc(connectorSummary(item))}</div>
        <div class="item-meta">${fmtTime(item.checked_at)} · ${item.latency_ms ?? '—'} ms</div>
      </article>`).join('');
  }

  async function renderSelection({ data, view, setChrome, isCurrent }) {
    setChrome('选品中心', '经营 / 选品');
    if (!isCurrent()) return;
    const products = Array.isArray(data.products) ? data.products : [];
    view.innerHTML = `
      ${hero('PRODUCT DISCOVERY', '选品中心', '仓库当前只确认了一级选品板块，尚未确认二级对象与评分口径。本页展示可用输入和明确缺口，不生成虚假候选商品。')}
      <div class="notice warn section">当前阶段：设计态。尚无 SelectionCandidate / OpportunityScore 的真实读模型，因此不会把现有在售产品冒充为选品结果。</div>
      <div class="grid grid-4 section">
        <div class="card metric-card"><div class="metric-label">可用自有产品事实</div><div class="metric-value">${products.length}</div><div class="metric-meta">用于建立基线，不是候选商品</div></div>
        <div class="card metric-card"><div class="metric-label">APR 市场观察</div><div class="metric-value">${(data.apr || []).length}</div><div class="metric-meta">可作为市场信号</div></div>
        <div class="card metric-card"><div class="metric-label">AOM 方法</div><div class="metric-value">${(data.aom || []).length}</div><div class="metric-meta">可作为运营可行性参考</div></div>
        <div class="card metric-card"><div class="metric-label">候选商品</div><div class="metric-value">—</div><div class="metric-meta">Selection schema 尚未建立</div></div>
      </div>
      <div class="flow section">
        <div class="flow-step"><div class="flow-index">01</div><div class="flow-title">定义候选对象</div><div class="flow-desc">商品、类目、关键词或市场机会</div></div>
        <div class="flow-step"><div class="flow-index">02</div><div class="flow-title">证据来源</div><div class="flow-desc">SIF / Amazon / 供应链 / 成本</div></div>
        <div class="flow-step"><div class="flow-index">03</div><div class="flow-title">统一口径</div><div class="flow-desc">容量、竞争、利润、风险</div></div>
        <div class="flow-step"><div class="flow-index">04</div><div class="flow-title">Agent 判断</div><div class="flow-desc">保留依据与置信度</div></div>
        <div class="flow-step"><div class="flow-index">05</div><div class="flow-title">Task / Approval</div><div class="flow-desc">只有受控链路可以进入执行</div></div>
      </div>
    `;
  }

  async function renderInventory({ data, view, setChrome, isCurrent }) {
    setChrome('库存物流', '经营 / 运营 / 库存物流');
    const products = Array.isArray(data.products) ? data.products : [];
    const inventoryRows = products.filter(item => knownNumber(item.fulfillable_inventory) || knownNumber(item.inbound_inventory) || knownNumber(item.coverage_days));
    const fulfillable = inventoryRows.filter(item => knownNumber(item.fulfillable_inventory)).reduce((sum, item) => sum + Number(item.fulfillable_inventory), 0);
    const inbound = inventoryRows.filter(item => knownNumber(item.inbound_inventory)).reduce((sum, item) => sum + Number(item.inbound_inventory), 0);
    const coverageRows = inventoryRows.filter(item => knownNumber(item.coverage_days)).sort((a, b) => Number(a.coverage_days) - Number(b.coverage_days));
    if (!isCurrent()) return;
    view.innerHTML = `
      <div class="source-bar"><span class="source-label">库存读模型</span>${tag((data.__source?.source_status || data.source_status || {}).products || 'UNKNOWN')}<span>来自产品最新状态</span><span>不自动生成补货指令</span></div>
      ${hero('INVENTORY & LOGISTICS', '库存物流', '当前先聚合可售、在途和覆盖天数。页面只排序观察，不擅自定义补货阈值，也不执行库存动作。', '<a class="btn" href="#/operations/products">返回产品</a>')}
      <div class="grid grid-4 section">
        <div class="card metric-card"><div class="metric-label">有库存字段的产品</div><div class="metric-value">${inventoryRows.length}</div><div class="metric-meta">全部产品 ${products.length}</div></div>
        <div class="card metric-card"><div class="metric-label">FBA 可售合计</div><div class="metric-value">${fmtNumber(fulfillable)}</div><div class="metric-meta">按最新状态求和</div></div>
        <div class="card metric-card"><div class="metric-label">Inbound 合计</div><div class="metric-value">${fmtNumber(inbound)}</div><div class="metric-meta">按最新状态求和</div></div>
        <div class="card metric-card"><div class="metric-label">最低可见覆盖</div><div class="metric-value">${coverageRows.length ? fmtNumber(coverageRows[0].coverage_days, 1) : '—'}</div><div class="metric-meta">days · 仅排序观察</div></div>
      </div>
      <section class="section"><div class="section-head"><div><h2>覆盖天数升序</h2><div class="section-sub">没有业务确认的阈值，不自动打“缺货风险”标签</div></div></div>
        <div class="table-wrap"><table><caption>${inventoryRows.length} 个产品具有至少一个库存字段。</caption><thead><tr><th scope="col">产品 / ASIN</th><th scope="col">FBA 可售</th><th scope="col">Inbound</th><th scope="col">Coverage</th><th scope="col">观察时间</th></tr></thead><tbody>
          ${coverageRows.length ? coverageRows.map(item => `<tr><td><a class="route-link" href="#/products/${encodeURIComponent(item.product_id)}">${esc(item.title || item.asin)}</a><div class="item-meta">${esc(item.asin || '')}</div></td><td>${fmtNumber(item.fulfillable_inventory)}</td><td>${fmtNumber(item.inbound_inventory)}</td><td>${fmtNumber(item.coverage_days, 1)} days</td><td>${esc(item.state_observed_at || item.business_date || '—')}</td></tr>`).join('') : '<tr><td colspan="5">暂无可验证覆盖天数。</td></tr>'}
        </tbody></table></div>
      </section>
    `;
  }

  async function renderCompetitors({ view, setChrome, isCurrent }) {
    setChrome('竞品中心', '经营 / 运营 / 竞品');
    view.innerHTML = `${hero('COMPETITOR INTELLIGENCE', '竞品中心', 'SIF 连接状态与竞品实体数据分开。连接器在线不代表已经把竞品结果写入当前读模型。')}<div id="competitor-status" class="section"><div class="card"><div class="skeleton skeleton-line"></div></div></div>`;
    const health = await window.__1122_CONNECTORS__.read('sif');
    if (!isCurrent()) return;
    const target = document.getElementById('competitor-status');
    if (!target) return;
    target.innerHTML = `
      <div class="grid grid-3">
        <div class="card metric-card"><div class="metric-label">SIF 连接</div><div class="metric-value compact-value">${esc(health.status)}</div><div class="metric-meta">${fmtTime(health.checked_at)}</div></div>
        <div class="card metric-card"><div class="metric-label">可发现工具</div><div class="metric-value">${health.details?.tool_count ?? '—'}</div><div class="metric-meta">${esc(health.details?.server || '—')}</div></div>
        <div class="card metric-card"><div class="metric-label">当前竞品实体</div><div class="metric-value">—</div><div class="metric-meta">尚无 CompetitorEntity 读模型</div></div>
      </div>
      <div class="notice warn section">下一步需要先确定竞品对象、观察时间、来源与字段契约，再把 SIF 返回写入 D1；本页不会把“34 个工具”误报成“34 个竞品”。</div>`;
  }

  async function renderOffsite({ view, setChrome, isCurrent }) {
    setChrome('站外推广', '经营 / 运营 / 站外推广');
    if (!isCurrent()) return;
    view.innerHTML = `
      ${hero('OFFSITE GROWTH', '站外推广', '仓库已保留品牌官网与独立站工程、API 资质官网和站外推广结构；当前尚无活动、达人或归因的统一实时读模型。')}
      <div class="notice warn section">当前阶段：设计与历史工程已保留，业务数据待接入。页面不会用网站访问成功代替站外归因成功。</div>
      <div class="grid grid-3 section">
        <article class="card"><div class="item-title">品牌官网与独立站</div><div class="item-meta">已有 API 资质官网工程及历史页面入口。</div></article>
        <article class="card"><div class="item-title">活动与达人</div><div class="item-meta">待建立 Campaign / Creator / Placement 对象。</div></article>
        <article class="card"><div class="item-title">归因与结果</div><div class="item-meta">待接入 Attribution、Amazon 结果与成本事实。</div></article>
      </div>
    `;
  }

  async function renderSandbox({ data, view, setChrome, isCurrent }) {
    setChrome('沙盘演练', '自动化 / 沙盘演练');
    const runs = Array.isArray(data.sandbox_runs) ? data.sandbox_runs : [];
    const live = (data.__source?.source_status || data.source_status || {}).d1 === 'LIVE_D1_READ';
    if (!isCurrent()) return;
    view.innerHTML = `
      ${hero('SCENARIO LAB', '我方产品经营沙盘', '沙盘以 LIVE_ASIN_DIGITAL_TWIN 为唯一模拟主体，比较 R0 = NO_RESPONSE 与 Low / Base / High 响应包；结果只作为 Agent-1 的策略证据。')}
      <div class="grid grid-3 section">
        <div class="card metric-card"><div class="metric-label">Simulation Runs</div><div class="metric-value">${live ? runs.length : '—'}</div><div class="metric-meta">${live && runs.length === 0 ? 'D1 当前确认为 0' : '当前读模型'}</div></div>
        <div class="card metric-card"><div class="metric-label">模拟主体</div><div class="metric-value compact-value">OUR PRODUCT</div><div class="metric-meta">不对真实竞品生成执行步骤</div></div>
        <div class="card metric-card"><div class="metric-label">执行权限</div><div class="metric-value compact-value">PERMANENTLY OFF</div><div class="metric-meta">simulation_only = true</div></div>
      </div>
      <div class="flow section">
        <div class="flow-step"><div class="flow-index">01</div><div class="flow-title">Frozen Twin</div><div class="flow-desc">冻结产品事实版本</div></div>
        <div class="flow-step"><div class="flow-index">02</div><div class="flow-title">Scenario</div><div class="flow-desc">压力与经营变量</div></div>
        <div class="flow-step"><div class="flow-index">03</div><div class="flow-title">R0 Baseline</div><div class="flow-desc">什么都不做的反事实</div></div>
        <div class="flow-step"><div class="flow-index">04</div><div class="flow-title">Response Packages</div><div class="flow-desc">Low / Base / High</div></div>
        <div class="flow-step"><div class="flow-index">05</div><div class="flow-title">Revised Strategy</div><div class="flow-desc">只输出策略证据</div></div>
      </div>
      <div class="notice section">尚无 SimulationRun 时不显示模拟结果，也不以静态示例冒充真实运行。</div>
    `;
  }

  async function renderGovernance({ data, view, setChrome, isCurrent }) {
    setChrome('系统政策边界', '系统 / 治理与权限');
    if (!isCurrent()) return;
    const booleanState = value => value === true ? 'TRUE' : value === false ? 'FALSE' : 'UNKNOWN';
    view.innerHTML = `
      ${hero('GOVERNANCE', '谁可以做什么，哪些动作必须停下', '系统政策边界管理 1122 自身的权限、审批与 fail-closed 规则；Amazon 平台政策证据位于独立的经营边界中心。', '<a class="btn" href="#/amazon-boundary">Amazon 经营边界</a>')}
      <div class="grid grid-4 section">
        <div class="card metric-card"><div class="metric-label">Read only</div><div class="metric-value compact-value">${booleanState(data.read_only)}</div><div class="metric-meta">当前 bootstrap 声明</div></div>
        <div class="card metric-card"><div class="metric-label">Execution authorized</div><div class="metric-value compact-value">${booleanState(data.execution_authorized)}</div><div class="metric-meta">未知也按未授权处理</div></div>
        <div class="card metric-card"><div class="metric-label">Production write</div><div class="metric-value compact-value">${booleanState(data.production_write_authorized)}</div><div class="metric-meta">公开 UI 不持有写权限</div></div>
        <div class="card metric-card"><div class="metric-label">默认原则</div><div class="metric-value compact-value">FAIL CLOSED</div><div class="metric-meta">不把未知当成功</div></div>
      </div>
      <div class="flow section">
        <div class="flow-step"><div class="flow-index">01</div><div class="flow-title">Agent 判断</div><div class="flow-desc">保留依据与版本</div></div>
        <div class="flow-step"><div class="flow-index">02</div><div class="flow-title">Decision</div><div class="flow-desc">形成结构化决定</div></div>
        <div class="flow-step"><div class="flow-index">03</div><div class="flow-title">TaskDraft</div><div class="flow-desc">尚未授权执行</div></div>
        <div class="flow-step"><div class="flow-index">04</div><div class="flow-title">Approval / Permission</div><div class="flow-desc">人工与权限双门</div></div>
        <div class="flow-step"><div class="flow-index">05</div><div class="flow-title">Executor / Outcome</div><div class="flow-desc">受控执行与回写</div></div>
      </div>
      <div class="notice bad section"><strong>身份认证缺口：</strong>CORS 只能控制浏览器跨域，不能替代登录。Cloudflare Access 的允许身份尚未由用户确认，因此本次保留现状并将其列为上线前安全门槛。</div>
    `;
  }

  async function renderSkills({ data, view, setChrome, isCurrent }) {
    setChrome('技能中心', '智能与知识 / 技能');
    if (!isCurrent()) return;
    view.innerHTML = `
      ${hero('CAPABILITY REGISTRY', '技能、工具、连接器与 Agent 各自负责什么', '仓库已经明确 Skill ≠ Tool ≠ Connector ≠ Agent。当前技能目录以契约为主，尚无可实时枚举的 Skill Registry API。')}
      <div class="grid grid-4 section">
        <article class="card"><div class="item-title">Agent</div><div class="item-meta">“谁来判断”：Agent-1 至 Agent-13。当前运行事实 ${(data.agents || []).length} 条。</div></article>
        <article class="card"><div class="item-title">Skill</div><div class="item-meta">“会什么”：可复用能力单元与输入/输出契约。</div></article>
        <article class="card"><div class="item-title">Tool</div><div class="item-meta">“怎样执行”：实际调用机制、权限和审计。</div></article>
        <article class="card"><div class="item-title">Connector</div><div class="item-meta">“接了什么”：Amazon、Ads、SIF、Cloudflare 等外部系统。</div></article>
      </div>
      <div class="notice warn section">Skill Registry、工具调用次数和权限审计尚未进入公共读模型，因此此页不显示伪造的“可用技能数”。</div>
    `;
  }

  async function renderMemory({ view, setChrome, isCurrent }) {
    setChrome('记忆中心', '智能与知识 / 记忆');
    if (!isCurrent()) return;
    view.innerHTML = `
      ${hero('OBJECT HISTORY', '具体对象过去发生了什么', '记忆保存产品、任务、决策、实验、操作与结果的对象级历史；知识保存可复用认知，数据保存系统事实。')}
      <div class="grid grid-3 section">
        <article class="card"><div class="item-title">产品时间线</div><div class="item-meta">阶段、经营事实、事件与操作历史。</div></article>
        <article class="card"><div class="item-title">决策与任务</div><div class="item-meta">为什么判断、进入了哪个 Task、谁批准。</div></article>
        <article class="card"><div class="item-title">结果与学习</div><div class="item-meta">Outcome、Validation 与后续知识沉淀。</div></article>
      </div>
      <div class="notice warn section">当前没有 Memory Timeline API。仓库已定义语义边界，但网页不会把 D1 最新状态误称为完整记忆。</div>
    `;
  }

  async function renderData({ data, view, setChrome, isCurrent }) {
    setChrome('数据中心', '系统 / 数据');
    const status = data.__source?.source_status || data.source_status || {};
    const sources = Array.isArray(status.sources) ? status.sources : [];
    const cf = catalog.cloudflare || {};
    if (!isCurrent()) return;
    view.innerHTML = `
      ${hero('DATA PLANE', '事实、缓存、档案与来源追溯', '数据中心分别展示传输可达、D1 读取、来源新鲜度和语义验证；一个维度成功不会替代其他维度。')}
      <div class="grid grid-4 section">
        <div class="card metric-card"><div class="metric-label">WARM · D1</div><div class="metric-value compact-value">${esc(status.d1 || 'UNKNOWN')}</div><div class="metric-meta">1122-core · 38 tables（审计快照）</div></div>
        <div class="card metric-card"><div class="metric-label">HOT · KV</div><div class="metric-value">${(cf.kv || []).length}</div><div class="metric-meta">${esc((cf.kv || [])[0] || 'namespace unknown')}</div></div>
        <div class="card metric-card"><div class="metric-label">COLD · R2</div><div class="metric-value compact-value">${cf.r2?.enabled ? 'AVAILABLE' : 'NOT ENABLED'}</div><div class="metric-meta">凭据配置不等于 bucket 可用</div></div>
        <div class="card metric-card"><div class="metric-label">语义验证</div><div class="metric-value compact-value">${data.live_data_verified === true ? 'VERIFIED' : 'PENDING'}</div><div class="metric-meta">独立于 D1 读取成功</div></div>
      </div>
      <section class="section"><div class="section-head"><div><h2>来源与新鲜度</h2><div class="section-sub">${sources.length} 个当前来源事实</div></div></div>
        <div class="table-wrap"><table><caption>连接状态、最近成功与 freshness 原样分列；异常语义不被整体 LIVE 覆盖。</caption><thead><tr><th scope="col">Source</th><th scope="col">Dataset</th><th scope="col">Status</th><th scope="col">Freshness</th><th scope="col">Last success</th><th scope="col">Parser</th></tr></thead><tbody>
          ${sources.length ? sources.map(item => `<tr><td><strong>${esc(item.source_name || item.source_key)}</strong><div class="item-meta code">${esc(item.source_key)}</div></td><td>${esc(item.dataset || '—')}</td><td>${tag(item.status)}</td><td>${tag(item.freshness_status)}</td><td>${esc(item.last_success_at || '—')}</td><td class="code">${esc(item.parser_version || '—')}</td></tr>`).join('') : '<tr><td colspan="6">当前 bootstrap 未返回来源明细。</td></tr>'}
        </tbody></table></div>
      </section>
      <div class="notice warn section">已发现需要治理的新鲜度语义：SIF 连接实时可用，但已入库来源的最近成功时间可能更早；Finance 仍处于语义校验待完成。页面不把它们合并成一个“全部正常”。</div>
    `;
  }

  async function renderSpApi({ view, setChrome, isCurrent }) {
    setChrome('Amazon SP-API 连接', '系统 / 对外连接 / Amazon SP-API');
    view.innerHTML = `${hero('CONNECTOR DETAIL', 'Amazon SP-API', '正在进行只读连接检查。不会读取或显示 LWA Secret、Refresh Token 或 Access Token。', '<a class="btn" href="#/connectors">返回连接中心</a>')}<div id="spapi-detail" class="section"><div class="card"><div class="skeleton skeleton-line"></div></div></div>`;
    const health = await window.__1122_CONNECTORS__.read('amazon-sp-api');
    if (!isCurrent()) return;
    const details = health.details || {};
    const target = document.getElementById('spapi-detail');
    if (!target) return;
    target.innerHTML = `
      <div class="grid grid-4">
        <div class="card metric-card"><div class="metric-label">连接状态</div><div class="metric-value compact-value">${esc(health.status)}</div><div class="metric-meta">${fmtTime(health.checked_at)}</div></div>
        <div class="card metric-card"><div class="metric-label">区域</div><div class="metric-value compact-value">${esc(details.region || '—')}</div><div class="metric-meta">Amazon SP-API NA</div></div>
        <div class="card metric-card"><div class="metric-label">Marketplaces</div><div class="metric-value">${details.marketplace_count ?? '—'}</div><div class="metric-meta">参与状态由 API 返回</div></div>
        <div class="card metric-card"><div class="metric-label">产品身份</div><div class="metric-value">${details.product_count ?? '—'}</div><div class="metric-meta">${details.product_ready ? 'READY' : 'UNKNOWN'} · ${fmtTime(details.updated_at)}</div></div>
      </div>
      <section class="section"><div class="section-head"><div><h2>Marketplaces</h2><div class="section-sub">只展示非敏感账户参与信息</div></div></div><div class="grid grid-4">${(details.marketplaces || []).map(item => `<div class="card"><div class="split-title"><div class="item-title">${esc(item.countryCode)}</div>${tag(item.participating ? 'PARTICIPATING' : 'INACTIVE')}</div><div class="item-meta code">${esc(item.marketplaceId)}</div></div>`).join('') || '<div class="card empty-state compact-empty"><p>未返回 Marketplace 明细。</p></div>'}</div></section>
      <div class="notice section">Capabilities：${(health.capabilities || []).map(esc).join(' · ') || '—'}。当前页面只读。</div>
    `;
  }

  async function renderAmazonBoundary({ data, view, setChrome, isCurrent }) {
    setChrome('亚马逊经营边界', '情报 / 亚马逊经营边界');
    if (!isCurrent()) return;
    view.innerHTML = `
      ${hero('AMAZON BOUNDARY INTELLIGENCE', '观察、方法与政策证据必须分层', 'APR 记录市场发生了什么，AOM 提供正向运营方法，APB 保存政策与边界证据；三者都不直接获得生产执行权。')}
      <div class="grid grid-3 section">
        <a class="card goal-card" href="#/amazon-boundary/apr"><div class="metric-label">APR · Market Pattern</div><div class="metric-value">${(data.apr || []).length}</div><div class="goal-title">市场玩法探索</div><div class="goal-desc">观察结构、效果、持续性、信号和对我方价值。</div></a>
        <a class="card goal-card" href="#/amazon-boundary/aom"><div class="metric-label">AOM · Operating Method</div><div class="metric-value">${(data.aom || []).length}</div><div class="goal-title">正向运营方法</div><div class="goal-desc">目标、条件、步骤、成本、影响与衡量指标。</div></a>
        <a class="card goal-card" href="#/amazon-boundary/apb"><div class="metric-label">APB · Policy Evidence</div><div class="metric-value">${(data.apb || []).length}</div><div class="goal-title">政策与边界证据</div><div class="goal-desc">官方证据、Policy Diff、Observed / Expected State。</div></a>
      </div>
    `;
  }

  async function renderUiDesign({ view, setChrome, isCurrent }) {
    setChrome('UI 设计与契约', '系统 / UI 设计');
    const modules = window.__1122_REGISTRY__?.modules || [];
    const primary = modules.filter(item => !item.parent && item.kind !== 'support');
    if (!isCurrent()) return;
    view.innerHTML = `
      ${hero('UI CONTRACTS', '以 Navigation Registry V2 为页面真值', '终端导航对应 12 个一级业务/系统板块；UI 设计与冲突库是支撑入口，不占用日常经营主导航。')}
      <div class="grid grid-4 section">
        <div class="card metric-card"><div class="metric-label">主导航</div><div class="metric-value">${primary.length - 1}</div><div class="metric-meta">不含经营指挥中心</div></div>
        <div class="card metric-card"><div class="metric-label">注册路由对象</div><div class="metric-value">${modules.length}</div><div class="metric-meta">含子路由与支撑入口</div></div>
        <div class="card metric-card"><div class="metric-label">动态产品路由</div><div class="metric-value">2</div><div class="metric-meta">状态卡 / 政策影响</div></div>
        <div class="card metric-card"><div class="metric-label">路由调度器</div><div class="metric-value compact-value">SINGLE</div><div class="metric-meta">拒绝旧异步请求覆盖新页面</div></div>
      </div>
      <section class="section"><div class="section-head"><div><h2>正式视图契约</h2><div class="section-sub">仓库中的 schema 与 aggregator</div></div></div><div class="grid grid-3">
        <div class="card"><div class="item-title">HomeCommandCenterView</div><div class="item-meta">首页经营聚合与降级规则。</div></div>
        <div class="card"><div class="item-title">ProductStatusCardView</div><div class="item-meta">单产品状态、目标、经营维度与关联入口。</div></div>
        <div class="card"><div class="item-title">ProductPolicyImpactView</div><div class="item-meta">商品与 APR / AOM / APB 的影响映射。</div></div>
        <div class="card"><div class="item-title">APRExplorationView</div><div class="item-meta">市场观察与边界信号。</div></div>
        <div class="card"><div class="item-title">PositiveOperatingMethodView</div><div class="item-meta">正向方法与适用条件。</div></div>
        <div class="card"><div class="item-title">AmazonPolicyBoundaryView</div><div class="item-meta">政策证据与边界结论。</div></div>
      </div></section>
    `;
  }

  async function renderConflicts({ view, setChrome, isCurrent }) {
    setChrome('系统冲突问题库', '系统 / 冲突闭环');
    if (!isCurrent()) return;
    const unresolved = [
      ['CONFLICT-A1-TARGET-001', 'P1', '目标层级概念命名重叠'],
      ['CONFLICT-A1-S04-001', 'P1', '排序因素未进入 Skill 与 DecisionItem'],
      ['CONFLICT-A1-S06-001', 'P1', '硬约束与执行资格缺少映射'],
      ['CONFLICT-A1-SELECTOR-001', 'P1', 'FinalDecision 生命周期未进入输出契约'],
      ['CONFLICT-A1-CONCURRENCY-001', 'P2', '多 DecisionItem 并发承载对象缺失'],
      ['CONFLICT-A1-TEMPLATE-001', 'P2', '最小证据集与模板权威关系未固化'],
      ['CONFLICT-A1-S10-001', 'P2', 'Strategy change_type 与 relation 未分离']
    ];
    view.innerHTML = `
      ${hero('CONFLICT REGISTER', '问题不会因历史“已验收”而消失', '冲突库保存从发现、分析、修复、验证到关闭的全过程；真正修复仍发生在所属正式模块。')}
      <div class="grid grid-4 section">
        <div class="card metric-card"><div class="metric-label">冲突总数</div><div class="metric-value">13</div><div class="metric-meta">Git 仓库索引快照</div></div>
        <div class="card metric-card"><div class="metric-label">P1 / P2</div><div class="metric-value compact-value">7 / 6</div><div class="metric-meta">P0 = 0 · P3 = 0</div></div>
        <div class="card metric-card"><div class="metric-label">已解决</div><div class="metric-value">5</div><div class="metric-meta">保留记录与验证证据</div></div>
        <div class="card metric-card"><div class="metric-label">待验证 / 待解决</div><div class="metric-value compact-value">1 / 7</div><div class="metric-meta">仍需闭环</div></div>
      </div>
      <section class="section"><div class="section-head"><div><h2>已确认待解决</h2><div class="section-sub">当前总表中的 7 条开放问题</div></div></div><div class="table-wrap"><table><caption>此表为仓库冲突索引的网页摘要，不是实时工单系统。</caption><thead><tr><th scope="col">Conflict ID</th><th scope="col">级别</th><th scope="col">主题</th><th scope="col">状态</th></tr></thead><tbody>${unresolved.map(item => `<tr><td class="code">${item[0]}</td><td>${tag(item[1])}</td><td>${item[2]}</td><td>${tag('已确认')}</td></tr>`).join('')}</tbody></table></div></section>
    `;
  }

  renderers['/selection'] = renderSelection;
  renderers['/operations/inventory-logistics'] = renderInventory;
  renderers['/operations/competitors'] = renderCompetitors;
  renderers['/operations/offsite'] = renderOffsite;
  renderers['/sandbox'] = renderSandbox;
  renderers['/governance'] = renderGovernance;
  renderers['/skills'] = renderSkills;
  renderers['/memory'] = renderMemory;
  renderers['/data'] = renderData;
  renderers['/connectors/amazon-sp-api'] = renderSpApi;
  renderers['/amazon-boundary'] = renderAmazonBoundary;
  renderers['/system/overview'] = renderSystemOverview;
  renderers['/system/ui-design'] = renderUiDesign;
  renderers['/system/conflicts'] = renderConflicts;
})();
