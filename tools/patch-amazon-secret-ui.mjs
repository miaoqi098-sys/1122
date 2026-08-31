import fs from 'node:fs';

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');

function replaceOnce(search, replacement, label) {
  if (!html.includes(search)) throw new Error(`Missing target: ${label}`);
  html = html.replace(search, replacement);
}

const amazonCard = '<div class="conn"><h3>Amazon API</h3><span class="tag ok"><span class="dot"></span>已连接</span><p>Private Developer、自授权与真实 SP-API 测试已完成；LWA 凭据已迁移至 Worker Secret。</p><div class="actions"><button class="btn" onclick="openAmazon()">配置 Amazon API</button><button class="btn secondary" onclick="openWebsiteCenter()">查看资质官网</button></div></div>';
const emailCard = '<div class="conn"><h3>邮箱</h3><span class="tag warn" id="emailCardStatus"><span class="dot"></span>待配置</span><p>163 邮箱 IMAP 后端桥。用于 Amazon 审核邮件、运营通知和后续任务自动化。</p><div class="actions"><button class="btn" onclick="openEmail()">查看邮箱连接</button></div></div>';
if (!html.includes(emailCard)) {
  replaceOnce(amazonCard, `${amazonCard}\n${emailCard}`, 'email connection card');
}

const emailSection = `<section id="email" class="view">
<div class="crumb">对外连接 / 邮箱 / 163 IMAP</div>
<div class="topbar"><div class="title"><h1>邮箱连接</h1><p>Email Bridge（邮箱桥）· IMAP over TLS（加密收信）· 只读第一阶段。</p></div><button class="btn secondary" onclick="openView('connections',nav.querySelectorAll('a')[7])">← 返回对外连接</button></div>
<div class="banner"><strong>建设目标：</strong>让 1122 自动识别 Amazon Ads API 审核、SP-API、账户绩效和其他重要运营邮件，并在后续转成任务中心事件。</div>
<div class="grid two">
<div class="card"><div class="section-title"><h2>实时连接状态</h2><span class="pill warn" id="emailCredentialStatus">等待邮箱 Secret</span></div>
<div class="item"><strong>Email Bridge（邮箱桥）</strong><div class="meta">1122-email-bridge · Cloudflare Workers</div></div>
<div class="item"><strong>Provider（邮箱服务商）</strong><div class="meta">163 Mail · IMAP over TLS · imap.163.com:993</div></div>
<div class="item"><strong>当前能力</strong><div class="meta">后端登录验证；公开 1122 页面不读取或展示邮件正文。</div></div>
<div class="actions" style="margin-top:16px"><button class="btn" id="emailConnectBtn" onclick="checkEmailConnection()">检查邮箱连接</button></div>
<div id="emailConnectionResult" class="connection-result">等待在 Worker Secret 中配置邮箱账号与客户端授权码。</div>
</div>
<div class="card"><div class="section-title"><h2>接入阶段</h2><span class="pill">Email</span></div>
<div class="item"><strong>✓ Email Bridge 工程</strong><div class="meta">163 IMAP/TLS 后端桥已建立。</div></div>
<div class="item"><strong>○ Worker Secret（后端密钥）</strong><div class="meta">需要 MAILBOX_EMAIL 与 MAILBOX_AUTH_CODE。</div></div>
<div class="item"><strong>○ Amazon 审核邮件监控</strong><div class="meta">邮箱连通后建设 Amazon Ads API 审核邮件识别。</div></div>
<div class="item"><strong>○ 邮件 → 任务中心</strong><div class="meta">重要邮件经过分类后生成待办、提醒或 Agent 事件。</div></div>
<div class="credential-note"><div class="security-mark">锁</div><div><strong>安全边界</strong><br>邮箱密码/授权码不得写入 GitHub 或公开网页。第一阶段只验证后端连接；邮件正文读取要等 1122 身份认证完成后再开放。</div></div></div>
</div>
</section>`;

if (!html.includes('<section id="email" class="view">')) {
  const marker = '<section id="product" class="view">';
  replaceOnce(marker, `${emailSection}\n${marker}`, 'email section');
}

const openAmazon = "function openAmazon(){hideAll();document.getElementById('amazon').classList.add('show');activate(nav.querySelectorAll('a')[7]);window.scrollTo({top:0,behavior:'smooth'});setTimeout(checkAmazonConnection,120)}";
const openEmail = "function openEmail(){hideAll();document.getElementById('email').classList.add('show');activate(nav.querySelectorAll('a')[7]);window.scrollTo({top:0,behavior:'smooth'});setTimeout(checkEmailConnection,120)}";
if (!html.includes(openEmail)) {
  replaceOnce(openAmazon, `${openAmazon}\n${openEmail}`, 'openEmail function');
}

if (!html.includes('async function checkEmailConnection()')) {
  const scriptMarker = '</script>';
  const fn = `async function checkEmailConnection(){const status=document.getElementById('emailCredentialStatus');const card=document.getElementById('emailCardStatus');const btn=document.getElementById('emailConnectBtn');const result=document.getElementById('emailConnectionResult');if(!status||!btn||!result)return;btn.disabled=true;btn.textContent='正在检查…';result.textContent='正在通过 Email Bridge 连接 163 IMAP…';result.className='connection-result';try{const res=await fetch('https://1122-email-bridge.zhangshuaibing01.workers.dev/connection-status',{headers:{'Accept':'application/json'}});const data=await res.json();if(!res.ok||data.success!==true)throw new Error(data.error||data.message||'邮箱连接失败');status.textContent='邮箱已连接';status.className='pill ok';if(card){card.innerHTML='<span class="dot"></span>已连接';card.className='tag ok'}result.textContent='连接成功：163 Mail IMAP/TLS 后端认证通过。长期邮箱凭据只保存在 Worker Secret 中，公开页面未暴露邮件内容。';result.className='connection-result ok'}catch(e){status.textContent='等待配置/检查失败';status.className='pill warn';result.textContent='尚未连通：'+e.message;result.className='connection-result bad'}finally{btn.disabled=false;btn.textContent='检查邮箱连接'}}\n`;
  replaceOnce(scriptMarker, `${fn}${scriptMarker}`, 'email connection function');
}

fs.writeFileSync(path, html);
console.log('Email connection UI patch complete');
