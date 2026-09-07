(async () => {
  const data = await (window.__1122_DATA_READY__ || Promise.resolve(window.__1122_DATA__ || {navigation:[],apr:[],aom:[],apb:[],domains:[]}));
  const nav = document.getElementById('primary-nav');
  const view = document.getElementById('view');
  const pageTitle = document.getElementById('page-title');
  const breadcrumb = document.getElementById('breadcrumb');
  const sidebar = document.getElementById('sidebar');
  const search = document.getElementById('global-search');
  const sourceState = document.getElementById('data-source-state');

  if(sourceState){
    const s=data.__source||{mode:'SNAPSHOT_FALLBACK',live_data_verified:false};
    sourceState.textContent = `Data: ${s.mode}${s.live_data_verified?' / LIVE VERIFIED':''}`;
    sourceState.title = s.endpoint || '';
  }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const tag = (text, kind='neutral') => `<span class="tag tag-${kind}">${esc(text)}</span>`;
  const kindFor = v => /VERIFIED|ALLOWED|LOW|POSITIVE|CONFIRMED|success|API/i.test(v)?'ok':/NONCOMPLIANT|HIGH|BLOCK|failed/i.test(v)?'bad':/SEEDED|DISCOVERY|MEDIUM|UNKNOWN|CONDITIONAL|SNAPSHOT/i.test(v)?'warn':'info';
  const route = () => (location.hash || '#/command-center').replace(/^#/,'');
  const go = r => { location.hash = r.startsWith('#') ? r.slice(1) : r; };

  function renderNav(){
    // Prefer the committed route registry. Snapshot navigation remains a safe
    // fallback only when the registry asset cannot be loaded.
    const registered = window.__1122_REGISTRY__?.modules || [];
    const roots = [
      ...registered.filter(x=>!x.parent && !x.route.startsWith('/connectors/')),
    ].map(x => ({...x, route:'#'+x.route, children:registered.filter(c=>c.parent===x.id).map(c=>({...c,route:'#'+c.route}))}));
    const navigation = roots.length ? roots : (data.navigation||[]);
    nav.innerHTML = navigation.map(item => {
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
  const sourceBanner = () => {
    const s=data.__source||{};
    const live=s.mode==='API' && s.live_data_verified===true;
    return `<div class="notice ${live?'':'warn'} section">当前数据源：${tag(s.mode||'UNKNOWN',kindFor(s.mode||''))} ${live?'已验证实时数据。':'当前不是已验证实时数据；Web 会优先尝试只读 API，失败后自动回退仓库快照。'}</div>`;
  };

  function home(){
    pageTitle.textContent='经营指挥中心'; breadcrumb.textContent='首页 / 经营指挥中心';
    const seeded = (data.domains||[]).filter(x=>x[3]==='SEEDED').length;
    view.innerHTML = `
      <div class="hero"><div><h2>今天先看经营结果，再看系统动作</h2><p>APR、AOM、APB 已进入正式前台。Web Console 当前采用 API 优先、只读快照回退的数据加载策略。</p></div><div class="hero-actions"><button class="btn btn-primary" data-go="/amazon-boundary/apr">查看最新 APR</button><button class="btn" data-go="/amazon-boundary/aom">查看 AOM</button></div></div>
      <div class="grid grid-4 section">${metric('APR 已发现',(data.apr||[]).length,'市场玩法探索结果')}${metric('AOM 方法',(data.aom||[]).length,'当前正式运营方法')}${metric('APB 记录',(data.apb||[]).length,'政策/边界证据')}${metric('政策域已 Seeded',`${seeded}/18`,'其余继续 Discovery')}</div>
      ${section('最新 APR 探索','市场真实玩法与边界模式', `<div class="grid grid-2">${(data.apr||[]).slice(0,4).map(x=>`<div class="card"><div class="split-title"><span class="code">${esc(x.apr_id)}</span>${tag(x.policy_relation,kindFor(x.policy_relation))}</div><div class="item-title" style="margin-top:10px">${esc(x.pattern_name_cn)}</div><div class="item-meta">目标：${esc(x.business_goal)}</div><div class="item-meta">${esc(x.observed_effect)}</div><div class="kpi-row" style="margin-top:10px">${tag(x.business_value_signal,kindFor(x.business_value_signal))}${tag(x.confidence,kindFor(x.confidence))}</div></div>`).join('')}</div>`)}
      ${section('AOM 推荐方法','运营可直接理解的正向方法', `<div class="grid grid-3">${(data.aom||[]).map(x=>`<div class="card goal-card" data-go="/amazon-boundary/aom"><div class="code muted">${esc(x.method_id)}</div><div class="goal-title">${esc(x.method_name_cn)}</div><div class="goal-desc">${esc(x.objective)}</div><div class="kpi-row" style="margin-top:12px">${tag(x.policy_status,kindFor(x.policy_status))}${tag(x.risk_level,kindFor(x.risk_level))}</div></div>`).join('')}</div>`)}
      ${section('快捷入口','从经营问题直接进入模块', `<div class="grid grid-4"><div class="card goal-card" data-go="/operations/products"><div class="goal-icon">▦</div><div class="goal-title">产品状态</div><div class="goal-desc">查看单品经营、任务、政策与 APR 影响</div></div><div class="card goal-card" data-go="/agents"><div class="goal-icon">✦</div><div class="goal-title">Agent</div><div class="goal-desc">查看 Agent-1~13 分析与决策链</div></div><div class="card goal-card" data-go="/tasks"><div class="goal-icon">☑</div><div class="goal-title">任务中心</div><div class="goal-desc">查看 Draft / Approval / Permission / Outcome</div></div><div class="card goal-card" data-go="/sandbox"><div class="goal-icon">◇</div><div class="goal-title">沙盘演练</div><div class="goal-desc">围绕产品数字孪生做经营推演</div></div></div>`)}
      ${sourceBanner()}
    `;
    bindGo();
  }

  function apr(){
    pageTitle.textContent='APR 市场玩法探索'; breadcrumb.textContent='亚马逊经营边界探索 / APR';
    view.innerHTML = `<div class="hero"><div><h2>APR：Amazon 真实市场玩法雷达</h2><p>重点记录“市场上发生了什么、为什么可能有效、持续多久、怎么识别、对我方有什么价值”。APR 是非执行参考层。</p></div></div>${section('探索结果',`${(data.apr||[]).length} 条`, `<div class="table-wrap"><table><thead><tr><th>APR</th><th>域</th><th>玩法/模式</th><th>经营目标</th><th>效果</th><th>Policy</th><th>Value</th><th>Confidence</th></tr></thead><tbody>${(data.apr||[]).map(x=>`<tr><td class="code">${esc(x.apr_id)}</td><td>${esc(x.domain)}</td><td><strong>${esc(x.pattern_name_cn)}</strong><div class="item-meta">${esc((x.detection_signals||[]).slice(0,2).join(' · '))}</div></td><td>${esc(x.business_goal)}</td><td>${esc(x.observed_effect)}</td><td>${tag(x.policy_relation,kindFor(x.policy_relation))}</td><td>${tag(x.business_value_signal,kindFor(x.business_value_signal))}</td><td>${tag(x.confidence,kindFor(x.confidence))}</td></tr>`).join('')}</tbody></table></div>`)}<div class="notice warn section">APR 可以广泛记录市场现象，但不会直接产生 Amazon/Ads 生产写权限。</div>${sourceBanner()}`;
  }

  function aom(){
    pageTitle.textContent='AOM 正向运营方法'; breadcrumb.textContent='亚马逊经营边界探索 / AOM';
    view.innerHTML = `<div class="hero"><div><h2>从经营目标出发，而不是从政策条文出发</h2><p>选择“增加 Review、提高转化、提高广告效率”等目标，系统返回适用方法、条件、预期影响和衡量指标。</p></div></div>${section('当前方法库',`${(data.aom||[]).length} 条`, `<div class="grid grid-3">${(data.aom||[]).map(x=>`<div class="card"><div class="code muted">${esc(x.method_id)}</div><div class="item-title" style="margin-top:8px">${esc(x.method_name_cn)}</div><div class="item-meta">${esc(x.objective)}</div><p class="compact">${esc(x.impact)}</p><div class="kpi-row">${tag(x.policy_status,kindFor(x.policy_status))}${tag(`Risk ${x.risk_level}`,kindFor(x.risk_level))}</div><div class="item-meta" style="margin-top:12px">衡量：${esc((x.measurement||[]).join(' · '))}</div></div>`).join('')}</div>`)}${sourceBanner()}`;
  }

  function apb(){
    pageTitle.textContent='APB 政策与边界证据'; breadcrumb.textContent='亚马逊经营边界探索 / APB';
    const cards = (data.domains||[]).map(d=>`<div class="card"><div class="code">APB-${d[0]}</div><div class="item-title">${esc(d[2])}</div><div class="item-meta">${esc(d[1])}</div><div style="margin-top:10px">${tag(d[3],kindFor(d[3]))}</div></div>`).join('');
    view.innerHTML = `<div class="grid grid-4">${cards}</div>${section('当前政策/边界记录',`${(data.apb||[]).length} 条`, `<div class="table-wrap"><table><thead><tr><th>编号</th><th>域</th><th>类型</th><th>状态</th><th>标题</th><th>Confidence</th></tr></thead><tbody>${(data.apb||[]).map(x=>`<tr><td class="code">${esc(x.case_id)}</td><td>${esc(x.domain)}</td><td>${esc(x.result_type)}</td><td>${tag(x.status,kindFor(x.status))}</td><td>${esc(x.title_cn)}</td><td>${tag(x.confidence,kindFor(x.confidence))}</td></tr>`).join('')}</tbody></table></div>`)}${sourceBanner()}`;
  }

  function generic(name, desc, items=[]){
    pageTitle.textContent=name; breadcrumb.textContent=name;
    view.innerHTML = `<div class="hero"><div><h2>${esc(name)}</h2><p>${esc(desc)}</p></div></div>${items.length?`<div class="grid grid-3 section">${items.map(i=>`<div class="card"><div class="item-title">${esc(i[0])}</div><div class="item-meta">${esc(i[1])}</div></div>`).join('')}</div>`:`<div class="empty-state"><div class="empty-icon">◌</div><h3>界面入口已就绪</h3><p>等待对应只读聚合器和真实数据接入。</p></div>`}${sourceBanner()}`;
  }

  function connectorCard(name, state, detail, kind='neutral'){
    return `<div class="card"><div class="split-title"><div class="item-title">${esc(name)}</div>${tag(state,kind)}</div><div class="item-meta" style="margin-top:10px">${esc(detail)}</div></div>`;
  }

  async function renderConnectors(){
    pageTitle.textContent='对外连接'; breadcrumb.textContent='系统 / 对外连接';
    view.innerHTML = `<div class="hero"><div><h2>对外连接</h2><p>正在进行一次有时限、可重试一次的只读检查；不会读取或显示 Secret。</p></div></div>`;
    const health = await window.__1122_CONNECTORS__.read('cloudflare');
    const d = health.details || {};
    const statusKind = health.status === 'LIVE' ? 'ok' : health.status === 'ERROR' ? 'bad' : 'warn';
    const statusText = health.status === 'LIVE' ? 'LIVE' : health.status === 'DEGRADED' ? 'DEGRADED' : health.status === 'FALLBACK' ? 'FALLBACK' : 'ERROR';
    const error = health.error?.message || health.error_message || '—';
    const cards = [
      connectorCard('Cloudflare Status Bridge', statusText, `来源：${health.source || '—'}；延迟：${health.latency_ms ?? '—'} ms；${d.bridge === 'offline' ? 'Bridge 不可达' : 'Bridge 已响应'}`, statusKind),
      connectorCard('API Token', d.token?.status || '未知', '仅展示验证状态，不会显示 Token。', d.token?.status ? 'ok' : 'warn'),
      connectorCard('Zone', d.zone?.status || '未知', `域名：${d.zone?.name || '—'}；${d.zone?.paused ? '已暂停' : '未确认暂停状态'}`, d.zone?.status === 'active' ? 'ok' : 'warn'),
      connectorCard('DNS', `${d.dns?.recordCount ?? '—'} records`, '只读统计；未知不会被当作 0。', Number.isInteger(d.dns?.recordCount) ? 'ok' : 'warn'),
      connectorCard('Pages', d.pages?.projectFound ? '已识别' : '未知/未识别', `项目：${d.pages?.projectName || '—'}；生产分支：${d.pages?.productionBranch || '—'}；子域名：${d.pages?.subdomain || '—'}`, d.pages?.projectFound ? 'ok' : 'warn'),
      connectorCard('R2', d.r2?.credentialsConfigured ? '已配置' : '未配置/未知', '只检查配置状态，不暴露访问凭证。', d.r2?.credentialsConfigured ? 'ok' : 'warn'),
      connectorCard('最后检查', health.checked_at || '未知', health.status === 'ERROR' ? `失败阶段：${health.error?.stage || health.failedAt || '请求/响应'}；原因：${error}` : '状态由既有 Cloudflare Status Bridge 实时返回。', statusKind)
    ];
    const otherIds = Object.keys(window.__1122_CONNECTORS__.registry).filter(id=>id !== 'cloudflare');
    const other = await Promise.all(otherIds.map(id=>window.__1122_CONNECTORS__.read(id)));
    const otherCards = other.map(x=>connectorCard(window.__1122_CONNECTORS__.registry[x.connector_id]?.label || x.connector_id, x.status, x.error?.message || x.details?.service || x.details?.mode || '只读健康检查', x.status === 'LIVE' ? 'ok' : x.status === 'ERROR' ? 'bad' : 'warn'));
    view.innerHTML = `<div class="hero"><div><h2>对外连接</h2><p>所有连接器均统一登记、统一错误分类、超时重试与 fail-closed；不会读取或显示 Secret。</p></div></div>${section('Cloudflare 对接状态',`实时只读检查 · ${statusText}`, `<div class="grid grid-3">${cards.join('')}</div>`)}${section('已登记连接器','连接端点不可用或尚未配置时明确降级，不会伪造连接成功。', `<div class="grid grid-3">${otherCards.join('')}</div>`)}<div class="notice ${health.status === 'LIVE' ? '' : 'warn'} section">连接状态：${tag(statusText,statusKind)}。写操作始终经受控 Worker、GitHub Actions 或人工审批；前端只读。</div>`;
  }

  async function renderAds(){
    pageTitle.textContent='广告中心'; breadcrumb.textContent='运营 / 广告';
    const bridge='https://1122-amazon-ads-bridge.zhangshuaibing01.workers.dev';
    view.innerHTML=`<div class="hero"><div><h2>Amazon Ads</h2><p>正在读取真实连接状态。授权令牌不会在浏览器中显示或保存。</p></div></div><div class="empty-state"><div class="empty-icon">◌</div><h3>正在读取连接状态</h3><p>请求有超时与有限重试；失败会明确显示，而不会无限等待。</p></div>`;
    const health=await window.__1122_CONNECTORS__.read('amazon-ads');
    const detail=health.details||{}; const isConnected=health.status==='CONNECTED';
    let body=`<div class="hero"><div><h2>Amazon Ads</h2><p>紫鸟手工回跳授权 · Profiles 与 Campaigns 只读查询；广告写入仍未开放。</p></div></div><div class="grid grid-4 section">${metric('连接状态',health.status,health.error?.message||'真实后端状态')}${metric('区域',detail.region||'NA','可扩展 EU / FE')}${metric('Profiles',detail.profiles_count??'—','仅在真实 API 校验后显示')}${metric('最近检查',detail.last_token_refresh||health.checked_at||'—','不会显示 Token')}</div>`;
    body+=section('通过紫鸟重新授权','授权码有效时间很短；生成链接后请连续完成下面三步。',`<div class="oauth-steps"><div class="notice warn"><strong>准备：</strong>先在 Amazon LWA 的 1122 Ads Integration → Web设置中新增 Allowed Return URL：<span class="code">https://amazon.com</span>。原有 Worker callback 请保留。</div><div><strong>1. 生成并复制授权链接</strong><p class="muted">在这里生成后，把链接粘贴到已登录亚马逊广告账户的紫鸟浏览器地址栏。</p><div class="oauth-actions"><button class="btn btn-primary" id="ads-manual-start">生成紫鸟授权链接</button><button class="btn" id="ads-manual-copy" disabled>复制链接</button></div><textarea class="oauth-field code" id="ads-manual-url" rows="4" readonly placeholder="生成后会显示授权链接"></textarea><div class="muted" id="ads-manual-expiry"></div></div><div><strong>2. 在紫鸟中点击 Allow</strong><p class="muted">授权后停留在 Amazon 页面即可，不需要紫鸟访问 1122。</p></div><div><strong>3. 复制紫鸟地址栏的完整 Amazon 地址</strong><p class="muted">地址必须以 amazon.com 开头并同时含有 code 和 state。请勿把它发到聊天中。</p><textarea class="oauth-field code" id="ads-manual-return" rows="4" autocomplete="off" spellcheck="false" placeholder="把紫鸟授权后的完整 Amazon 地址粘贴到这里"></textarea><div class="oauth-actions"><button class="btn btn-primary" id="ads-manual-complete">验证并完成重新授权</button></div></div><div id="ads-manual-status"></div></div>`);
    if(!isConnected) body+=`<div class="notice warn section">${esc(health.error?.message||'尚未完成 Amazon Ads OAuth。')} 未通过真实 Profiles 校验时不会显示为已连接。</div>`;
    let profiles=[];
    try {
      if(isConnected){
        const result=await window.__1122_FETCH_JSON__(`${bridge}/profiles`,{timeoutMs:5000,retries:1,validate:x=>x&&x.ok===true&&Array.isArray(x.profiles)});
        profiles=result.profiles;
        body+=section('Profiles',`${profiles.length} 个已授权广告账户`, `<div class="table-wrap"><table><thead><tr><th>Profile ID</th><th>Country</th><th>Currency</th><th>Timezone</th><th>Account</th><th></th></tr></thead><tbody>${profiles.map(p=>`<tr><td class="code">${esc(p.profileId)}</td><td>${esc(p.countryCode)}</td><td>${esc(p.currencyCode)}</td><td>${esc(p.timezone)}</td><td>${esc(p.accountId||'—')}</td><td><button class="btn" data-profile="${esc(p.profileId)}">读取 Campaigns</button></td></tr>`).join('')}</tbody></table></div>`);
        body+=`<section class="section" id="ads-campaign-results"></section>`;
      }
    } catch(error){ body+=`<div class="notice warn section">Profiles 读取失败：${esc(error?.message||'REQUEST_FAILED')}。连接状态未被伪造为成功。</div>`; }
    view.innerHTML=body;

    const startButton=document.getElementById('ads-manual-start');
    const copyButton=document.getElementById('ads-manual-copy');
    const authUrl=document.getElementById('ads-manual-url');
    const expiry=document.getElementById('ads-manual-expiry');
    const returnUrl=document.getElementById('ads-manual-return');
    const completeButton=document.getElementById('ads-manual-complete');
    const statusBox=document.getElementById('ads-manual-status');
    startButton.addEventListener('click',async()=>{
      startButton.disabled=true; copyButton.disabled=true; authUrl.value=''; expiry.textContent=''; statusBox.innerHTML='<div class="notice">正在生成一次性授权链接…</div>';
      try {
        const result=await window.__1122_FETCH_JSON__(`${bridge}/oauth/manual/start`,{timeoutMs:5000,retries:0,validate:x=>x&&x.ok===true&&typeof x.authorization_url==='string'&&x.redirect_uri==='https://amazon.com'});
        authUrl.value=result.authorization_url; copyButton.disabled=false; expiry.textContent='请在 5 分钟内完成 Amazon 授权并提交回跳地址。'; statusBox.innerHTML='<div class="notice">链接已生成。复制后到紫鸟浏览器打开。</div>';
      }catch(error){ statusBox.innerHTML=`<div class="notice warn">授权链接生成失败：${esc(error?.message||'REQUEST_FAILED')}</div>`; }
      finally{ startButton.disabled=false; }
    });
    copyButton.addEventListener('click',async()=>{
      if(!authUrl.value) return;
      try { await navigator.clipboard.writeText(authUrl.value); statusBox.innerHTML='<div class="notice">授权链接已复制。</div>'; }
      catch { authUrl.focus(); authUrl.select(); document.execCommand('copy'); statusBox.innerHTML='<div class="notice">授权链接已复制。</div>'; }
    });
    completeButton.addEventListener('click',async()=>{
      const pasted=returnUrl.value.trim();
      if(!pasted){ statusBox.innerHTML='<div class="notice warn">请先粘贴紫鸟地址栏中的完整 Amazon 地址。</div>'; return; }
      returnUrl.value=''; completeButton.disabled=true; statusBox.innerHTML='<div class="notice">正在由 Worker 换取令牌并读取真实 Profiles…</div>';
      try {
        const result=await window.__1122_FETCH_JSON__(`${bridge}/oauth/manual/complete`,{method:'POST',body:JSON.stringify({return_url:pasted}),headers:{'Content-Type':'application/json'},timeoutMs:15000,retries:0,validate:x=>x&&x.ok===true&&x.status==='CONNECTED'&&Number.isInteger(x.profiles_count)});
        statusBox.innerHTML=`<div class="notice">重新授权成功，已验证 ${esc(result.profiles_count)} 个 Profiles。正在刷新页面状态…</div>`;
        setTimeout(()=>renderAds(),700);
      }catch(error){ statusBox.innerHTML=`<div class="notice warn">重新授权失败：${esc(error?.message||'REQUEST_FAILED')}。请重新生成链接再试；旧连接未被替换。</div>`; completeButton.disabled=false; }
    });
    view.querySelectorAll('[data-profile]').forEach(button=>button.addEventListener('click',async()=>{ const target=document.getElementById('ads-campaign-results'); target.innerHTML='<div class="notice">正在读取只读 Campaigns…</div>'; try { const result=await window.__1122_FETCH_JSON__(`${bridge}/campaigns?profile_id=${encodeURIComponent(button.dataset.profile)}`,{timeoutMs:7000,retries:1,validate:x=>x&&x.ok===true&&Array.isArray(x.campaigns)}); target.innerHTML=section('Campaigns',`${result.campaigns.length} 条 · Profile ${button.dataset.profile}`,`<div class="table-wrap"><table><thead><tr><th>Name</th><th>State</th><th>Daily budget</th><th>Targeting</th></tr></thead><tbody>${result.campaigns.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.state)}</td><td>${esc(c.budget??'—')}</td><td>${esc(c.targetingType||'—')}</td></tr>`).join('')}</tbody></table></div>`); }catch(error){target.innerHTML=`<div class="notice warn">Campaigns 读取失败：${esc(error?.message||'REQUEST_FAILED')}</div>`;} }));
  }

  function render(){
    setActive(); const r=route();
    if(r==='/command-center'||r==='/') return home();
    if(r==='/amazon-boundary'||r==='/amazon-boundary/apr') return apr();
    if(r==='/amazon-boundary/aom') return aom();
    if(r==='/amazon-boundary/apb') return apb();
    if(r==='/operations'||r==='/operations/products') return generic('产品经营中心','全局产品视角与单品经营入口。',[['产品状态卡','当前阶段、目标、今日操作、任务、政策/APR影响'],['流量与转化','Session、CVR、自然流量与转化诊断'],['价格与促销','List Price、Was Price、Coupon、Deal 与历史价格'],['利润与经营','收入、广告费、贡献利润与利润率'],['消费者体验','Review、退货、差评主题与产品体验'],['关联业务','广告、库存、竞品与站外推广摘要']]);
    if(r==='/operations/ads'||r==='/connectors/amazon-ads') return renderAds();
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
    if(r==='/connectors'||r==='/connectors/amazon-sp-api') return renderConnectors();
    if(r==='/knowledge') return generic('知识中心','可复用经营知识、规则、方法与经验。');
    if(r==='/memory') return generic('记忆中心','产品、任务、决策、结果与经营历史。');
    return generic('页面未找到','该逻辑路由尚未实现。');
  }

  function bindGo(){ view.querySelectorAll('[data-go]').forEach(el=>el.addEventListener('click',()=>go(el.dataset.go))); }

  search.addEventListener('input', e => {
    const q=e.target.value.trim().toLowerCase(); if(!q){render();return;}
    pageTitle.textContent='搜索'; breadcrumb.textContent='全局搜索';
    const rows=[...(data.apr||[]).map(x=>({id:x.apr_id,title:x.pattern_name_cn,type:'APR',route:'/amazon-boundary/apr'})),...(data.aom||[]).map(x=>({id:x.method_id,title:x.method_name_cn,type:'AOM',route:'/amazon-boundary/aom'})),...(data.apb||[]).map(x=>({id:x.case_id,title:x.title_cn,type:'APB',route:'/amazon-boundary/apb'}))].filter(x=>(x.id+' '+x.title+' '+x.type).toLowerCase().includes(q));
    view.innerHTML = section('搜索结果',`${rows.length} 条`, `<div class="list card">${rows.length?rows.map(x=>`<div class="list-item"><a class="route-link" data-go="${x.route}">${esc(x.id)} · ${esc(x.title)}</a><div class="item-meta">${esc(x.type)}</div></div>`).join(''):'<div class="muted">没有匹配结果</div>'}</div>`); bindGo();
  });

  document.getElementById('menu-toggle').addEventListener('click',()=>sidebar.classList.toggle('open'));
  window.addEventListener('hashchange',()=>{sidebar.classList.remove('open');render();});
  renderNav(); render();
})();
