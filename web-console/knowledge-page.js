(() => {
  const API='https://1122-data-layer.zhangshuaibing01.workers.dev/api/v1/knowledge/search';
  const ready=window.__1122_DATA_READY__ || Promise.resolve(window.__1122_DATA__ || {});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const badge=(value,kind='')=>`<span class="tag tag-${/CONFIRMED|VALIDATED|HIGH|FRESH|ACTIVE|LIVE/i.test(String(value))?'ok':/CONFLICT|STALE|LOW|ERROR/i.test(String(value))?'bad':'warn'}">${esc(value||'UNKNOWN')}</span>`;

  const types=[
    ['','全部类型'],['POLICY','政策知识'],['OPERATING_METHOD','运营方法'],['MARKET_PATTERN','市场玩法'],
    ['PRODUCT_KNOWLEDGE','产品经营'],['ADVERTISING_KNOWLEDGE','广告'],['PRICING_KNOWLEDGE','价格促销'],
    ['CONTENT_KNOWLEDGE','Listing内容'],['CASE_LESSON','案例复盘'],['SYSTEM_ENGINEERING','系统工程'],
    ['DATA_DEFINITION','数据定义'],['DECISION_RULE','决策规则']
  ];
  const truths=[['','全部真值'],['CONFIRMED','CONFIRMED'],['VALIDATED','VALIDATED'],['DERIVED','DERIVED'],['OBSERVED','OBSERVED'],['SOURCE_ONLY','SOURCE_ONLY'],['CONFLICTING','CONFLICTING'],['UNKNOWN','UNKNOWN']];

  function currentRoute(){return (location.hash||'#/command-center').replace(/^#/,'');}

  async function query(filters={}){
    const p=new URLSearchParams();
    if(filters.q) p.set('q',filters.q);
    if(filters.knowledge_type) p.set('knowledge_type',filters.knowledge_type);
    if(filters.domain) p.set('domain',filters.domain);
    if(filters.truth_class) p.set('truth_class',filters.truth_class);
    if(filters.confidence) p.set('confidence',filters.confidence);
    p.set('limit','100');
    const r=await fetch(`${API}?${p.toString()}`,{method:'GET',mode:'cors',credentials:'omit',headers:{Accept:'application/json'},cache:'no-store'});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  function card(item){
    return `<article class="card">
      <div class="section-head"><div><div class="code">${esc(item.knowledge_id)} · v${esc(item.version)}</div><h3 style="margin:6px 0">${esc(item.title)}</h3></div><div>${badge(item.truth_class)}</div></div>
      <p class="item-meta" style="font-size:14px;line-height:1.65">${esc(item.summary)}</p>
      <div class="kpi-row" style="margin:12px 0">${badge(item.knowledge_type)}${badge(item.domain)}${badge(item.confidence)}${badge(item.freshness_status)}</div>
      <div class="item-meta">${esc(item.content)}</div>
      ${item.keywords?.length?`<div class="item-meta" style="margin-top:12px">关键词：${item.keywords.map(esc).join(' · ')}</div>`:''}
      ${item.source_refs?.length?`<div class="item-meta" style="margin-top:8px">来源：${item.source_refs.map(x=>`<span class="code">${esc(x)}</span>`).join(' · ')}</div>`:''}
      <div class="item-meta" style="margin-top:8px">Last verified: ${esc(item.last_verified_at||'—')} · Status: ${esc(item.status)}</div>
    </article>`;
  }

  async function render(){
    if(currentRoute()!=='/knowledge') return;
    const view=document.getElementById('view'); if(!view) return;
    document.getElementById('page-title').textContent='知识中心';
    document.getElementById('breadcrumb').textContent='知识 / Knowledge Base';
    const bootstrap=await ready;
    const stats=bootstrap.knowledge || {};
    view.innerHTML=`
      <div class="hero"><div><h2>1122 Knowledge Base</h2><p>统一检索政策、运营方法、市场玩法、产品经验、案例、工程规则和决策知识。知识支持判断，但不等于权限。</p></div></div>
      <div class="grid grid-4 section">
        <div class="card metric-card"><div class="metric-label">当前知识项</div><div class="metric-value">${esc(stats.total??'—')}</div><div class="metric-meta">${esc(stats.source_status||'loading')}</div></div>
        <div class="card metric-card"><div class="metric-label">知识类型</div><div class="metric-value">${esc(stats.by_type?.length??'—')}</div><div class="metric-meta">11 类统一对象</div></div>
        <div class="card metric-card"><div class="metric-label">真值层级</div><div class="metric-value">${esc(stats.by_truth?.length??'—')}</div><div class="metric-meta">SOURCE_ONLY → CONFIRMED</div></div>
        <div class="card metric-card"><div class="metric-label">执行权限</div><div class="metric-value" style="font-size:18px">READ ONLY</div><div class="metric-meta">Knowledge ≠ Permission</div></div>
      </div>
      <section class="card section">
        <div class="section-head"><div><h2>检索知识</h2><div class="section-sub">关键词 + 类型 + 领域 + 真值等级 + 置信度</div></div></div>
        <div class="grid grid-4" style="align-items:end">
          <label><div class="item-meta">关键词</div><input id="kb-q" class="kb-input" placeholder="例如 Review / Vine / 定价" /></label>
          <label><div class="item-meta">知识类型</div><select id="kb-type" class="kb-input">${types.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label>
          <label><div class="item-meta">领域</div><input id="kb-domain" class="kb-input" placeholder="例如 Review / System" /></label>
          <label><div class="item-meta">真值等级</div><select id="kb-truth" class="kb-input">${truths.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label>
        </div>
        <div style="margin-top:12px"><button id="kb-search" class="btn btn-primary">搜索知识</button> <button id="kb-reset" class="btn">重置</button></div>
      </section>
      <div id="kb-result" class="section"><div class="empty-state"><p>正在读取知识库…</p></div></div>
      <div class="notice section">固定边界：Knowledge != Permission · Observed != Confirmed · Technically Possible != Policy Allowed。知识中心不拥有 Amazon / Ads 生产写权限。</div>`;

    async function execute(){
      const result=document.getElementById('kb-result');
      result.innerHTML='<div class="empty-state"><p>正在检索…</p></div>';
      try{
        const data=await query({q:document.getElementById('kb-q').value.trim(),knowledge_type:document.getElementById('kb-type').value,domain:document.getElementById('kb-domain').value.trim(),truth_class:document.getElementById('kb-truth').value});
        result.innerHTML=`<div class="section-head"><div><h2>检索结果</h2><div class="section-sub">${data.total} 条 · ${esc(data.source_status)}</div></div></div><div class="grid grid-2">${data.items.length?data.items.map(card).join(''):'<div class="empty-state"><h3>没有匹配知识</h3><p>调整关键词或筛选条件。</p></div>'}</div>`;
      }catch(e){result.innerHTML=`<div class="notice warn">知识 API 暂不可用：${esc(e.message)}。没有使用静态内容冒充实时结果。</div>`;}
    }
    document.getElementById('kb-search').onclick=execute;
    document.getElementById('kb-reset').onclick=()=>{document.getElementById('kb-q').value='';document.getElementById('kb-type').value='';document.getElementById('kb-domain').value='';document.getElementById('kb-truth').value='';execute();};
    document.getElementById('kb-q').addEventListener('keydown',e=>{if(e.key==='Enter')execute();});
    execute();
  }

  window.addEventListener('hashchange',()=>setTimeout(render,0));
  window.addEventListener('load',()=>setTimeout(render,0));
  setTimeout(render,0);
})();
