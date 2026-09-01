import fs from 'node:fs';

function edit(path, transform){const before=fs.readFileSync(path,'utf8');const after=transform(before);if(after===before)console.log('No change:',path);else{fs.writeFileSync(path,after);console.log('Updated:',path)}}

edit('index.html',(html)=>{
  html=html.replace('<div class="card"><div class="kpi-label">InventorySnapshot</div><div class="metric-placeholder">V1.3</div><div class="meta">建设中</div></div>','<div class="card"><div class="kpi-label">InventorySnapshot</div><div class="metric-placeholder" id="inventorySnapshotState">REAL</div><div class="meta" id="inventorySnapshotMeta">正在读取快照状态…</div></div>');
  html=html.replace('Amazon FBA Inventory 已接入 total / fulfillable / inbound working / shipped / receiving。V1.3 正在把这些字段升级成 InventorySnapshot（库存快照）。','Amazon FBA Inventory 已接入并已生成独立 InventorySnapshot（库存快照）；完整库存数量继续保存在 Cloudflare KV 私有数据层。');
  html=html.replace('<h2>库存与供应链</h2><span class="pill warn">V1.3 下一步</span>','<h2>库存与供应链</h2><span class="pill ok">V1.3 已建立</span>');
  html=html.replace('<div class="ops-row-title">V1.3：InventorySnapshot（库存快照）</div><div class="ops-row-meta">FBA total / fulfillable / inbound 数据已经存在，下一步从 ProductIdentity 附属字段升级成独立库存对象，为缺货与补货判断打底。</div></div><span class="ops-priority">工程重点</span>','<div class="ops-row-title">V1.3：InventorySnapshot（库存快照）已建立</div><div class="ops-row-meta">FBA 库存已从 ProductIdentity 附属字段升级为独立 InventorySnapshot；下一步补销售速度后计算覆盖天数与断货风险。</div></div><span class="ops-priority">已完成</span>');
  html=html.replace("function openInventoryCenter(){hideAll();document.getElementById('inventory-center').classList.add('show');activate(nav.querySelectorAll('a')[2]);window.scrollTo({top:0,behavior:'smooth'})}","function openInventoryCenter(){hideAll();document.getElementById('inventory-center').classList.add('show');activate(nav.querySelectorAll('a')[2]);window.scrollTo({top:0,behavior:'smooth'});setTimeout(refreshInventoryCenterStatus,100)}");
  if(!html.includes('async function refreshInventoryCenterStatus()')){
    const marker='function openAdsCenter(){';
    const fn=`async function refreshInventoryCenterStatus(){const state=document.getElementById('inventorySnapshotState');const meta=document.getElementById('inventorySnapshotMeta');if(!state||!meta)return;state.textContent='…';meta.textContent='正在读取后端 InventorySnapshot 状态…';try{const res=await fetch('https://1122-amazon-sp-api-bridge.zhangshuaibing01.workers.dev/product-identity-status',{headers:{'Accept':'application/json'}});const d=await res.json();if(!res.ok||d.success!==true)throw new Error(d.message||d.error||'状态读取失败');const s=d.v13;if(!s||!s.inventorySnapshotReady){state.textContent='WAIT';meta.textContent='等待 InventorySnapshot 私有刷新';return}state.textContent='REAL';const dt=s.observedAt?new Date(s.observedAt):null;meta.textContent=String(s.inventoryRecordCount??0)+' 条库存快照 · '+(dt&&!Number.isNaN(dt.getTime())?dt.toLocaleString():'已刷新')+' · 明细仅后端可见'}catch(e){state.textContent='ERR';meta.textContent='库存快照状态读取失败：'+e.message}}\n`;
    if(!html.includes(marker))throw new Error('Missing openAdsCenter marker');
    html=html.replace(marker,fn+marker);
  }
  html=html.replace("state:'REAL BASE',metrics:'FBA total / fulfillable / inbound 基础字段已真实接入。',body:'V1.3 将生成独立 InventorySnapshot 与 freshness。'","state:'REAL SNAPSHOT',metrics:'InventorySnapshot 已真实建立；具体记录数和观察时间由库存物流中心实时读取。',body:'完整库存数量保存在后端私有数据层；下一阶段接销售速度和库存风险模型。'");
  return html;
});

