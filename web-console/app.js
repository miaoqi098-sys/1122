(() => {
  const data = window.__1122_DATA__ || {navigation:[],apr:[],aom:[],apb:[],domains:[]};
  const nav = document.getElementById('primary-nav');
  const view = document.getElementById('view');
  const pageTitle = document.getElementById('page-title');
  const breadcrumb = document.getElementById('breadcrumb');
  const sidebar = document.getElementById('sidebar');
  const search = document.getElementById('global-search');

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const tag = (text, kind='neutral') => `<span class="tag tag-${kind}">${esc(text)}</span>`;
  const kindFor = v => /VERIFIED|ALLOWED|LOW|POSITIVE|CONFIRMED|success/i.test(v)?'ok':/NONCOMPLIANT|HIGH|BLOCK|failed/i.test(v)?'bad':/SEEDED|DISCOVERY|MEDIUM|UNKNOWN|CONDITIONAL/i.test(v)?'warn':'info';
  const route = () => (location.hash || '#/command-center').replace(/^#/,'');
  const go = r => { location.hash = r.startsWith('#') ? r.slice(1) : r; };

  function renderNav(){
    nav.innerHTML = data.navigation.map(item => {
      const children = (item.children||[]).map(c => `<button class="nav-child" data-route="${esc(c.route)}">${esc(c.label)}</button>`).join('');
      return `<div class="nav-group"><button class="nav-item" data-route="${esc(item.route)}"><span class="nav-icon">${esc(item.icon||'•')}</span><span class="nav-label">${esc(item.label)}</span>${item.badge?`<span class="nav-badge">${esc(item.badge)}</span>`:''}</button>${children}</div>`;
    }).join('');
    nav.querySelectorAll('[data-route]').forEach(el=>el.addEventListener('click',()=>go(el.dataset.route)));
  }

  function setActive(){
    const r = '#'+route();
    nav.querySelectorAll('[data-route]').forEach(el=>el.classList.toggle('active', r===el.dataset.route || (el.classList.contains('nav-item') && r.startsWith(el.dataset.route+'/'))));
  }

  const metric = (label,value,meta='') => `<div class="card metric-card"><div class="metric-label">${esc(label)}</div><div class="metric-value">${esc(value)}</div><div class="metric-meta">${esc(meta)}</div></div>`;
  const section = (title,sub,body) => `<section class="section"><div class="section-head"><div><h2>${esc(title)}</h2>${sub?`<div class="section-sub">${esc(sub)}</div>`:''}</div></div>${body}</section>`;

  function home(){
    pageTitle.textContent='经营指挥中心'; breadcrumb.textContent='首页 / 经营指挥中心';
    const seeded = data.domains.filter(x=>x[3]==='SEEDED').length;
    view.innerHTML = `
      <div class="hero"><div><h2>今天先看经营结果，再看系统动作</h2><p>APR、AOM、APB 已进入正式前台。当前页面使用仓库只读快照，后续可直接替换为 D1/API 数据源。</p></div><div class="hero-actions"><button class="btn btn-primary" data-go="/amazon-boundary/apr">查看最新 APR</button><button class="btn" data-go="/amazon-boundary/aom">查看 AOM</button></div></div>
      <div class="grid grid-4 section">${metric('APR 已发现',data.apr.length,'市场玩法探索结果')}${metric('AOM 方法',data.aom.length,'当前正式运营方法')}${metric('APB 记录',data.apb.length,'政策/边界证据')}${metric('政策域已 Seeded',`${seeded}/18`,'其余继续 Discovery')}</div>
      ${section('最新 APR 探索','市场真实玩法与边界模式', `<div class="grid grid-2">${data.apr.slice(0,4).map(x=>`<div class="card"><div class="split-title"><span class="code">${esc(x.apr_id)}</span>${tag(x.policy_relation,kindFor(x.policy_relation))}</div><div class="item-title" style="margin-top:10px">${esc(x.pattern_name_cn)}</div><div class="item-meta">目标：${esc(x.business_goal)}</div><div class="item-meta">${esc(x.observed_effect)}</div><div class="kpi-row" style="margin-top:10px">${tag(x.business_value_signal,kindFor(x.business_value_signal))}${tag(x.confidence,kindFor(x.confidence))}</div></div>`).join('')}</div>`)}
      ${section('AOM 推荐方法','运营可直接理解的正向方法', `<div class="grid grid-3">${data.aom.map(x=>`<div class="card goal-card" data-go="/amazon-boundary/aom"><div class="code muted">${esc(x.method_id)}</div><div class="goal-title">${esc(x.method_name_cn)}</div><div class="goal-desc">${esc(x.objective)}</div><div class="kpi-row" style="margin-top:12px">${tag(x.policy_status,kindFor(x.policy_status))}${tag(x.risk_level,kindFor(x.risk_level))}</div></div>`).join('')}</div>`)}
      ${section('快捷入口','从经营问题直接进入模块', `<div class="grid grid-4"><div class="card goal-card" data-go="/operations/products"><div class="goal-icon">▦</div><div class="goal-title">产品状态</div><div class="goal-desc">查看单品经营、任务、政策与 APR 影响</div></div><div class="card goal-card" data-go="/agents"><div class="goal-icon">✦</div><div class="goal-title">Agent</div><div class="goal-desc">查看 Agent-1~13 分析与决策链</div></div><div class="card goal-card" data-go="/tasks"><div class="goal-icon">☑</div><div class="goal-title">任务中心</div><div class="goal-desc">查看 Draft / Approval / Permission / Outcome</div></div><div class="card goal-card" data-go="/sandbox"><div class="goal-icon">◇</div><div class="goal-title">沙盘演练</div><div class="goal-desc">围绕产品数字孪生做经营推演</div></div></div>`)}
    `;
    bindGo();
  }

  function apr(){
    pageTitle.textContent='APR 市场玩法探索'; breadcrumb.textContent='亚马逊经营边界探索 / APR';
    view.innerHTML = `<div class="hero"><div><h2>APR：Amazon 真实市场玩法雷达</h2><p>重点记录“市场上发生了什么、为什么可能有效、持续多久、怎么识别、对我方有什么价值”。APR 是非执行参考层。</p></div></div>${section('探索结果',`${data.apr.length} 条`, `<div class="table-wrap"><table><thead><tr><th>APR</th><th>域</th><th>玩法/模式</th><th>经营目标</th><th>效果</th><th>Policy</th><th>Value</th><th>Confidence</th></tr></thead><tbody>${data.apr.map(x=>`<tr><td class="code">${esc(x.apr_id)}</td><td>${esc(x.domain)}</td><td><strong>${esc(x.pattern_name_cn)}</strong><div class="item-meta">${esc((x.detection_signals||[]).slice(0,2).join(' · '))}</div></td><td>${esc(x.business_goal)}</td><td>${esc(x.observed_effect)}</td><td>${tag(x.policy_relation,kindFor(x.policy_relation))}</td><td>${tag(x.business_value_signal,kindFor(x.business_value_signal))}</td><td>${tag(x.confidence,kindFor(x.confidence))}</td></tr>`).join('')}</tbody></table></div>`)}<div class="notice warn section">APR 可以广泛记录市场现象，但不会直接产生 Amazon/Ads 生产写权限。</div>`;
  }

  function aom(){
    pageTitle.textContent='AOM 正向运营方法'; breadcrumb.textContent='亚马逊经营边界探索 / AOM';
    view.innerHTML = `<div class="hero"><div><h2>从经营目标出发，而不是从政策条文出发</h2><p>选择“增加 Review、提高转化、提高广告效率”等目标，系统返回适用方法、条件、预期影响和衡量指标。</p></div></div>${section('当前方法库',`${data.aom.length} 条`, `<div class="grid grid-3">${data.aom.map(x=>`<div class="card"><div class="code muted">${esc(x.method_id)}</div><div class="item-title" style="margin-top:8px">${esc(x.method_name_cn)}</div><div class="item-meta">${esc(x.objective)}</div><p class="compact">${esc(x.impact)}</p><div class="kpi-row">${tag(x.policy_status,kindFor(x.policy_status))}${tag(`Risk ${x.risk_level}`,kindFor(x.risk_level))}</div><div class="item-meta" style="margin-top:12px">衡量：${esc((x.measurement||[]).join(' · '))}</div></div>`).join('')}</div>`)} `;
  }

  function apb(){
    pageTitle.textContent='APB 政策与边界证据'; breadcrumb.textContent='亚马逊经营边界探索 / APB';
    const cards = data.domains.map(d=>`<div class="card"><div class="code">APB-${d[0]}</div><div class="item-title">${esc(d[2])}</div><div class="item-meta">${esc(d[1])}</div><div style="margin-top:10px">${tag(d[3],kindFor(d[3]))}</div></div>`).join('');
    view.innerHTML = `<div class="grid grid-4">${cards}</div>${section('当前政策/边界记录',`${data.apb.length} 条`, `<div class="table-wrap"><table><thead><tr><th>编号</th><th>域</th><th>类型</th><th>状态</th><th>标题</th><th>Confidence</th></tr></thead><tbody>${data.apb.map(x=>`<tr><td class="code">${esc(x.case_id)}</td><td>${esc(x.domain)}</td><td>${esc(x.result_type)}</td><td>${tag(x.status,kindFor(x.status))}</td><td>${esc(x.title_cn)}</td><td>${tag(x.confidence,kindFor(x.confidence))}</td></tr>`).join('')}</tbody></table></div>`)} `;
  }

  function generic(name, desc, items=[]){
    pageTitle.textContent=name; breadcrumb.textContent=name;
    view.innerHTML = `<div class="hero"><div><h2>${esc(name)}</h2><p>${esc(desc)}</p></div></div>${items.length?`<div class="grid grid-3 section">${items.map(i=>`<div class="card"><div class="item-title">${esc(i[0])}</div><div class="item-meta">${esc(i[1])}</div></div>`).join('')}</div>`:`<div class="empty-state"><div class="empty-icon">◌</div><h3>界面入口已就绪</h3><p>等待对应只读聚合器和真实数据接入。</p></div>`}`;
  }

  function render(){
    setActive(); const r=route();
    if(r==='/command-center'||r==='/') return home();
    if(r==='/amazon-boundary'||r==='/amazon-boundary/apr') return apr();
    if(r==='/amazon-boundary/aom') return aom();
    if(r==='/amazon-boundary/apb') return apb();
    if(r==='/operations'||r==='/operations/products') return generic('产品经营中心','全局产品视角与单品经营入口。',[['产品状态卡','当前阶段、目标、今日操作、任务、政策/APR影响'],['流量与转化','Session、CVR、自然流量与转化诊断'],['价格与促销','List Price、Was Price、Coupon、Deal 与历史价格'],['利润与经营','收入、广告费、贡献利润与利润率'],['消费者体验','Review、退货、差评主题与产品体验'],['关联业务','广告、库存、竞品与站外推广摘要']]);
    if(r==='/operations/ads') return generic('广告中心','SP / SB / SD 广告分析、诊断与任务入口。');
    if(r==='/operations/inventory-logistics') return generic('库存物流','库存覆盖、补货、FBA 与物流风险。');
    if(r==='/operations/competitors') return generic('竞品中心','竞品池、价格、Review、排名与 APR 信号。');
    if(r==='/operations/offsite') return generic('站外推广','TikTok、红人、站外活动与归因。');
    if(r==='/sandbox') return generic('沙盘演练','基于我方 Product Digital Twin 的 Scenario / R0 / Response Package 推演。',[['数字孪生','绑定 frozen twin version'],['Scenario','经营与竞争压力场景'],['Low / Base / High','不确定性区间'],['R0','NO_RESPONSE 反事实基线'],['Response Package','多策略组合'],['Revised Strategy','输出给 Agent-1 的策略证据']]);
    if(r==='/agents') return generic('Agent 中心','Agent-1 总控与 Agent-2~13 专业智能体运行状态。',[['Agent-1','Operations Commander'],['Agent-4','Advertising Intelligence'],['Agent-5','Traffic Intelligence'],['Agent-6','Profit Intelligence'],['Agent-7','Inventory Intelligence'],['Agent-12','Risk & Compliance']]);
    if(r==='/tasks') return generic('任务中心','Decision → TaskDraft → Approval → Permission → Outcome。',[['Draft','尚未授权执行'],['Pending Approval','等待人工审批'],['Permission Boundary','权限校验'],['Outcome','执行结果与回写']]);
    if(r==='/governance') return generic('系统政策边界','1122 自身权限、审批、自动化、安全和 fail-closed 规则。');
    if(r==='/data') return generic('数据中心','HOT / WARM / COLD 事实层、数据新鲜度与来源追溯。',[['HOT / KV','Current State Cache'],['WARM / D1','长期经营事实'],['COLD / R2','原始档案与历史报告'],['Freshness','数据新鲜度与质量'],['Provenance','来源追溯'],['Migration','Schema / Migration 状态']]);
    if(r==='/selection') return generic('选品中心','市场机会、容量、竞争、利润与新品机会评估。');
    if(r==='/skills') return generic('技能中心','Agent 可调用的标准化能力和工具契约。');
    if(r==='/connectors') return generic('对外连接','Amazon / Ads / Sif / Cloudflare / Codex 等外部连接状态。');
    if(r==='/knowledge') return generic('知识中心','可复用经营知识、规则、方法与经验。');
    if(r==='/memory') return generic('记忆中心','产品、任务、决策、结果与经营历史。');
    return generic('页面未找到','该逻辑路由尚未实现。');
  }

  function bindGo(){ view.querySelectorAll('[data-go]').forEach(el=>el.addEventListener('click',()=>go(el.dataset.go))); }

  search.addEventListener('input', e => {
    const q=e.target.value.trim().toLowerCase(); if(!q){render();return;}
    pageTitle.textContent='搜索'; breadcrumb.textContent='全局搜索';
    const rows=[...data.apr.map(x=>({id:x.apr_id,title:x.pattern_name_cn,type:'APR',route:'/amazon-boundary/apr'})),...data.aom.map(x=>({id:x.method_id,title:x.method_name_cn,type:'AOM',route:'/amazon-boundary/aom'})),...data.apb.map(x=>({id:x.case_id,title:x.title_cn,type:'APB',route:'/amazon-boundary/apb'}))].filter(x=>(x.id+' '+x.title+' '+x.type).toLowerCase().includes(q));
    view.innerHTML = section('搜索结果',`${rows.length} 条`, `<div class="list card">${rows.length?rows.map(x=>`<div class="list-item"><a class="route-link" data-go="${x.route}">${esc(x.id)} · ${esc(x.title)}</a><div class="item-meta">${esc(x.type)}</div></div>`).join(''):'<div class="muted">没有匹配结果</div>'}</div>`); bindGo();
  });

  document.getElementById('menu-toggle').addEventListener('click',()=>sidebar.classList.toggle('open'));
  window.addEventListener('hashchange',()=>{sidebar.classList.remove('open');render();});
  renderNav(); render();
})();
