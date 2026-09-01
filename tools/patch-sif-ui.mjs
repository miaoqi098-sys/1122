import fs from 'node:fs';

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');

const oldCard = '<div class="conn"><h3>Sif</h3><span class="tag warn"><span class="dot"></span>待核实</span><p>授权方式、API/导出通道与字段尚待确认。</p></div>';
const newCard = '<div class="conn"><h3>Sif</h3><span class="tag warn" id="sifCardStatus"><span class="dot"></span>待配置</span><p>官方 MCP 数据通道。用于关键词、流量、竞品、广告研究和异常诊断。</p><div class="actions"><button class="btn" onclick="openSif()">查看 Sif 连接</button></div></div>';
if (html.includes(oldCard)) html = html.replace(oldCard, newCard);

if (!html.includes('<section id="sif" class="view">')) {
  const sifSection = `<section id="sif" class="view">
<div class="crumb">对外连接 / Sif / MCP</div>
<div class="topbar"><div class="title"><h1>Sif MCP 连接</h1><p>MCP（模型上下文协议）· 官方数据通道 · 默认美国站。</p></div><button class="btn secondary" onclick="openView('connections',nav.querySelectorAll('a')[7])">← 返回对外连接</button></div>
<div class="banner"><strong>接入方式：</strong>1122 通过 Sif 官方 Streamable HTTP MCP 接口 <code>https://mcp.sif.com/mcp</code> 连接；MCP 密钥只保存在 Worker Secret 中，不写入前端或 GitHub。</div>
<div class="grid two">
<div class="card"><div class="section-title"><h2>实时连接状态</h2><span class="pill warn" id="sifCredentialStatus">等待 SIF_MCP_SECRET</span></div>
<div class="item"><strong>Sif Bridge</strong><div class="meta">1122-sif-bridge · Cloudflare Workers</div></div>
<div class="item"><strong>MCP Endpoint（接口地址）</strong><div class="meta">https://mcp.sif.com/mcp</div></div>
<div class="item"><strong>认证方式</strong><div class="meta">secret-key Header（请求头）· Worker Secret：SIF_MCP_SECRET</div></div>
<div class="item"><strong>默认 Marketplace（站点）</strong><div class="meta">US（美国站）</div></div>
<div class="actions" style="margin-top:16px"><button class="btn" id="sifConnectBtn" onclick="checkSifConnection()">检查 Sif 连接</button></div>
<div id="sifConnectionResult" class="connection-result">等待配置 Sif MCP 密钥。</div>
</div>
<div class="card"><div class="section-title"><h2>计划接入能力</h2><span class="pill">MCP</span></div>
<div class="item"><strong>关键词研究</strong><div class="meta">反查流量词、关键词需求、历史趋势、竞争格局。</div></div>
<div class="item"><strong>竞品与流量</strong><div class="meta">ASIN 流量结构、关键词信号、变体关键词分布、竞品研究。</div></div>
<div class="item"><strong>广告研究</strong><div class="meta">竞品广告结构、广告流量趋势、Campaign 贡献与变化。</div></div>
<div class="item"><strong>智能诊断</strong><div class="meta">流量异常定位、机会词发现，并向 A3/A4/A5/A1 提供数据。</div></div>
<div class="credential-note"><div class="security-mark">锁</div><div><strong>安全边界</strong><br>1122 不开放任意 MCP JSON-RPC 转发。后续只封装预定义业务接口，避免把 Sif 密钥或完整工具代理暴露到公开网页。</div></div></div>
</div>
</section>\n`;
  const marker = '<section id="email" class="view">';
  if (!html.includes(marker)) throw new Error('Missing target: email section');
  html = html.replace(marker, sifSection + marker);
}

const oldOpenEmail = "function openEmail(){hideAll();document.getElementById('email').classList.add('show');activate(nav.querySelectorAll('a')[7]);window.scrollTo({top:0,behavior:'smooth'});setTimeout(checkEmailConnection,120)}";
if (!html.includes('function openSif()')) {
  const openSif = "function openSif(){hideAll();document.getElementById('sif').classList.add('show');activate(nav.querySelectorAll('a')[7]);window.scrollTo({top:0,behavior:'smooth'});setTimeout(checkSifConnection,120)}\n";
  if (!html.includes(oldOpenEmail)) throw new Error('Missing target: openEmail');
  html = html.replace(oldOpenEmail, openSif + oldOpenEmail);
}

if (!html.includes('async function checkSifConnection()')) {
  const marker = 'async function checkEmailConnection()';
  const fn = `async function checkSifConnection(){const status=document.getElementById('sifCredentialStatus');const card=document.getElementById('sifCardStatus');const btn=document.getElementById('sifConnectBtn');const result=document.getElementById('sifConnectionResult');if(!status||!btn||!result)return;btn.disabled=true;btn.textContent='正在检查…';result.textContent='正在通过 1122 Sif Bridge 初始化 MCP 并读取工具列表…';result.className='connection-result';try{const res=await fetch('https://1122-sif-bridge.zhangshuaibing01.workers.dev/connection-status',{headers:{'Accept':'application/json'}});const data=await res.json();if(!res.ok||data.success!==true)throw new Error(data.error||data.message||'Sif MCP 连接失败');status.textContent='Sif MCP 已连接';status.className='pill ok';if(card){card.innerHTML='<span class="dot"></span>已连接';card.className='tag ok'}result.textContent='连接成功：Sif MCP 初始化完成，协议版本 '+(data.sif?.protocolVersion||'已协商')+'，已识别 '+(data.sif?.toolCount??0)+' 个 MCP Tool。密钥保存在 Worker Secret 中。';result.className='connection-result ok'}catch(e){status.textContent='等待配置/检查失败';status.className='pill warn';result.textContent='尚未连通：'+e.message;result.className='connection-result bad'}finally{btn.disabled=false;btn.textContent='检查 Sif 连接'}}\n`;
  if (!html.includes(marker)) throw new Error('Missing target: checkEmailConnection');
  html = html.replace(marker, fn + marker);
}

fs.writeFileSync(path, html);
console.log('Sif UI patch complete');

// trigger: 2026-09-01
