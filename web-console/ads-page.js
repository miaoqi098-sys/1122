(() => {
  const renderers = window.__1122_PAGE_RENDERERS__ ||= {};
  const BRIDGE = 'https://1122-amazon-ads-bridge.zhangshuaibing01.workers.dev';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const knownNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const fmtNumber = (value, digits = 0) => knownNumber(value) ? Number(value).toLocaleString('zh-CN', { maximumFractionDigits: digits }) : '—';
  const fmtTime = value => value ? new Date(value).toLocaleString('zh-CN') : '—';
  const statusKind = value => /CONNECTED|LIVE|ENABLED|ACTIVE|SUCCESS/i.test(String(value)) ? 'ok' : /AUTH_REQUIRED|PAUSED|ARCHIVED|DEGRADED/i.test(String(value)) ? 'warn' : 'bad';
  const tag = value => `<span class="tag tag-${statusKind(value)}">${esc(value ?? 'UNKNOWN')}</span>`;

  function metric(label, value, meta, id = '') {
    return `<div class="card metric-card"><div class="metric-label">${esc(label)}</div><div class="metric-value${String(value).length > 14 ? ' compact-value' : ''}"${id ? ` id="${id}"` : ''}>${esc(value)}</div><div class="metric-meta">${esc(meta)}</div></div>`;
  }

  function loading(title) {
    return `<div class="empty-state compact-empty"><div class="empty-icon" aria-hidden="true">◌</div><h2>${esc(title)}</h2><p>请求设有超时与有限重试；失败会明确显示，不会无限等待。</p></div>`;
  }

  function oauthPanel(open) {
    return `<details class="connection-settings section" ${open ? 'open' : ''}>
      <summary><span>紫鸟手工回跳授权</span><span class="tag tag-neutral">Secret 仅在 Worker</span></summary>
      <div class="connection-settings-body">
        <div class="notice warn" style="margin-top:16px"><strong>准备：</strong>Amazon LWA 的 1122 Ads Integration → Web 设置中需保留 Allowed Return URL <span class="code">https://amazon.com</span>。授权码和完整回跳地址不要发送到聊天、日志或 GitHub。</div>
        <div class="oauth-steps section">
          <div class="oauth-step">
            <div class="oauth-step-title"><span class="step-number">1</span><span>生成并复制一次性授权链接</span></div>
            <p class="item-meta">把链接粘贴到已登录广告账户的紫鸟浏览器地址栏。</p>
            <div class="oauth-actions"><button class="btn btn-primary" id="ads-manual-start" type="button">生成授权链接</button><button class="btn" id="ads-manual-copy" type="button" disabled>复制链接</button></div>
            <label for="ads-manual-url"><span class="field-label">一次性授权链接</span></label>
            <textarea class="oauth-field code" id="ads-manual-url" rows="4" readonly placeholder="生成后会显示授权链接"></textarea>
            <div class="item-meta" id="ads-manual-expiry"></div>
          </div>
          <div class="oauth-step">
            <div class="oauth-step-title"><span class="step-number">2</span><span>在紫鸟中点击“允许”</span></div>
            <p class="item-meta">授权后进入 Amazon 页面是手工回跳流程的预期行为；不要求紫鸟打开 1122。</p>
          </div>
          <div class="oauth-step">
            <div class="oauth-step-title"><span class="step-number">3</span><span>粘贴紫鸟地址栏中的完整 Amazon 地址</span></div>
            <p class="item-meta">地址必须是 HTTPS amazon.com，并同时含 code 与 state；提交后输入框立即清空。</p>
            <label for="ads-manual-return"><span class="field-label">Amazon 回跳地址</span></label>
            <textarea class="oauth-field code" id="ads-manual-return" rows="4" autocomplete="off" spellcheck="false" placeholder="仅粘贴在这里，不要发到聊天"></textarea>
            <div class="oauth-actions"><button class="btn btn-primary" id="ads-manual-complete" type="button">验证并完成授权</button></div>
          </div>
          <div id="ads-manual-status" role="status" aria-live="polite"></div>
        </div>
      </div>
    </details>`;
  }

  function bindOauth(isCurrent) {
    const startButton = document.getElementById('ads-manual-start');
    if (!startButton) return;
    const copyButton = document.getElementById('ads-manual-copy');
    const authUrl = document.getElementById('ads-manual-url');
    const expiry = document.getElementById('ads-manual-expiry');
    const returnUrl = document.getElementById('ads-manual-return');
    const completeButton = document.getElementById('ads-manual-complete');
    const statusBox = document.getElementById('ads-manual-status');

    startButton.addEventListener('click', async () => {
      startButton.disabled = true;
      startButton.setAttribute('aria-busy', 'true');
      copyButton.disabled = true;
      authUrl.value = '';
      expiry.textContent = '';
      statusBox.innerHTML = '<div class="notice">正在生成一次性授权链接…</div>';
      try {
        const result = await window.__1122_FETCH_JSON__(`${BRIDGE}/oauth/manual/start`, {
          timeoutMs: 6000,
          retries: 0,
          validate: value => value?.ok === true && typeof value.authorization_url === 'string' && value.redirect_uri === 'https://amazon.com'
        });
        if (!isCurrent()) return;
        authUrl.value = result.authorization_url;
        copyButton.disabled = false;
        expiry.textContent = `最晚有效时间：${fmtTime(result.expires_at)}；Amazon authorization code 应在约 5 分钟内提交。`;
        statusBox.innerHTML = '<div class="notice ok">链接已生成。复制后到紫鸟浏览器打开。</div>';
      } catch (error) {
        if (isCurrent()) statusBox.innerHTML = `<div class="notice bad">授权链接生成失败：${esc(error.message || 'REQUEST_FAILED')}</div>`;
      } finally {
        if (isCurrent()) { startButton.disabled = false; startButton.removeAttribute('aria-busy'); }
      }
    });

    copyButton.addEventListener('click', async () => {
      if (!authUrl.value) return;
      try {
        await navigator.clipboard.writeText(authUrl.value);
      } catch {
        authUrl.focus();
        authUrl.select();
        document.execCommand('copy');
      }
      statusBox.innerHTML = '<div class="notice ok">授权链接已复制。</div>';
    });

    completeButton.addEventListener('click', async () => {
      const pasted = returnUrl.value.trim();
      if (!pasted) {
        statusBox.innerHTML = '<div class="notice warn">请先粘贴紫鸟地址栏中的完整 Amazon 地址。</div>';
        return;
      }
      returnUrl.value = '';
      completeButton.disabled = true;
      completeButton.setAttribute('aria-busy', 'true');
      statusBox.innerHTML = '<div class="notice">正在由 Worker 换取令牌并校验真实 Profiles…</div>';
      try {
        const result = await window.__1122_FETCH_JSON__(`${BRIDGE}/oauth/manual/complete`, {
          method: 'POST',
          body: JSON.stringify({ return_url: pasted }),
          headers: { 'Content-Type': 'application/json' },
          timeoutMs: 45000,
          retries: 0,
          validate: value => value?.ok === true && value.status === 'CONNECTED' && Number.isInteger(value.profiles_count)
        });
        if (!isCurrent()) return;
        statusBox.innerHTML = `<div class="notice ok">授权成功，已验证 ${esc(result.profiles_count)} 个 Profiles。正在刷新连接状态…</div>`;
        setTimeout(() => window.__1122_RENDER__?.(), 700);
      } catch (error) {
        if (!isCurrent()) return;
        statusBox.innerHTML = `<div class="notice bad">授权失败：${esc(error.message || 'REQUEST_FAILED')}。请重新生成链接再试；旧连接不会被伪造为成功。</div>`;
        completeButton.disabled = false;
        completeButton.removeAttribute('aria-busy');
      }
    });
  }

  function renderProfilesTable(profiles) {
    return `<div class="table-wrap"><table><caption>${profiles.length} 个 Amazon Ads Profiles；不显示 Token。</caption><thead><tr><th scope="col">Profile ID</th><th scope="col">国家</th><th scope="col">币种</th><th scope="col">时区</th><th scope="col">Account ID</th><th scope="col">Type</th></tr></thead><tbody>${profiles.map(profile => `<tr><td class="code">${esc(profile.profileId)}</td><td>${esc(profile.countryCode)}</td><td>${esc(profile.currencyCode)}</td><td>${esc(profile.timezone)}</td><td class="code">${esc(profile.accountId || '—')}</td><td>${esc(profile.accountType || '—')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderWorkbench(profiles) {
    const defaultProfile = profiles.find(profile => profile.countryCode === 'US') || profiles[0];
    return `
      <section class="card section card-elevated">
        <div class="section-head"><div><h2>广告结构</h2><div class="section-sub">Profile → Campaign → Ad Group · 只读</div></div><span class="tag tag-ok">AMAZON ADS API</span></div>
        <div class="ads-toolbar">
          <label><span class="field-label">广告 Profile</span><select id="ads-profile-select" class="field">${profiles.map(profile => `<option value="${esc(profile.profileId)}" ${profile.profileId === defaultProfile?.profileId ? 'selected' : ''}>${esc(profile.countryCode)} · ${esc(profile.accountType || 'Account')} · ${esc(profile.currencyCode)}</option>`).join('')}</select></label>
          <label><span class="field-label">Campaign 名称</span><input id="ads-campaign-search" class="field" type="search" placeholder="筛选活动名称" /></label>
          <label><span class="field-label">Campaign 状态</span><select id="ads-campaign-state" class="field"><option value="">全部状态</option><option value="ENABLED">ENABLED</option><option value="PAUSED">PAUSED</option><option value="ARCHIVED">ARCHIVED</option></select></label>
          <button id="ads-load-structure" class="btn btn-primary" type="button">刷新广告结构</button>
        </div>
      </section>
      <div class="grid grid-4 section">
        ${metric('选中 Profile', defaultProfile ? `${defaultProfile.countryCode} / ${defaultProfile.currencyCode}` : '—', defaultProfile?.profileId || '未选择', 'ads-selected-profile')}
        ${metric('Campaigns', '—', '等待读取', 'ads-campaign-count')}
        ${metric('Ad Groups', '—', '等待读取', 'ads-adgroup-count')}
        ${metric('数据检查时间', '—', 'Amazon Ads API', 'ads-structure-checked')}
      </div>
      <div id="ads-structure-result" class="section">${loading('正在读取广告结构')}</div>
    `;
  }

  function bindWorkbench(profiles, isCurrent) {
    const profileSelect = document.getElementById('ads-profile-select');
    if (!profileSelect) return;
    const search = document.getElementById('ads-campaign-search');
    const stateFilter = document.getElementById('ads-campaign-state');
    const loadButton = document.getElementById('ads-load-structure');
    const target = document.getElementById('ads-structure-result');
    let requestGeneration = 0;
    let campaigns = [];
    let adGroups = [];
    let selectedCampaignId = null;

    function currentProfile() {
      return profiles.find(profile => profile.profileId === profileSelect.value) || null;
    }

    function renderStructure() {
      const query = search.value.trim().toLowerCase();
      const wantedState = stateFilter.value;
      const visible = campaigns.filter(campaign => (!query || `${campaign.name} ${campaign.campaignId} ${campaign.state}`.toLowerCase().includes(query)) && (!wantedState || campaign.state === wantedState));
      if (!visible.some(campaign => campaign.campaignId === selectedCampaignId)) selectedCampaignId = visible[0]?.campaignId || null;
      const selected = campaigns.find(campaign => campaign.campaignId === selectedCampaignId);
      const groups = selected ? adGroups.filter(group => group.campaignId === selected.campaignId) : [];
      target.innerHTML = `
        <div class="ads-structure">
          <section class="card campaign-panel">
            <div class="section-head"><div><h2>Campaigns</h2><div class="section-sub">显示 ${visible.length} / ${campaigns.length}</div></div></div>
            <div class="campaign-list">${visible.length ? visible.map(campaign => `
              <button class="campaign-row ${campaign.campaignId === selectedCampaignId ? 'active' : ''}" type="button" data-campaign-id="${esc(campaign.campaignId)}" aria-pressed="${campaign.campaignId === selectedCampaignId}">
                <span class="campaign-row-top"><span class="campaign-name">${esc(campaign.name || '未命名 Campaign')}</span>${tag(campaign.state)}</span>
                <span class="campaign-meta">Budget ${fmtNumber(campaign.budget, 2)} · ${esc(campaign.targetingType || '—')} · ID ${esc(campaign.campaignId)}</span>
              </button>`).join('') : '<div class="empty-state compact-empty"><h3>0 个匹配 Campaign</h3><p>这是当前筛选结果，不是请求失败。</p></div>'}</div>
          </section>
          <section class="card adgroup-panel">
            <div class="section-head"><div><h2>Ad Groups</h2><div class="section-sub">${selected ? esc(selected.name) : '请先选择 Campaign'}</div></div>${selected ? tag(selected.state) : ''}</div>
            <div class="adgroup-list">${selected ? (groups.length ? groups.map(group => `
              <article class="adgroup-card"><div class="adgroup-name">${esc(group.name || '未命名 Ad Group')}</div><div class="adgroup-meta">${tag(group.state)}<span>Default bid ${fmtNumber(group.defaultBid, 2)}</span><span class="code">ID ${esc(group.adGroupId)}</span></div></article>`).join('') : '<div class="empty-state compact-empty"><h3>0 个 Ad Group</h3><p>选中 Campaign 当前未返回广告组。</p></div>') : '<div class="empty-state compact-empty"><h3>未选择 Campaign</h3><p>从左侧列表选择一个广告活动。</p></div>'}</div>
          </section>
        </div>`;
      target.querySelectorAll('[data-campaign-id]').forEach(button => button.addEventListener('click', () => {
        selectedCampaignId = button.dataset.campaignId;
        renderStructure();
      }));
    }

    async function loadStructure() {
      const generation = ++requestGeneration;
      const profile = currentProfile();
      if (!profile) return;
      loadButton.disabled = true;
      loadButton.setAttribute('aria-busy', 'true');
      target.innerHTML = loading(`正在读取 ${profile.countryCode} 广告结构`);
      document.getElementById('ads-selected-profile').textContent = `${profile.countryCode} / ${profile.currencyCode}`;
      document.getElementById('ads-campaign-count').textContent = '—';
      document.getElementById('ads-adgroup-count').textContent = '—';
      try {
        const [campaignPayload, groupPayload] = await Promise.all([
          window.__1122_FETCH_JSON__(`${BRIDGE}/campaigns?profile_id=${encodeURIComponent(profile.profileId)}`, {
            timeoutMs: 9000, retries: 1,
            validate: value => value?.ok === true && Array.isArray(value.campaigns) && value.campaigns.every(item => typeof item.campaignId === 'string' && typeof item.name === 'string')
          }),
          window.__1122_FETCH_JSON__(`${BRIDGE}/ad-groups?profile_id=${encodeURIComponent(profile.profileId)}`, {
            timeoutMs: 9000, retries: 1,
            validate: value => value?.ok === true && Array.isArray(value.ad_groups) && value.ad_groups.every(item => typeof item.adGroupId === 'string' && typeof item.campaignId === 'string' && typeof item.name === 'string')
          })
        ]);
        if (generation !== requestGeneration || !isCurrent()) return;
        campaigns = campaignPayload.campaigns;
        adGroups = groupPayload.ad_groups;
        selectedCampaignId = campaigns[0]?.campaignId || null;
        document.getElementById('ads-campaign-count').textContent = String(campaigns.length);
        document.getElementById('ads-adgroup-count').textContent = String(adGroups.length);
        const checked = campaignPayload.checked_at || groupPayload.checked_at;
        const checkedNode = document.getElementById('ads-structure-checked');
        checkedNode.textContent = checked ? new Date(checked).toLocaleTimeString('zh-CN') : '—';
        checkedNode.title = checked || '';
        renderStructure();
      } catch (error) {
        if (generation !== requestGeneration || !isCurrent()) return;
        campaigns = [];
        adGroups = [];
        target.innerHTML = `<div class="notice bad"><strong>广告结构读取失败：</strong>${esc(error.message || 'REQUEST_FAILED')}。Campaign / Ad Group 数量保持未知，而不是显示 0。 <button id="ads-structure-retry" class="btn btn-quiet" type="button">重试</button></div>`;
        document.getElementById('ads-structure-retry')?.addEventListener('click', loadStructure);
      } finally {
        if (generation === requestGeneration && isCurrent()) {
          loadButton.disabled = false;
          loadButton.removeAttribute('aria-busy');
        }
      }
    }

    search.addEventListener('input', renderStructure);
    stateFilter.addEventListener('change', renderStructure);
    profileSelect.addEventListener('change', loadStructure);
    loadButton.addEventListener('click', loadStructure);
    loadStructure();
  }

  async function renderAds({ route, view, setChrome, isCurrent }) {
    const settingsMode = route === '/connectors/amazon-ads';
    setChrome(settingsMode ? 'Amazon Ads 连接设置' : '广告运营', settingsMode ? '系统 / 对外连接 / Amazon Ads' : '经营 / 运营 / 广告');
    view.innerHTML = `
      <div class="hero"><div><div class="hero-eyebrow">AMAZON ADS</div><h2>${settingsMode ? '连接、授权与 Profiles' : 'Campaign 与 Ad Group 工作台'}</h2><p>正在读取真实 Amazon Ads 连接状态。令牌不会在浏览器中显示或保存。</p></div></div>
      ${loading('正在检查 Amazon Ads')}`;
    const health = await window.__1122_CONNECTORS__.read('amazon-ads');
    if (!isCurrent()) return;
    const details = health.details || {};
    const connected = health.status === 'CONNECTED';
    let profiles = [];
    let profileError = null;
    if (connected) {
      try {
        const payload = await window.__1122_FETCH_JSON__(`${BRIDGE}/profiles`, {
          timeoutMs: 7000,
          retries: 1,
          validate: value => value?.ok === true && Array.isArray(value.profiles) && value.profiles.every(profile => typeof profile.profileId === 'string' && typeof profile.countryCode === 'string' && typeof profile.currencyCode === 'string' && typeof profile.timezone === 'string')
        });
        profiles = payload.profiles;
      } catch (error) {
        profileError = error;
      }
    }
    if (!isCurrent()) return;

    const actions = settingsMode
      ? '<a class="btn btn-primary" href="#/operations/ads">打开广告工作台</a><a class="btn" href="#/connectors">返回连接中心</a>'
      : '<a class="btn btn-primary" href="#/connectors/amazon-ads">连接设置</a><a class="btn" href="#/operations/products">产品中心</a>';
    view.innerHTML = `
      <div class="source-bar"><span class="source-label">Amazon Ads Bridge</span>${tag(health.status)}<span>NA</span><span>Checked ${esc(fmtTime(health.checked_at))}</span><span>只读</span></div>
      <div class="hero">
        <div><div class="hero-eyebrow">${settingsMode ? 'CONNECTOR SETTINGS' : 'ADS OPERATIONS'}</div><h2>${settingsMode ? 'Amazon Ads 连接设置' : 'Amazon Ads 广告工作台'}</h2><p>${settingsMode ? '管理紫鸟手工回跳授权并验证 Profiles；Client Secret 与 Refresh Token 始终留在 Worker / 加密存储。' : '选择一个广告 Profile，读取真实 Campaigns 与 Ad Groups。预算、竞价和状态修改仍未开放。'}</p></div>
        <div class="hero-actions">${actions}</div>
      </div>
      <div class="grid grid-4 section">
        ${metric('连接状态', health.status, health.error?.message || '真实后端状态')}
        ${metric('区域', details.region || 'NA', '代码已预留 EU / FE')}
        ${metric('Profiles', connected ? (profileError ? '—' : profiles.length) : '—', profileError ? '读取失败' : '真实 API 校验')}
        ${metric('最近令牌检查', fmtTime(details.last_token_refresh || health.checked_at), '不显示 Token')}
      </div>
      ${health.error ? `<div class="notice ${connected ? 'warn' : 'bad'} section"><strong>${esc(health.error.stage || health.error.code || '连接异常')}：</strong>${esc(health.error.message || '未知错误')}</div>` : ''}
      ${profileError ? `<div class="notice bad section">Profiles 读取失败：${esc(profileError.message)}。不会将连接状态伪造成可用数据。</div>` : ''}
      ${settingsMode
        ? `${profiles.length ? `<section class="section"><div class="section-head"><div><h2>已授权 Profiles</h2><div class="section-sub">国家、币种、时区与账户标识</div></div></div>${renderProfilesTable(profiles)}</section>` : ''}${oauthPanel(!connected)}`
        : `${connected && profiles.length ? renderWorkbench(profiles) : `<div class="empty-state"><div class="empty-icon">◌</div><h2>${connected ? 'Profiles 暂不可用' : '需要完成 Amazon Ads 授权'}</h2><p>${connected ? '连接检查成功，但 Profiles 读取失败或为空。' : '进入连接设置，通过紫鸟完成授权后再读取广告结构。'}</p><div style="margin-top:16px"><a class="btn btn-primary" href="#/connectors/amazon-ads">打开连接设置</a></div></div>`}`}
      ${!settingsMode ? '<details class="connection-settings section"><summary><span>连接与授权说明</span><span class="tag tag-neutral">设置已独立</span></summary><div class="connection-settings-body"><p class="item-meta" style="margin-top:16px">重新授权已移到独立连接设置页，避免在已连接状态下遮挡广告业务数据。</p><a class="btn" href="#/connectors/amazon-ads">打开 Amazon Ads 连接设置</a></div></details>' : ''}
      <div class="notice section">当前开放：Profiles / Campaigns / Ad Groups 只读。Keywords、Targets、Search Terms 与 Reports 尚未接入；所有广告写操作保持关闭。</div>
    `;
    if (settingsMode) bindOauth(isCurrent);
    else if (connected && profiles.length) bindWorkbench(profiles, isCurrent);
  }

  renderers['/operations/ads'] = renderAds;
  renderers['/connectors/amazon-ads'] = renderAds;
})();
