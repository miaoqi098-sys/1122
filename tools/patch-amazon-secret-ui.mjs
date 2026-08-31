import fs from 'node:fs';

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');

function replaceIfPresent(search, replacement) {
  if (html.includes(search)) html = html.replace(search, replacement);
}

replaceIfPresent(
  '<strong>Amazon SP-API：执行真实连接测试</strong><div class="meta">Self-Authorization 已完成，Refresh Token 已取得，正在验证生产 SP-API。</div>',
  '<strong>Amazon SP-API：已连接</strong><div class="meta">Self-Authorization 已完成，LWA 凭据已迁移至 Worker Secret，真实只读 API 已验证。</div>'
);

replaceIfPresent(
  '<div class="item"><strong>Amazon API</strong><div class="meta">Private Developer 与 Self-Authorization 已完成，正在验证真实 SP-API。</div></div>',
  '<div class="item"><strong>Amazon API</strong><div class="meta">Private Developer、自授权、LWA 与 Sellers API 已连通。</div></div>'
);

replaceIfPresent(
  '<span class="tag warn"><span class="dot"></span>待连接验证</span>',
  '<span class="tag ok"><span class="dot"></span>已连接</span>'
);

replaceIfPresent(
  '<p>Private Developer 与 Self-Authorization 已完成；当前进行生产 SP-API 真实连通测试。</p>',
  '<p>Private Developer、自授权与真实 SP-API 测试已完成；LWA 凭据已迁移至 Worker Secret。</p>'
);

const amazonSection = `<section id="amazon" class="view">
<div class="crumb">对外连接 / Amazon API / SP-API</div>
<div class="topbar"><div class="title"><h1>Amazon SP-API 连接</h1><p>Private Developer（私有开发者）· Worker Secret（后端加密密钥）模式 · SORILO 内部应用。</p></div><button class="btn secondary" onclick="openView('connections',nav.querySelectorAll('a')[7])">← 返回对外连接</button></div>
<div class="banner"><strong>当前状态：</strong>Self-Authorization（自授权）已完成，LWA Client ID / Client Secret / Refresh Token 已保存到 Amazon Secure Bridge 的 Worker Secret 中。1122 前端不再接触长期密钥。</div>
<div class="grid two">
<div class="card"><div class="section-title"><h2>实时连接状态</h2><span class="pill ok" id="amzCredentialStatus">后端密钥已配置</span></div>
<div class="item"><strong>Amazon Secure Bridge（亚马逊安全桥）</strong><div class="meta">1122-amazon-sp-api-bridge · Cloudflare Workers</div></div>
<div class="item"><strong>LWA（Login with Amazon）</strong><div class="meta">由后端使用 Refresh Token 自动换取短期 Access Token，长期密钥不进入浏览器。</div></div>
<div class="item"><strong>SP-API Region（区域）</strong><div class="meta">North America（北美）· 美国站主区域</div></div>
<div class="actions" style="margin-top:16px"><button class="btn" id="amzConnectBtn" onclick="checkAmazonConnection()">检查 Amazon 连接</button></div>
<div id="amzConnectionResult" class="connection-result">正在等待后端连接检查。</div>
</div>
<div class="card"><div class="section-title"><h2>接入进度</h2><span class="pill ok">第一阶段完成</span></div>
<div class="item"><strong>✓ Private Developer（私有开发者）</strong><div class="meta">开发者资料审核完成。</div></div>
<div class="item"><strong>✓ Self-Authorization（自授权）</strong><div class="meta">SORILO 北美账户授权完成。</div></div>
<div class="item"><strong>✓ Worker Secret（后端密钥）</strong><div class="meta">Client ID、Client Secret、Refresh Token 已后端化。</div></div>
<div class="item"><strong>✓ Sellers API</strong><div class="meta">getMarketplaceParticipations 已通过真实连接测试。</div></div>
<div class="item"><strong>下一阶段：真实运营数据</strong><div class="meta">商品 Listing → 价格 → 库存/FBA → 财务/销售。写操作继续保持关闭，直到任务中心审批与身份保护完成。</div></div>
<div class="credential-note"><div class="security-mark">锁</div><div><strong>安全边界</strong><br>当前公开页面只允许读取粗粒度连接状态。改价、改标题、删除 Listing 等写操作不会通过公开未认证接口开放。</div></div></div>
</div>
</section>`;

const sectionRegex = /<section id="amazon" class="view">[\s\S]*?<\/section>\n<section id="product"/;
if (!sectionRegex.test(html)) throw new Error('Missing target: amazon section');
html = html.replace(sectionRegex, `${amazonSection}\n<section id="product"`);

const openAmazonOld = "function openAmazon(){hideAll();document.getElementById('amazon').classList.add('show');activate(nav.querySelectorAll('a')[7]);window.scrollTo({top:0,behavior:'smooth'})}";
const openAmazonNew = "function openAmazon(){hideAll();document.getElementById('amazon').classList.add('show');activate(nav.querySelectorAll('a')[7]);window.scrollTo({top:0,behavior:'smooth'});setTimeout(checkAmazonConnection,120)}";
replaceIfPresent(openAmazonOld, openAmazonNew);

const functionRegex = /function setAmazonResult[\s\S]*?function clearAmazonCredentials\(\)\{[\s\S]*?\}\n/;
if (!functionRegex.test(html)) throw new Error('Missing target: Amazon credential functions');
html = html.replace(functionRegex, `function setAmazonResult(message,type){const r=document.getElementById('amzConnectionResult');if(!r)return;r.textContent=message;r.className='connection-result'+(type?' '+type:'')}
async function checkAmazonConnection(){const status=document.getElementById('amzCredentialStatus');const btn=document.getElementById('amzConnectBtn');if(!status||!btn)return;btn.disabled=true;btn.textContent='正在检查…';setAmazonResult('正在通过 Amazon Secure Bridge 检查 LWA 与 Sellers API…');try{const res=await fetch('https://1122-amazon-sp-api-bridge.zhangshuaibing01.workers.dev/connection-status',{method:'GET',headers:{'Accept':'application/json'}});const data=await res.json();if(!res.ok||data.success!==true)throw new Error(data.error||data.message||'连接失败');const markets=(data.spApi?.marketplaces||[]).map(x=>[x.domainName,x.countryCode].filter(Boolean).join(' / ')).join('、');status.textContent='SP-API 已连接';status.className='pill ok';setAmazonResult('连接成功：Amazon LWA 已签发 Access Token，Sellers API getMarketplaceParticipations 调用成功。已识别 '+(data.spApi?.marketplaceCount||0)+' 个 Marketplace'+(markets?'：'+markets:'')+'。长期凭据保存在 Worker Secret 中。','ok')}catch(e){status.textContent='连接检查失败';status.className='pill bad';setAmazonResult('连接失败：'+e.message,'bad')}finally{btn.disabled=false;btn.textContent='检查 Amazon 连接'}}
`);

fs.writeFileSync(path, html);
console.log('Amazon Secret-mode UI patch complete');