edit('系统冲突问题库/政策边界板块/系统公共层/冲突-政策边界板块-系统公共层-GitHub公开仓与经营敏感数据隔离-001.md',(s)=>{
  s=s.replace('- 当前状态：`暂缓`','- 当前状态：`已解决`');
  s=s.replace('1122 当前 GitHub Repository（GitHub 仓库）为 Public（公开）状态，但系统已经从原型阶段进入真实 Amazon SP-API 数据接入阶段。','冲突发现时，1122 GitHub Repository（GitHub 仓库）为 Public（公开）状态，而系统已经从原型阶段进入真实 Amazon SP-API 数据接入阶段。2026-09-01 主仓已切换为 Private（私有仓）。');
  s=s.replace('`miaoqi098-sys/1122` 当前为 GitHub Public Repository（公开仓），便于当前网页展示、GitHub Pages 部署和快速工程迭代。','冲突发现时 `miaoqi098-sys/1122` 为 GitHub Public Repository（公开仓）。2026-09-01 已完成 Private Repository（私有仓）切换。');
  s=s.replace('## 十一、解决日期\n\n未解决。','## 十一、解决日期\n\n2026-09-01。');
  if(!s.includes('## 十三、闭环更新（2026-09-01）'))s+=`\n\n## 十三、闭环更新（2026-09-01）\n\n已验证 GitHub Repository visibility = Private。\n\n根冲突“核心源码与 Workflow 对公网公开”已解除，因此本冲突标记为 \`已解决\`。\n\n以下措施继续作为长期安全规则，而不是因为仓库私有而撤销：\n- Secret / Token 永不写入 Git；\n- SKU、库存、价格、广告、财务等经营数据继续保存在 KV / D1 / R2 / 数据库；\n- GitHub Actions 日志继续最小化；\n- Web UI 完成真实 Authentication / Authorization 前，不开放完整经营明细和高影响写操作。\n\nWeb 身份认证属于后续独立安全建设项，不再阻塞本“公开仓冲突”的关闭。\n`;
  return s;
});

edit('政策边界板块/系统公共层/仓库可见性与敏感数据安全边界.md',(s)=>{
  s=s.replace('1122 当前 GitHub 主仓库为 Public Repository（公开仓）。\n\n因此任何进入仓库的代码、配置、Markdown、示例文件、提交历史和 Workflow 定义，都必须按“外部人员可读取”处理。','1122 GitHub 主仓库已于 2026-09-01 切换为 Private Repository（私有仓）。\n\n仓库私有化降低了源码和 Workflow 公开暴露风险，但不改变数据与密钥分离原则。任何 Secret 仍不得写入 Git，真实经营数据仍优先进入专用后端数据层。Web UI 尚未完成身份认证，因此经营明细仍不得通过未认证网页接口直接暴露。');
  s=s.replace('## 四、当前公开仓阶段的标准架构','## 四、当前私有仓阶段的标准架构');
  s=s.replace('Public GitHub Repository\n├── UI\n├── 非敏感 Worker 逻辑\n├── 文档\n└── Workflow 定义','Private GitHub Repository\n├── UI\n├── Worker / Agent 工程逻辑\n├── 文档\n└── Workflow 定义');
  s=s.replace('Public 1122 UI\n└── PUBLIC 聚合状态','1122 Web UI（身份认证待建设）\n└── 当前仍只展示低敏感度聚合状态');
  return s;
});

edit('运营板块/产品板块/V1_产品运营中心.md',(s)=>{
  s=s.replace('### V1.3 库存 / FBA\n\nV1.1 已具备基础字段：\n- total quantity\n- fulfillable quantity\n- inbound working\n- inbound shipped\n- inbound receiving\n\n下一步将这些字段升级成库存 Snapshot、缺货风险、补货状态和 freshness，而不是只作为 ProductIdentity 附属字段。','### V1.3 库存 / FBA — 已通过真实验证\n\n基础字段：\n- total quantity\n- fulfillable quantity\n- inbound working\n- inbound shipped\n- inbound receiving\n\n2026-09-01 已将库存从 ProductIdentity 附属字段升级为独立 `InventorySnapshot.v1` 并写入 Cloudflare KV。首次真实验证：21 个 ProductIdentity → 21 条 InventorySnapshot，完整数量明细仅后端可见。\n\n下一步接入销售速度、补货周期和供应链约束，计算覆盖天数、预计断货与补货优先级；在这些输入齐备前不直接生成库存健康结论。');
  return s;
});
