import fs from 'node:fs';

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');

const productCardPattern = /<div class="card"><div class="section-title"><h2>产品清单<\/h2><span class="pill">ProductIdentity<\/span><\/div><div class="item"><strong>下一步：导入真实 SKU \/ ASIN \/ Marketplace<\/strong><div class="meta">产品不能再靠标题关联。V1\.1 将从 Amazon 第一方数据建立稳定 product_id，并让销售、广告、库存、Sif 市场信号全部挂到同一产品身份。<\/div><\/div><div class="actions"><button class="btn" onclick="toast\('下一步建设：SP-API 产品身份导入'\)">开始产品身份接入<\/button><\/div><\/div>/;

const productCardReplacement = `<div class="card"><div class="section-title"><h2>真实产品身份</h2><span class="pill ok" id="productIdentityStatusPill">已建立</span></div>
<div class="item"><strong><span id="productIdentityCount">—</span> 个 US FBA ProductIdentity（产品身份）</strong><div class="meta">真实 SKU / FNSKU / ASIN / 产品名 / 库存明细保存在 Cloudflare KV 私有数据层。公开 1122 只显示数量、更新时间和数据源。</div></div>
<div class="item"><strong>最近刷新</strong><div class="meta" id="productIdentityUpdated">正在读取后端状态…</div></div>
<div class="item"><strong>数据源</strong><div class="meta" id="productIdentitySource">Amazon FBA Inventory API</div></div>
<div class="actions"><button class="btn secondary" onclick="checkProductIdentityStatus()">刷新状态</button></div></div>`;

if (!productCardPattern.test(html)) {
  throw new Error('Missing target: ProductIdentity placeholder card');
}
html = html.replace(productCardPattern, productCardReplacement);

const oldAmazonChain = '<div class="item"><strong>Amazon → 1122</strong><div class="meta">LWA + Sellers API 真实连接已验证；下一步从连接验证升级为真实商品对象读取。</div></div>';
const newAmazonChain = '<div class="item"><strong>Amazon → 1122</strong><div class="meta" id="productIdentityChainText">LWA + Sellers API 已验证；FBA Inventory → ProductIdentity → Cloudflare KV 私有存储链路已建立。</div></div>';
if (!html.includes(oldAmazonChain)) throw new Error('Missing target: Amazon data chain text');
html = html.replace(oldAmazonChain, newAmazonChain);

const oldOpen = "function openProductCenter(){hideAll();document.getElementById('product-center').classList.add('show');activate(nav.querySelectorAll('a')[2]);window.scrollTo({top:0,behavior:'smooth'})}";
const newOpen = "function openProductCenter(){hideAll();document.getElementById('product-center').classList.add('show');activate(nav.querySelectorAll('a')[2]);window.scrollTo({top:0,behavior:'smooth'});setTimeout(checkProductIdentityStatus,120)}";
if (!html.includes(oldOpen)) throw new Error('Missing target: openProductCenter');
html = html.replace(oldOpen, newOpen);

if (!html.includes('async function checkProductIdentityStatus()')) {
  const marker = 'function showProductDomain(domain)';
  if (!html.includes(marker)) throw new Error('Missing target: showProductDomain');
  const fn = `async function checkProductIdentityStatus(){const count=document.getElementById('productIdentityCount');const updated=document.getElementById('productIdentityUpdated');const source=document.getElementById('productIdentitySource');const pill=document.getElementById('productIdentityStatusPill');const chain=document.getElementById('productIdentityChainText');if(!count||!updated||!pill)return;updated.textContent='正在读取 Amazon ProductIdentity 私有数据层状态…';try{const res=await fetch('https://1122-amazon-sp-api-bridge.zhangshuaibing01.workers.dev/product-identity-status',{headers:{'Accept':'application/json'}});const data=await res.json();if(!res.ok||data.success!==true)throw new Error(data.message||data.error||'状态读取失败');if(!data.ready){count.textContent='0';updated.textContent=data.message||'等待首次刷新';pill.textContent='等待刷新';pill.className='pill warn';return}count.textContent=String(data.productCount??0);source.textContent=data.source||'Amazon SP-API';const dt=data.updatedAt?new Date(data.updatedAt):null;updated.textContent=dt&&!Number.isNaN(dt.getTime())?dt.toLocaleString()+' · 明细仅后端可见':'已完成真实刷新 · 明细仅后端可见';pill.textContent='真实数据已建立';pill.className='pill ok';if(chain)chain.textContent='Amazon FBA Inventory → '+String(data.productCount??0)+' 个真实 ProductIdentity → Cloudflare KV 私有存储。公开页面不返回 SKU / ASIN / 库存明细。'}catch(e){updated.textContent='状态读取失败：'+e.message;pill.textContent='状态检查失败';pill.className='pill bad'}}\n`;
  html = html.replace(marker, fn + marker);
}

fs.writeFileSync(path, html);
console.log('ProductIdentity aggregate status UI patched');
