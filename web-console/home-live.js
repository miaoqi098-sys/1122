(() => {
  const renderers = window.__1122_PAGE_RENDERERS__ ||= {};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const knownNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const fmtNumber = (value, digits = 0) => knownNumber(value) ? Number(value).toLocaleString('zh-CN', { maximumFractionDigits: digits }) : '—';
  const fmtMoney = value => knownNumber(value) ? `$${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const fmtPercent = value => knownNumber(value) ? `${(Number(value) <= 1 ? Number(value) * 100 : Number(value)).toFixed(1)}%` : '—';
  const stateKind = value => /LIVE|SUCCESS|FRESH|CONNECTED|CONFIRMED|VALIDATED/i.test(String(value)) ? 'ok' : /ERROR|FAIL|BLOCK|STALE|NONCOMPLIANT/i.test(String(value)) ? 'bad' : 'warn';
  const statusText = value => window.__1122_UI_TEXT__?.status?.(value) ?? String(value ?? '状态待确认');
  const tag = value => `<span class="tag tag-${stateKind(value)}">${esc(statusText(value))}</span>`;

  function sumKnown(items, key) {
    const values = items.map(item => item[key]).filter(knownNumber).map(Number);
    return { value: values.length ? values.reduce((total, value) => total + value, 0) : null, coverage: values.length };
  }

  function priorityCard({ route, icon, title, description, note, tone }) {
    return `<a class="priority-card priority-card-${esc(tone)}" href="#${esc(route)}">
      <span class="priority-card-icon" aria-hidden="true">${esc(icon)}</span>
      <span class="priority-card-main"><strong>${esc(title)}</strong><span>${esc(description)}</span></span>
      <span class="priority-card-note">${esc(note)}</span>
    </a>`;
  }

  function taskRows(tasks, tasksKnown) {
    if (!tasksKnown) {
      return '<div class="home-empty">任务数据尚未确认，暂不把快照或推测显示为待办。</div>';
    }
    if (!tasks.length) {
      return '<div class="home-empty">当前没有待处理任务。</div>';
    }
    return tasks.slice(0, 5).map(task => {
      const title = task.task_type || task.task_id || '未命名任务';
      const details = [task.product_id, task.updated_at || task.created_at].filter(Boolean).map(esc).join(' · ') || '未提供产品或更新时间';
      return `<div class="home-fact-row">
        <div class="home-fact-main"><div class="item-title">${esc(title)}</div><div class="item-meta">${details}</div></div>
        ${tag(task.approval_status || task.task_status || '状态待确认')}
      </div>`;
    }).join('');
  }

  function agentRows(agents, agentsKnown) {
    if (!agentsKnown) {
      return '<div class="home-empty">运行事实尚未确认，暂不把设计信息显示为在线状态。</div>';
    }
    if (!agents.length) {
      return '<div class="home-empty">当前没有可读取的运行事实。</div>';
    }
    return agents.slice(0, 5).map(agent => {
      const title = agent.agent_id || agent.component || '未命名运行组件';
      const details = [agent.component, agent.last_success_at || agent.updated_at].filter(Boolean).map(esc).join(' · ') || '未提供组件或更新时间';
      return `<div class="home-fact-row">
        <div class="home-fact-main"><div class="item-title">${esc(title)}</div><div class="item-meta">${details}</div></div>
        ${tag(agent.status || agent.freshness_status || '状态待确认')}
      </div>`;
    }).join('');
  }

  async function renderHome({ data, view, setChrome, isCurrent }) {
    setChrome('经营指挥中心', '首页 / 经营指挥中心');
    const products = Array.isArray(data.products) ? data.products : [];
    const agents = Array.isArray(data.agents) ? data.agents : [];
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    const sales = sumKnown(products, 'sales');
    const units = sumKnown(products, 'units');
    const spend = sumKnown(products, 'ad_spend');
    const profit = sumKnown(products, 'contribution_profit');
    const sessions = sumKnown(products, 'sessions');
    const orders = sumKnown(products, 'orders_count');
    const conversion = knownNumber(sessions.value) && sessions.value > 0 && knownNumber(orders.value) ? orders.value / sessions.value : null;
    const sourceStatus = data.__source?.source_status || data.source_status || {};
    const productsKnown = sourceStatus.products === 'LIVE_D1_READ';
    const tasksKnown = sourceStatus.tasks === 'LIVE_D1_READ';
    const agentsKnown = sourceStatus.agents === 'LIVE_D1_READ';
    const pendingTasks = tasks.filter(item => /pending/i.test(String(item.approval_status || item.task_status)));
    const generated = data.generated_at ? new Date(data.generated_at).toLocaleString('zh-CN') : '尚未提供';

    if (!isCurrent()) return;
    view.innerHTML = `
      <section class="home-overview" aria-labelledby="home-overview-title">
        <div class="home-overview-head">
          <div>
            <div class="home-kicker">今日经营概览</div>
            <h2 id="home-overview-title">先处理最需要判断的经营事实</h2>
            <p>首页仅保留当前可读取的汇总、优先入口和待处理事项，减少重复信息干扰。</p>
          </div>
          <div class="home-overview-meta"><span>数据更新时间</span><strong>${esc(generated)}</strong></div>
        </div>
        <div class="grid grid-4 home-kpi-grid">
          <div class="card metric-card home-metric-card">
            <div class="metric-label">销售额</div>
            <div class="metric-value">${fmtMoney(sales.value)}</div>
            <div class="metric-meta">${productsKnown ? `已覆盖 ${sales.coverage}/${products.length} 个产品 · 销量 ${fmtNumber(units.value)}` : '产品数据尚未确认'}</div>
          </div>
          <div class="card metric-card home-metric-card">
            <div class="metric-label">广告花费</div>
            <div class="metric-value">${fmtMoney(spend.value)}</div>
            <div class="metric-meta">${productsKnown ? `已覆盖 ${spend.coverage}/${products.length} 个产品 · 转化率 ${fmtPercent(conversion)}` : '产品数据尚未确认'}</div>
          </div>
          <div class="card metric-card home-metric-card">
            <div class="metric-label">贡献利润</div>
            <div class="metric-value">${fmtMoney(profit.value)}</div>
            <div class="metric-meta">${productsKnown ? `已覆盖 ${profit.coverage}/${products.length} 个产品` : '产品数据尚未确认'}</div>
          </div>
          <div class="card metric-card home-metric-card">
            <div class="metric-label">待处理事项</div>
            <div class="metric-value">${tasksKnown ? pendingTasks.length : '—'}</div>
            <div class="metric-meta">${tasksKnown ? `当前共 ${tasks.length} 条任务事实` : '任务数据尚未确认'}</div>
          </div>
        </div>
      </section>

      <section class="section home-priority" aria-labelledby="priority-title">
        <div class="section-head home-section-head">
          <div><h2 id="priority-title">今日优先入口</h2><div class="section-sub">从最常用的四个工作台开始，其他模块仍可通过左侧导航进入。</div></div>
        </div>
        <div class="workspace-grid home-priority-grid">
          ${priorityCard({ route: '/operations/daily-sop', icon: '✓', title: '每日工作流程', description: '按风险、诊断、行动与日结节奏审阅当日事实', note: '查看流程', tone: 'violet' })}
          ${priorityCard({ route: '/operations/products/promotion-plan', icon: '◫', title: '产品推广计划', description: '查看产品阶段、目标、计划完整性与证据缺口', note: '查看计划', tone: 'blue' })}
          ${priorityCard({ route: '/operations/products', icon: '◈', title: '产品中心', description: productsKnown ? `${products.length} 个产品的当前经营事实` : '等待产品数据确认', note: '查看产品', tone: 'teal' })}
          ${priorityCard({ route: '/operations/ads', icon: '▦', title: '广告工作台', description: '查看广告账户、活动与广告组的读取结果', note: '查看广告', tone: 'amber' })}
        </div>
      </section>

      <section class="section home-activity" aria-labelledby="activity-title">
        <div class="section-head home-section-head">
          <div><h2 id="activity-title">今日需要处理</h2><div class="section-sub">只展示已读取的任务和运行事实，不根据汇总指标推断行动。</div></div>
        </div>
        <div class="grid grid-2 home-activity-grid">
          <article class="card home-activity-card">
            <div class="section-head"><div><h3>待处理任务</h3><div class="section-sub">${tasksKnown ? `${pendingTasks.length} 条处于等待状态` : '任务数据待确认'}</div></div><a class="route-link" href="#/tasks">查看全部</a></div>
            <div class="home-fact-list">${taskRows(pendingTasks, tasksKnown)}</div>
          </article>
          <article class="card home-activity-card">
            <div class="section-head"><div><h3>智能体运行事实</h3><div class="section-sub">${agentsKnown ? `${agents.length} 条当前记录` : '运行事实待确认'}</div></div><a class="route-link" href="#/agents">查看全部</a></div>
            <div class="home-fact-list">${agentRows(agents, agentsKnown)}</div>
          </article>
        </div>
      </section>
    `;
  }

  renderers['/'] = renderHome;
  renderers['/command-center'] = renderHome;
})();
