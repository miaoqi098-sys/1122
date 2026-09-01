import fs from 'node:fs';

const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

function replaceOnce(oldText, newText, label) {
  if (!html.includes(oldText)) throw new Error(`Missing patch target: ${label}`);
  html = html.replace(oldText, newText);
}

replaceOnce(
  '<div class="module-card" onclick="toast(\'产品板块后续继续建设\')"><div class="module-icon">产</div><div class="module-name">产品</div><div class="module-desc">管理全部产品经营状态，并进入单品完整经营视角。</div><span class="tag warn"><span class="dot"></span>建设中</span></div>',
  '<div class="module-card" onclick="openProductCenter()"><div class="module-icon">产</div><div class="module-name">产品</div><div class="module-desc">管理全部产品经营状态，并进入单品完整经营视角。</div><span class="tag ok"><span class="dot"></span>V1 已启动</span></div>',
  'operations product card'
);

const productCenter = `
<section id="product-center" class="view">
<div class="crumb">运营 / 产品 / 产品运营中心 V1</div>
<div class="topbar"><div class="title"><h1>产品运营中心</h1><p>以 ProductIdentity（产品身份）为主线，聚合商品、流量、广告、价格、库存、利润与消费者体验。</p></div><button class="btn secondary" onclick="openView('operations',nav.querySelectorAll('a')[2])">← 返回运营</button></div>
<div class="banner"><strong>V1 当前阶段：</strong>先建设真实只读数据链。Amazon SP-API 与 Sif MCP 已通过真实连接验证；Amazon Ads API 尚待独立授权。任何改价、改 Listing、广告调整等高影响写操作仍保持关闭。</div>
<div class="grid four">
  <div class="card"><div class="kpi-label">Amazon SP-API</div><div class="kpi-value" style="font-size:20px">已连接</div><div class="meta">自有商品 / 价格 / 库存 / 销售数据源</div></div>
  <div class="card"><div class="kpi-label">Sif MCP</div><div class="kpi-value" style="font-size:20px">已连接</div><div class="meta">关键词 / 流量 / 竞品 / 市场数据源</div></div>
  <div class="card"><div class="kpi-label">Amazon Ads API</div><div class="kpi-value" style="font-size:20px">待授权</div><div class="meta">自有广告数据下一阶段接入</div></div>
  <div class="card"><div class="kpi-label">运行模式</div><div class="kpi-value" style="font-size:20px">Read Only</div><div class="meta">只读 · 写操作进入任务中心审批</div></div>
</div>
<div class="module-grid">
  <div class="module-card" onclick="showProductDomain('traffic')"><div class="module-icon">流</div><div class="module-name">流量与转化</div><div class="module-desc">销售漏斗、自然/广告流量、关键词信号、转化率与异常定位。</div><span class="tag ok"><span class="dot"></span>SP-API + Sif</span></div>
  <div class="module-card" onclick="showProductDomain('price')"><div class="module-icon">价</div><div class="module-name">价格与促销</div><div class="module-desc">售价、参考价、Coupon、Deal、价格历史与促销冲突。</div><span class="tag warn"><span class="dot"></span>待接真实字段</span></div>
  <div class="module-card" onclick="showProductDomain('profit')"><div class="module-icon">利</div><div class="module-name">利润与经营</div><div class="module-desc">收入、平台费、广告费、FBA、采购、头程、贡献利润与毛利率。</div><span class="tag warn"><span class="dot"></span>待接成本层</span></div>
  <div class="module-card" onclick="showProductDomain('experience')"><div class="module-icon">评</div><div class="module-name">消费者体验</div><div class="module-desc">评分、评论、VOC、退货退款信号与 Listing 体验问题。</div><span class="tag warn"><span class="dot"></span>待接数据源</span></div>
</div>
<div class="grid two">
  <div class="card"><div class="section-title"><h2>产品清单</h2><span class="pill">ProductIdentity</span></div><div class="item"><strong>下一步：导入真实 SKU / ASIN / Marketplace</strong><div class="meta">产品不能再靠标题关联。V1.1 将从 Amazon 第一方数据建立稳定 product_id，并让销售、广告、库存、Sif 市场信号全部挂到同一产品身份。</div></div><div class="actions"><button class="btn" onclick="toast('下一步建设：SP-API 产品身份导入')">开始产品身份接入</button></div></div>
  <div class="card"><div class="section-title"><h2>数据链状态</h2><span class="pill ok">2 条已验证</span></div><div class="item"><strong>Amazon → 1122</strong><div class="meta">LWA + Sellers API 真实连接已验证；下一步从连接验证升级为真实商品对象读取。</div></div><div class="item"><strong>Sif → 1122</strong><div class="meta">MCP 初始化、工具目录与真实 ASIN 关键词信号读取已验证。</div></div><div class="item"><strong>Ads → 1122</strong><div class="meta">等待 Amazon Ads API 审核与 OAuth 授权后接入。</div></div></div>
</div>
<div class="card" id="productDomainPanel"><div class="section-title"><h2 id="productDomainTitle">产品运营 V1 接入顺序</h2><span class="pill">工程路线</span></div><div id="productDomainBody" class="meta" style="font-size:13px">ProductIdentity → 商品状态 → 库存/FBA → Sif 市场信号 → Ads API → 利润模型 → Agent/Task 闭环。</div></div>
</section>`;

