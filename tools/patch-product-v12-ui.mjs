import fs from 'node:fs';

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');

html = html.replace(
  '<div class="banner"><strong>V1 当前阶段：</strong>先建设真实只读数据链。Amazon SP-API 与 Sif MCP 已通过真实连接验证；Amazon Ads API 尚待独立授权。任何改价、改 Listing、广告调整等高影响写操作仍保持关闭。</div>',
  '<div class="banner"><strong>V1 当前阶段：</strong>ProductIdentity V1.1 与商品状态 V1.2 已通过真实只读验证。由于当前 GitHub 主仓仍为 Public（公开仓），SKU / ASIN / Seller ID / 价格 / 库存明细继续只保存在后端私有数据层；公开 UI 仅显示聚合状态。任何改价、改 Listing、广告调整等高影响写操作仍保持关闭。</div>'
);

html = html.replace(
  '<div class="card"><div class="kpi-label">Amazon SP-API</div><div class="kpi-value" style="font-size:20px">已连接</div><div class="meta">自有商品 / 价格 / 库存 / 销售数据源</div></div>',
  '<div class="card"><div class="kpi-label">Amazon SP-API</div><div class="kpi-value" style="font-size:20px">V1.2 已验证</div><div class="meta">真实 ProductIdentity / Listing / Price / FBA 数据链</div></div>'
);

html = html.replace(
  '<div class="module-card" onclick="showProductDomain(\'price\')"><div class="module-icon">价</div><div class="module-name">价格与促销</div><div class="module-desc">售价、参考价、Coupon、Deal、价格历史与促销冲突。</div><span class="tag warn"><span class="dot"></span>待接真实字段</span></div>',
  '<div class="module-card" onclick="showProductDomain(\'price\')"><div class="module-icon">价</div><div class="module-name">价格与促销</div><div class="module-desc">售价、参考价、Coupon、Deal、价格历史与促销冲突。</div><span class="tag ok"><span class="dot"></span>自有价格已接</span></div>'
);

const oldCard = `<div class="item"><strong>最近刷新</strong><div class="meta" id="productIdentityUpdated">正在读取后端状态…</div></div>
<div class="item"><strong>数据源</strong><div class="meta" id="productIdentitySource">Amazon FBA Inventory API</div></div>
<div class="actions"><button class="btn secondary" onclick="checkProductIdentityStatus()">刷新状态</button></div></div>`;

const newCard = `<div class="item"><strong>V1.2 商品状态</strong><div class="meta" id="productV12Status">正在读取 Listing / Price 聚合状态…</div></div>
<div class="item"><strong>最近刷新</strong><div class="meta" id="productIdentityUpdated">正在读取后端状态…</div></div>
<div class="item"><strong>数据源</strong><div class="meta" id="productIdentitySource">Amazon FBA Inventory + Product Pricing + Listings Items</div></div>
<div class="item"><strong>状态语义保护</strong><div class="meta">BUYABLE（可售）等状态字段在语义验证完成前不直接转成经营结论。</div></div>
<div class="actions"><button class="btn secondary" onclick="checkProductIdentityStatus()">刷新状态</button></div></div>`;
if (!html.includes(oldCard)) throw new Error('Missing ProductIdentity card target');
html = html.replace(oldCard, newCard);

const oldFnStart = "async function checkProductIdentityStatus(){";
const oldFnEnd = "\nfunction showProductDomain(domain)";
const start = html.indexOf(oldFnStart);
const end = html.indexOf(oldFnEnd, start);
if (start < 0 || end < 0) throw new Error('Missing checkProductIdentityStatus function');

const newFn = `async function checkProductIdentityStatus(){const count=document.getElementById('productIdentityCount');const updated=document.getElementById('productIdentityUpdated');const source=document.getElementById('productIdentitySource');const pill=document.getElementById('productIdentityStatusPill');const chain=document.getElementById('productIdentityChainText');const v12=document.getElementById('productV12Status');if(!count||!updated||!pill)return;updated.textContent='正在读取 Amazon ProductIdentity 私有数据层状态…';if(v12)v12.textContent='正在读取 Listing / Price 聚合状态…';try{const res=await fetch('https://1122-amazon-sp-api-bridge.zhangshuaibing01.workers.dev/product-identity-status',{headers:{'Accept':'application/json'}});const data=await res.json();if(!res.ok||data.success!==true)throw new Error(data.message||data.error||'状态读取失败');if(!data.ready){count.textContent='0';updated.textContent=data.message||'等待首次刷新';pill.textContent='等待刷新';pill.className='pill warn';if(v12)v12.textContent='等待 V1.2 私有刷新';return}count.textContent=String(data.productCount??0);source.textContent=data.source||'Amazon SP-API';const dt=data.updatedAt?new Date(data.updatedAt):null;updated.textContent=dt&&!Number.isNaN(dt.getTime())?dt.toLocaleString()+' · 明细仅后端可见':'已完成真实刷新 · 明细仅后端可见';pill.textContent='真实数据已建立';pill.className='pill ok';const s=data.v12;if(v12){if(s){v12.textContent='Seller Identity 已解析 · Listing '+String(s.listingResolvedCount??0)+'/'+String(data.productCount??0)+' · 标题 '+String(s.titleResolvedCount??0)+'/'+String(data.productCount??0)+' · 主图 '+String(s.imageResolvedCount??0)+'/'+String(data.productCount??0)+' · 价格 '+String(s.priceResolvedCount??0)+'/'+String(data.productCount??0)+' · API 错误 '+String((s.pricingBatchErrorCount??0)+(s.listingErrorCount??0));}else{v12.textContent='V1.1 已建立；等待 V1.2 商品状态刷新'}}if(chain)chain.textContent='Amazon FBA Inventory → Product Pricing → Listings Items → '+String(data.productCount??0)+' 个真实 ProductIdentity → Cloudflare KV 私有存储。公开页面仅显示聚合完成度，不返回商品经营明细。'}catch(e){updated.textContent='状态读取失败：'+e.message;pill.textContent='状态检查失败';pill.className='pill bad';if(v12)v12.textContent='V1.2 状态读取失败'}}`;
html = html.slice(0, start) + newFn + html.slice(end);

html = html.replace(
  "price:['价格与促销','接当前售价、参考价、Coupon、Deal 与历史价格；由 Agent-10 做促销冲突和价格异常判断，写操作只生成任务。']",
  "price:['价格与促销','自有 Listing Price 已通过 Product Pricing / Listings Items 私有数据链接入；Reference Price、Coupon、Deal 与历史价格继续分阶段补齐。由 Agent-10 做促销冲突和价格异常判断，写操作只生成任务。']"
);

fs.writeFileSync(path, html);
console.log('Product V1.2 aggregate UI patched');
