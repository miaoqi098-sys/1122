(() => {
  const renderers = window.__1122_PAGE_RENDERERS__ ||= {};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const statusText = value => window.__1122_UI_TEXT__?.status?.(value) ?? String(value ?? '状态未知');
  const knownNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const fmtNumber = (value, digits = 0) => knownNumber(value) ? Number(value).toLocaleString('zh-CN', { maximumFractionDigits: digits }) : '—';
  const fmtMoney = (value, currency = 'USD') => knownNumber(value) ? new Intl.NumberFormat('zh-CN', { style: 'currency', currency: currency || 'USD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 2 }).format(Number(value)) : '—';
  const fmtPercent = value => knownNumber(value) ? `${(Number(value) <= 1 ? Number(value) * 100 : Number(value)).toFixed(1)}%` : '—';
  const stateKind = value => /LIVE|READY|ACTIVE|SUCCESS|FRESH|VERIFIED|COMPLETE|HEALTHY/i.test(String(value)) ? 'ok' : /ERROR|FAIL|BLOCK|STALE|UNAVAILABLE/i.test(String(value)) ? 'bad' : 'warn';
  const tag = value => `<span class="tag tag-${stateKind(value)}">${esc(statusText(value))}</span>`;
  const sourceStatus = data => data.__source?.source_status || data.source_status || {};
  const live = (data, key) => sourceStatus(data)[key] === 'LIVE_D1_READ';
  const sourceLabel = (data, key, fallback = '数据未接入') => sourceStatus(data)[key] || fallback;
  const productName = product => product?.title || product?.sku || product?.asin || product?.product_id || '未命名产品';
  const productRoute = product => `/products/${encodeURIComponent(product.product_id)}`;

  function sourceBar(data, entries) {
    const generated = data.generated_at ? new Date(data.generated_at).toLocaleString('zh-CN') : '—';
    return `<div class="source-bar"><span class="source-label">当前读模型</span>${entries.map(entry => tag(entry)).join('')}<span>生成：${esc(generated)}</span><span>只读</span></div>`;
  }

  function planForProduct(plans, product) {
    return plans.find(plan => String(plan?.asin || '') === String(product?.asin || '')) || null;
  }

  function tasksForProduct(tasks, product) {
    return tasks.filter(task => String(task?.product_id || '') === String(product?.product_id || ''));
  }

  function contextSummary(plan, product) {
    if (plan?.stage_assessment?.current_stage) {
      const confidence = knownNumber(plan.stage_assessment.confidence) ? ` · 置信度 ${fmtPercent(plan.stage_assessment.confidence)}` : '';
      return { stage: `${plan.stage_assessment.current_stage}${confidence}`, detail: plan.stage_assessment.reason || '阶段原因待补充' };
    }
    if (product?.stage) return { stage: product.stage, detail: '仅显示产品当前状态，尚未形成阶段评估。' };
    return { stage: 'NEEDS_DATA', detail: '尚未接入阶段事实。' };
  }

  function displayValue(value) {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (value && typeof value === 'object') return String(value.action || value.recommended_action || value.description || value.cause || value.title || value.id || '');
    return '';
  }

  function listText(items, fallback = '—') {
    const values = Array.isArray(items) ? items.map(displayValue).filter(Boolean) : [];
    return values.length ? values.map(esc).join(' · ') : fallback;
  }

  function actionList(actions, emptyMessage) {
    if (!Array.isArray(actions) || !actions.length) return `<div class="item-meta">${esc(emptyMessage)}</div>`;
    return `<div class="list">${actions.map(action => `
      <div class="list-item">
        <div class="item-title">${esc(action.action || action.recommended_action || action.action_type || '未命名动作')}</div>
        <div class="item-meta">${esc(action.why || action.reason || '理由待提供')}</div>
        <div class="item-meta">预期：${esc(action.expected_result || '—')} · 观察：${esc(action.observation_window || '—')} · 停止：${esc(action.stop_condition || '—')}</div>
        <div class="item-meta">证据：${listText(action.evidence, '—')} · 审批：${esc(action.approval_level || '—')}</div>
      </div>`).join('')}</div>`;
  }

  function planDetail(product, plan) {
    const stage = plan.stage_assessment || {};
    const constraint = plan.constraint_assessment || {};
    const strategy = plan.strategy_assessment || {};
    const goals = plan.goals || {};
    const businessConstraints = plan.constraints || {};
    const review = plan.review || {};
    const constraintLabels = {
      min_margin: '最低利润率',
      max_tacos: '最高广告成本销售比',
      min_days_of_supply: '最低库存覆盖天数',
      price_floor: '最低价格',
      price_ceiling: '最高价格'
    };
    const constraintFacts = ['min_margin', 'max_tacos', 'min_days_of_supply', 'price_floor', 'price_ceiling']
      .filter(key => businessConstraints[key] !== null && businessConstraints[key] !== undefined)
      .map(key => `${constraintLabels[key]}：${businessConstraints[key]}`);
    return `<article class="card">
      <div class="section-head"><div><h3>${esc(productName(product))}</h3><div class="section-sub">${esc(plan.plan_id || '计划编号待提供')} · ${esc(plan.asin || product.asin || '商品编号待提供')} · 下次复核 ${esc(review.next_review_date || '—')}</div></div>${tag(plan.plan_status || 'UNKNOWN')}</div>
      <div class="grid grid-3">
        <div class="card subtle"><div class="item-title">阶段评估</div><div class="item-meta">${tag(stage.current_stage || 'UNKNOWN')}</div><div class="item-meta">${esc(stage.reason || '阶段原因待提供')}</div><div class="item-meta">支持：${listText(stage.supporting_evidence, '—')}</div><div class="item-meta">缺失：${listText(stage.missing_evidence, '—')}</div></div>
        <div class="card subtle"><div class="item-title">约束评估</div><div class="item-meta">${tag(constraint.primary_constraint || 'UNKNOWN')}</div><div class="item-meta">${esc(constraint.reason || '瓶颈原因待提供')}</div><div class="item-meta">次要：${listText(constraint.secondary_constraints, '—')}</div><div class="item-meta">证据：${listText(constraint.supporting_evidence, '—')}</div></div>
        <div class="card subtle"><div class="item-title">策略评估</div><div class="item-meta strong">${esc(strategy.primary_strategy || '策略待提供')}</div><div class="item-meta">${esc(strategy.strategy_reason || '策略原因待提供')}</div><div class="item-meta">下一里程碑：${esc(strategy.next_milestone || '—')}</div><div class="item-meta">目标：${esc(goals.primary_goal || '—')}</div></div>
      </div>
      <div class="grid grid-2 section">
        <div class="card subtle"><div class="item-title">推荐动作</div>${actionList(strategy.recommended_actions, '当前计划未提供推荐动作。')}</div>
        <div class="card subtle"><div class="item-title">避免动作</div>${actionList(strategy.avoid_actions, '当前计划未提供避免动作。')}</div>
      </div>
      <div class="item-meta">经营约束：${listText(constraintFacts, '—')} · 里程碑：${listText(plan.milestones, '—')} · 冷却期：${listText(plan.action_cooldown, '—')}</div>
    </article>`;
  }

  function renderPlanRow(product, plans, tasks, planReaderLive) {
    const plan = planForProduct(plans, product);
    const stage = contextSummary(plan, product);
    const constraint = plan?.constraint_assessment;
    const strategy = plan?.strategy_assessment;
    const taskRows = tasksForProduct(tasks, product);
    const status = plan?.plan_status || (planReaderLive ? 'NO_ACTIVE_PLAN' : 'PLAN NOT INGESTED');
    const actions = Array.isArray(strategy?.recommended_actions) ? strategy.recommended_actions : [];
    return `<tr>
      <td><strong>${esc(productName(product))}</strong><div class="item-meta"><a class="route-link" href="#${productRoute(product)}">${esc(product.asin || product.product_id || '未提供商品编号')}</a> · ${esc(product.marketplace || '—')}</div></td>
      <td>${tag(status)}<div class="item-meta">${plan ? `计划 ${esc(plan.plan_id || '—')}` : '计划读模型未提供该产品记录。'}</div></td>
      <td>${tag(stage.stage)}<div class="item-meta">${esc(stage.detail)}</div></td>
      <td>${constraint?.primary_constraint ? `${tag(constraint.primary_constraint)}<div class="item-meta">${esc(constraint.reason || '原因待补充')}</div>` : `${tag('NEEDS_DATA')}<div class="item-meta">未接入主约束与次要约束。</div>`}</td>
      <td>${strategy?.primary_strategy ? `<strong>${esc(strategy.primary_strategy)}</strong><div class="item-meta">推荐动作 ${actions.length} 条 · 避免动作 ${Array.isArray(strategy.avoid_actions) ? strategy.avoid_actions.length : 0} 条</div>` : `${tag('NEEDS_DATA')}<div class="item-meta">未接入策略评估结果。</div>`}</td>
      <td>${fmtMoney(product.sales, product.currency)}<div class="item-meta">转化率 ${fmtPercent(product.conversion_rate)} · 库存覆盖 ${fmtNumber(product.coverage_days, 1)} 天 · 关联任务 ${taskRows.length}</div></td>
    </tr>`;
  }

  async function renderPromotionPlan({ data, query, view, setChrome, isCurrent }) {
    setChrome('产品推广计划', '运营 / 产品 / 产品推广计划');
    const products = Array.isArray(data.products) ? data.products : [];
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    const rawPlans = Array.isArray(data.promotion_plans) ? data.promotion_plans : [];
    const requestedProductId = query?.get('product_id') || '';
    const selectedProduct = requestedProductId ? products.find(product => String(product.product_id) === requestedProductId) : null;
    const hasPlanReader = live(data, 'promotion_plans');
    const plans = hasPlanReader ? rawPlans : [];
    const rows = selectedProduct ? [selectedProduct] : products;
    const productsLive = live(data, 'products');
    const tasksLive = live(data, 'tasks');
    const staged = products.filter(product => product.stage).length;
    const visiblePlans = rows.map(product => ({ product, plan: planForProduct(plans, product) })).filter(item => item.plan);
    const mappedPlans = visiblePlans.length;
    if (!isCurrent()) return;
    view.innerHTML = `
      ${sourceBar(data, [sourceLabel(data, 'products'), sourceLabel(data, 'promotion_plans', '计划数据未接入'), sourceLabel(data, 'tasks')])}
      <div class="hero">
        <div><div class="hero-eyebrow">产品推广计划</div><h2>产品推广计划</h2><p>以单个商品编号、单个站点、单个经营周期为单位呈现阶段、约束与策略事实。计划不是广告排期；任何行动仍需经过任务、审批和权限边界。</p></div>
        <div class="hero-actions"><a class="btn" href="#/operations/daily-sop">每日工作流程</a><a class="btn btn-primary" href="#/operations/products">产品经营中心</a></div>
      </div>
      <div class="grid grid-4 section">
        <article class="card metric-card"><div class="metric-label">可读取产品</div><div class="metric-value">${productsLive ? rows.length : '—'}</div><div class="metric-meta">${selectedProduct ? '当前按产品状态卡筛选' : '当前产品经营事实'}</div></article>
        <article class="card metric-card"><div class="metric-label">已有阶段事实</div><div class="metric-value">${productsLive ? staged : '—'}</div><div class="metric-meta">仅统计产品阶段字段，不推导置信度</div></article>
        <article class="card metric-card"><div class="metric-label">正式计划记录</div><div class="metric-value">${hasPlanReader ? mappedPlans : '—'}</div><div class="metric-meta">${hasPlanReader ? '产品推广计划读模型' : '读模型尚未接入前台数据入口'}</div></article>
        <article class="card metric-card"><div class="metric-label">关联任务</div><div class="metric-value">${tasksLive ? tasks.filter(task => rows.some(product => String(product.product_id) === String(task.product_id))).length : '—'}</div><div class="metric-meta">只显示已存在任务，不在此页创建任务</div></article>
      </div>
      ${requestedProductId && !selectedProduct ? `<div class="notice warn section">当前读模型未找到请求的产品，以下保留产品范围总览。</div>` : ''}
      ${hasPlanReader ? '' : `<div class="notice warn section"><strong>计划数据待接入：</strong>当前公共数据只提供产品当前状态和任务，尚未提供正式产品推广计划。页面不会把产品阶段、销售或任务自动解释为阶段置信度、主瓶颈、策略或推荐动作。</div>`}
      <section class="section">
        <div class="section-head"><div><h2>产品计划总览</h2><div class="section-sub">计划字段只在正式读模型提供时显示；缺失字段会明确标注为待补充数据。</div></div>${tag(hasPlanReader ? '计划读模型可用' : '待补充数据')}</div>
        <div class="table-wrap"><table><caption>${hasPlanReader ? '每条计划对应产品、站点与经营周期；尚无记录会明确显示暂无有效计划。' : '当前展示可验证的产品经营事实，便于在计划读模型接入前定位待补齐范围。'}</caption><thead><tr><th scope="col">产品 / 商品编号</th><th scope="col">计划状态</th><th scope="col">阶段评估</th><th scope="col">约束评估</th><th scope="col">策略评估</th><th scope="col">当前经营事实</th></tr></thead><tbody>${rows.length ? rows.map(product => renderPlanRow(product, plans, tasks, hasPlanReader)).join('') : `<tr><td colspan="6">${productsLive ? '当前数据存储中的产品结果为 0 条；这不是计划加载失败。' : '产品读模型本次不可用。'}</td></tr>`}</tbody></table></div>
      </section>
      ${hasPlanReader ? `<section class="section"><div class="section-head"><div><h2>已接入计划详情</h2><div class="section-sub">仅显示读模型返回的原因、证据、动作、观察窗口、停止条件和审批等级。</div></div></div><div class="grid">${visiblePlans.length ? visiblePlans.map(item => planDetail(item.product, item.plan)).join('') : '<div class="card empty-state compact-empty"><p>当前范围没有正式计划记录。</p></div>'}</div></section>` : ''}
      <section class="section">
        <div class="section-head"><div><h2>计划完整性检查</h2><div class="section-sub">以下是 V2 计划在读模型接入后应完整呈现的可追溯字段。</div></div></div>
        <div class="grid grid-3">
          <article class="card"><div class="item-title">阶段评估</div><div class="item-meta">当前阶段、置信度、原因、支持与缺失证据，以及升级或回退候选。</div><div class="capability-list">${tag('阶段')}${tag('证据')}${tag('置信度')}</div></article>
          <article class="card"><div class="item-title">约束评估</div><div class="item-meta">主约束、次要约束、置信度、支持与矛盾证据；数据不足时保持状态未知。</div><div class="capability-list">${tag('约束')}${tag('待补充数据')}</div></article>
          <article class="card"><div class="item-title">策略评估</div><div class="item-meta">策略、推荐与避免动作、预期结果、观察窗口、停止条件、审批等级和下一次复核。</div><div class="capability-list">${tag('策略')}${tag('需要审批')}</div></article>
        </div>
      </section>
      <div class="notice section"><strong>执行边界：</strong>本页面仅展示计划和经营事实。即使未来读模型出现推荐动作，外部写入仍必须走“智能体 → 任务 → 审批 → 权限 → 执行器”的受控链路；二级和三级动作不会在此页直接执行。</div>
    `;
  }

  function briefMatchesProduct(brief, product) {
    return (Array.isArray(brief?.asin_scope) && brief.asin_scope.includes(product?.asin)) || String(brief?.product_id || '') === String(product?.product_id || '');
  }

  function briefForProduct(briefs, product) {
    return briefs.find(brief => briefMatchesProduct(brief, product)) || null;
  }

  function briefDetail(brief) {
    const context = brief.strategy_context || {};
    const dataStatus = brief.data_status || {};
    const signals = Array.isArray(brief.signals) ? brief.signals : [];
    const rootCauses = Array.isArray(brief.root_cause_assessments) ? brief.root_cause_assessments : [];
    const validations = Array.isArray(brief.action_validation) ? brief.action_validation : [];
    const stageReview = brief.stage_review || {};
    return `<article class="card">
      <div class="section-head"><div><h3>${esc(brief.brief_id || '每日简报')}</h3><div class="section-sub">${esc(brief.date || '日期待提供')} · ${esc(brief.marketplace || '站点待提供')} · 数据 ${esc(statusText(dataStatus.status || 'UNKNOWN'))}</div></div>${tag(brief.overall_status || 'UNKNOWN')}</div>
      <div class="grid grid-3">
        <div class="card subtle"><div class="item-title">策略上下文</div><div class="item-meta">${tag(context.current_stage || 'UNKNOWN')}</div><div class="item-meta">目标：${esc(context.primary_goal || '—')}</div><div class="item-meta">瓶颈：${esc(context.primary_constraint || '—')}</div><div class="item-meta">策略：${esc(context.current_strategy || '—')}</div></div>
        <div class="card subtle"><div class="item-title">今日摘要</div><div class="item-meta">焦点：${listText(brief.today_focus, '—')}</div><div class="item-meta">阻塞：${listText(brief.blocked_by, '—')}</div><div class="item-meta">避免：${listText(context.avoid_actions, '—')}</div></div>
        <div class="card subtle"><div class="item-title">阶段复核</div><div class="item-meta">升级候选：${esc(stageReview.transition_candidate || context.transition_candidate || '—')}</div><div class="item-meta">回退候选：${esc(stageReview.regression_candidate || context.regression_candidate || '—')}</div><div class="item-meta">刷新策略：${esc(stageReview.strategy_refresh_required ?? '—')}</div></div>
      </div>
      <div class="grid grid-2 section">
        <div class="card subtle"><div class="item-title">信号</div><div class="list">${signals.length ? signals.map(signal => `<div class="list-item"><div class="split-title"><div class="strong">${esc(signal.signal_type || signal.signal_id || '未命名信号')}</div>${tag(signal.severity || 'UNKNOWN')}</div><div class="item-meta">${esc(signal.fact || '事实待提供')}</div><div class="item-meta">窗口：${esc(signal.evidence_window || '—')} · 证据：${listText(signal.evidence_refs, '—')}</div></div>`).join('') : '<div class="item-meta">当前简报没有信号。</div>'}</div></div>
        <div class="card subtle"><div class="item-title">根因</div><div class="list">${rootCauses.length ? rootCauses.map(assessment => `<div class="list-item"><div class="split-title"><div class="strong">${esc(assessment.primary_root_cause || assessment.signal_id || '待诊断')}</div>${tag(assessment.status || 'UNKNOWN')}</div><div class="item-meta">置信度：${fmtPercent(assessment.confidence)} · 缺失：${listText(assessment.missing_evidence, '—')}</div></div>`).join('') : '<div class="item-meta">当前简报没有根因评估。</div>'}</div></div>
      </div>
      <div class="grid grid-2 section">
        <div class="card subtle"><div class="item-title">动作</div>${actionList(brief.actions, '当前简报没有动作。')}</div>
        <div class="card subtle"><div class="item-title">验证</div><div class="list">${validations.length ? validations.map(validation => `<div class="list-item"><div class="strong">${esc(validation.action_id || '动作编号待提供')}</div><div class="item-meta">${tag(validation.validation_status || 'UNKNOWN')} · ${esc(validation.decision || validation.next_step || '验证结论待提供')}</div></div>`).join('') : '<div class="item-meta">当前简报没有待验证动作。</div>'}</div></div>
      </div>
    </article>`;
  }

  function renderBriefRow(product, briefs, tasks, briefReaderLive) {
    const brief = briefForProduct(briefs, product);
    const taskRows = tasksForProduct(tasks, product);
    const context = brief?.strategy_context;
    const signals = Array.isArray(brief?.signals) ? brief.signals : [];
    const rootCauses = Array.isArray(brief?.root_cause_assessments) ? brief.root_cause_assessments : [];
    return `<tr>
      <td><strong>${esc(productName(product))}</strong><div class="item-meta"><a class="route-link" href="#${productRoute(product)}">${esc(product.asin || product.product_id || '未提供商品编号')}</a> · ${esc(product.business_date || '日期未提供')}</div></td>
      <td>${context ? `${tag(context.current_stage || 'UNKNOWN')}<div class="item-meta">${esc(context.primary_goal || '目标未提供')}</div><div class="item-meta">${esc(context.primary_constraint || '瓶颈未提供')}</div>` : `${product.stage ? `${tag(product.stage)}<div class="item-meta">${esc(product.primary_goal || '目标未提供')} · 仅产品状态，非每日简报。</div>` : `${tag('NEEDS DATA')}<div class="item-meta">尚未接入策略上下文。</div>`}`}</td>
      <td>${brief ? `${tag(brief.overall_status || 'UNKNOWN')}<div class="item-meta">${listText(brief.today_focus, '今日焦点待提供')}</div>` : `${tag(briefReaderLive ? 'NO_BRIEF' : 'NEEDS DATA')}<div class="item-meta">未提供每日经营简报。</div>`}</td>
      <td>${brief ? `${signals.length} 条信号<div class="item-meta">${rootCauses.length} 条根因评估 · ${Array.isArray(brief.actions) ? brief.actions.length : 0} 条动作</div>` : `—<div class="item-meta">不能从任务或单日指标推导信号与根因。</div>`}</td>
      <td>${taskRows.length ? taskRows.map(task => `${tag(task.task_status || 'UNKNOWN')} ${esc(task.task_type || task.task_id || '任务')}`).join('<br>') : '—'}<div class="item-meta">${taskRows.length ? `审批：${listText(taskRows.map(task => statusText(task.approval_status || 'UNKNOWN')))}` : '当前没有关联任务事实。'}</div></td>
    </tr>`;
  }

  async function renderDailySop({ data, query, view, setChrome, isCurrent }) {
    setChrome('每日工作流程', '运营 / 每日工作流程');
    const products = Array.isArray(data.products) ? data.products : [];
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    const rawBriefs = Array.isArray(data.daily_operating_briefs) ? data.daily_operating_briefs : [];
    const requestedProductId = query?.get('product_id') || '';
    const selectedProduct = requestedProductId ? products.find(product => String(product.product_id) === requestedProductId) : null;
    const productsLive = live(data, 'products');
    const tasksLive = live(data, 'tasks');
    const briefReaderLive = live(data, 'daily_operating_briefs');
    const briefs = briefReaderLive ? rawBriefs : [];
    const rows = selectedProduct ? [selectedProduct] : products;
    const visibleBriefs = selectedProduct ? briefs.filter(brief => briefMatchesProduct(brief, selectedProduct)) : briefs;
    const staged = rows.filter(product => product.stage).length;
    const associatedTasks = tasks.filter(task => rows.some(product => String(product.product_id) === String(task.product_id)));
    const rounds = [
      ['01', '风险与数据', '确认数据新鲜度、最高优先级风险、库存、可售状态、价格、昨日销售、访问量、转化率与广告预算异常。'],
      ['02', '诊断', '先识别信号，再进行根因分析，核对瓶颈、阶段相关性、竞品、评价与商品详情页。'],
      ['03', '动作', '只基于阶段、约束与证据生成候选；先检查冷却期、变更冲突和最小样本。'],
      ['04', '日结', '复核执行与验证队列，记录明日观察项，并检查是否需刷新计划或评估阶段切换。'],
    ];
    if (!isCurrent()) return;
    view.innerHTML = `
      ${sourceBar(data, [sourceLabel(data, 'products'), sourceLabel(data, 'daily_operating_briefs', '每日简报数据未接入'), sourceLabel(data, 'tasks')])}
      <div class="hero">
        <div><div class="hero-eyebrow">每日工作流程</div><h2>每日工作流程</h2><p>每日工作流程是产品推广计划的日度决策执行层：先看策略上下文和真实事实，再处理风险、诊断原因、进入受控任务和复盘验证。</p></div>
        <div class="hero-actions"><a class="btn" href="#/operations/products/promotion-plan">产品推广计划</a><a class="btn btn-primary" href="#/tasks">任务中心</a></div>
      </div>
      <div class="grid grid-4 section">
        <article class="card metric-card"><div class="metric-label">可核对产品</div><div class="metric-value">${productsLive ? rows.length : '—'}</div><div class="metric-meta">仅展示当前可读取产品事实</div></article>
        <article class="card metric-card"><div class="metric-label">当前阶段事实</div><div class="metric-value">${productsLive ? staged : '—'}</div><div class="metric-meta">阶段字段不等于阶段置信度</div></article>
        <article class="card metric-card"><div class="metric-label">已登记任务</div><div class="metric-value">${tasksLive ? associatedTasks.length : '—'}</div><div class="metric-meta">只读任务状态与审批状态</div></article>
        <article class="card metric-card"><div class="metric-label">每日简报</div><div class="metric-value compact-value">${briefReaderLive ? briefs.length : '待补充数据'}</div><div class="metric-meta">${briefReaderLive ? '每日经营简报读模型' : '尚未物化为公共前台读模型'}</div></article>
      </div>
      ${requestedProductId && !selectedProduct ? `<div class="notice warn section">当前读模型未找到请求的产品，以下保留产品范围总览。</div>` : ''}
      ${briefReaderLive ? '' : `<div class="notice warn section"><strong>每日简报待接入：</strong>当前读模型没有正式每日经营简报。因此页面不会把产品销售、任务或单日异常自动标成信号、根因、推荐动作或验证结论。</div>`}
      <section class="section">
        <div class="section-head"><div><h2>今日四轮工作节奏</h2><div class="section-sub">按现有每日工作流程的时间逻辑呈现；步骤本身不授予外部执行权。</div></div></div>
        <div class="flow sop-flow">${rounds.map(([index, title, description]) => `<article class="flow-step"><div class="flow-index">第 ${index} 轮</div><div class="flow-title">${esc(title)}</div><div class="flow-desc">${esc(description)}</div></article>`).join('')}</div>
      </section>
      <section class="section">
        <div class="section-head"><div><h2>策略上下文与今日事实</h2><div class="section-sub">每日简报存在时显示正式策略上下文；否则仅保留产品当前状态并标明缺口。</div></div>${tag(briefReaderLive ? '每日简报读模型可用' : '待补充数据')}</div>
        <div class="table-wrap"><table><caption>高优先级信号必须先经根因分析；没有正式每日简报时，不把任务和指标伪装成诊断结果。</caption><thead><tr><th scope="col">产品 / 日期</th><th scope="col">策略上下文</th><th scope="col">今日摘要</th><th scope="col">信号 / 根因 / 动作</th><th scope="col">已存在任务</th></tr></thead><tbody>${rows.length ? rows.map(product => renderBriefRow(product, briefs, tasks, briefReaderLive)).join('') : `<tr><td colspan="5">${productsLive ? '当前数据存储中的产品结果为 0 条；这不是每日简报失败。' : '产品读模型本次不可用。'}</td></tr>`}</tbody></table></div>
      </section>
      ${briefReaderLive ? `<section class="section"><div class="section-head"><div><h2>已接入每日简报详情</h2><div class="section-sub">展示正式每日简报的信号、根因、动作、验证与阶段复核；没有数据时保持空态。</div></div></div><div class="grid">${visibleBriefs.length ? visibleBriefs.map(briefDetail).join('') : '<div class="card empty-state compact-empty"><p>当前范围没有每日经营简报记录。</p></div>'}</div></section>` : ''}
      <section class="section">
        <div class="section-head"><div><h2>进入受控任务前的必备检查</h2><div class="section-sub">每日工作流程允许“不执行”或“保持观察”；“今天不改”是合法结论。</div></div></div>
        <div class="grid grid-3">
          <article class="card"><div class="item-title">证据与解释</div><div class="item-meta">每个高优先级结论需区分事实、根因候选、支持或矛盾证据与缺失数据；行动必须带明晰原因、预期结果和观察窗口。</div></article>
          <article class="card"><div class="item-title">过度运营防护</div><div class="item-meta">检查动作冷却期、变更冲突和最小样本；不能同时改变多个核心变量而失去归因。</div></article>
          <article class="card"><div class="item-title">审批与验证</div><div class="item-meta">动作进入任务、审批与权限链路后才可能执行；完成后必须以执行前、执行后和预期结果进入验证。</div></article>
        </div>
      </section>
      <div class="notice section"><strong>执行边界：</strong>此页是工作节奏和事实审阅入口，不生成或执行亚马逊操作。二级和三级经营动作仍需人工审批；页面保留数据不足、观察和不执行作为显式状态。</div>
    `;
  }

  renderers['/operations/products/promotion-plan'] = renderPromotionPlan;
  renderers['/operations/daily-sop'] = renderDailySop;
})();