replaceOnce(
  '</section>\n<section id="website" class="view">',
  `</section>${productCenter}\n<section id="website" class="view">`,
  'insert product center section'
);

replaceOnce(
  '<div class="conn"><h3>Sif</h3><span class="tag warn" id="sifCardStatus"><span class="dot"></span>待配置</span><p>官方 MCP 数据通道。用于关键词、流量、竞品、广告研究和异常诊断。</p>',
  '<div class="conn"><h3>Sif</h3><span class="tag ok" id="sifCardStatus"><span class="dot"></span>已连接</span><p>官方 MCP 数据通道。用于关键词、流量、竞品、广告研究和异常诊断。</p>',
  'Sif connection card status'
);

replaceOnce(
  '<div class="card"><div class="section-title"><h2>实时连接状态</h2><span class="pill warn" id="sifCredentialStatus">等待 SIF_MCP_SECRET</span></div>',
  '<div class="card"><div class="section-title"><h2>实时连接状态</h2><span class="pill ok" id="sifCredentialStatus">Sif MCP 已连接</span></div>',
  'Sif detail status'
);

replaceOnce(
  '<div id="sifConnectionResult" class="connection-result">等待配置 Sif MCP 密钥。</div>',
  '<div id="sifConnectionResult" class="connection-result ok">真实连接已验证：MCP 初始化、工具目录读取与真实 ASIN 数据调用均已成功。</div>',
  'Sif result text'
);

replaceOnce(
  "function openWebsiteCenter(){hideAll();document.getElementById('website').classList.add('show');activate(nav.querySelectorAll('a')[2]);window.scrollTo({top:0,behavior:'smooth'})}",
  `function openProductCenter(){hideAll();document.getElementById('product-center').classList.add('show');activate(nav.querySelectorAll('a')[2]);window.scrollTo({top:0,behavior:'smooth'})}\nfunction showProductDomain(domain){const title=document.getElementById('productDomainTitle');const body=document.getElementById('productDomainBody');const map={traffic:['流量与转化','第一阶段组合 SP-API 第一方经营数据与 Sif MCP 市场/关键词信号。后续 Ads API 接入后补齐自有广告曝光、点击、花费与归因销售。'],price:['价格与促销','接当前售价、参考价、Coupon、Deal 与历史价格；由 Agent-10 做促销冲突和价格异常判断，写操作只生成任务。'],profit:['利润与经营','把订单收入、Amazon Fees、FBA、广告花费与内部采购/头程成本统一到贡献利润口径；最终由利润 Agent 输出经营信号。'],experience:['消费者体验','聚合评分、评论、VOC、退货退款与 Listing 体验问题；由体验 Agent 输出主题、严重度与需要处理的任务。']};title.textContent=map[domain][0];body.textContent=map[domain][1];document.getElementById('productDomainPanel').scrollIntoView({behavior:'smooth',block:'center'})}\nfunction openWebsiteCenter(){hideAll();document.getElementById('website').classList.add('show');activate(nav.querySelectorAll('a')[2]);window.scrollTo({top:0,behavior:'smooth'})}`,
  'product center javascript'
);

fs.writeFileSync(file, html);
console.log('Patched product operations center V1');
