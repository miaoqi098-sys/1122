const WEB_ORIGINS = new Set([
  "https://1122.sorilo-uk.com",
  "https://1122-web-agent.pages.dev",
  "https://miaoqi098-sys.github.io",
]);
const NA = { lwaAuthorize: "https://www.amazon.com/ap/oa", lwaToken: "https://api.amazon.com/auth/o2/token", adsApi: "https://advertising-api.amazon.com" };
const REGIONS = { na: NA, eu: { lwaAuthorize: "https://www.amazon.co.uk/ap/oa", lwaToken: "https://api.amazon.co.uk/auth/o2/token", adsApi: "https://advertising-api-eu.amazon.com" }, fe: { lwaAuthorize: "https://www.amazon.co.jp/ap/oa", lwaToken: "https://api.amazon.co.jp/auth/o2/token", adsApi: "https://advertising-api-fe.amazon.com" } };
const OAUTH_STATE_TTL_SECONDS = 600;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_ADS_LIST_PAGES = 25;
const MANUAL_REDIRECT_URL = "https://amazon.com";
const MAX_MANUAL_CALLBACK_BYTES = 8192;
const CAMPAIGN_STATE_CONFIRMATION = "APPLY CAMPAIGN STATE";
const TRUSTED_ORIGIN_PATHS = new Set(["/oauth/manual/start", "/oauth/manual/complete", "/profiles", "/campaigns", "/ad-groups", "/write-intents/campaign-state"]);

function now() { return new Date().toISOString(); }
function configured(env) { return Boolean(String(env.AMAZON_ADS_CLIENT_ID || "").trim() && String(env.AMAZON_ADS_CLIENT_SECRET || "").trim()); }
function writeGateConfigured(env) { return Boolean(String(env.AMAZON_ADS_WRITE_ACCESS_KEY || "").trim()); }
function cors(origin) {
  const headers = { "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key, X-1122-Ads-Write-Key", "Access-Control-Max-Age": "86400", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Vary": "Origin" };
  if (origin && WEB_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
function json(payload, status = 200, origin = "") { return new Response(JSON.stringify(payload), { status, headers: { ...cors(origin), "Content-Type": "application/json; charset=UTF-8" } }); }
function error(stage, code, status, origin, message) { return json({ ok: false, error: { stage, code, message }, checked_at: now() }, status, origin); }
function base64url(bytes) { return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
function randomToken() { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return base64url(bytes); }
async function sha256(value) { return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))); }
function fixedTimeEqual(leftValue, rightValue) {
  const left = new TextEncoder().encode(String(leftValue || ""));
  const right = new TextEncoder().encode(String(rightValue || ""));
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) mismatch |= (left[index] || 0) ^ (right[index] || 0);
  return mismatch === 0;
}
function regionFromState(state, flow) {
  const match = new RegExp(`^${flow}\\.(na|eu|fe)\\.`).exec(String(state || ""));
  return match && REGIONS[match[1]] ? match[1] : null;
}
function allowedManualReturnHosts(region) {
  return region === "eu" ? new Set(["amazon.co.uk", "www.amazon.co.uk"])
    : region === "fe" ? new Set(["amazon.co.jp", "www.amazon.co.jp"])
      : new Set(["amazon.com", "www.amazon.com"]);
}
async function createOauthState(env, flow) {
  const state = `${flow}.${randomToken()}`;
  const created = now();
  const expires = new Date(Date.now() + OAUTH_STATE_TTL_SECONDS * 1000).toISOString();
  await env.CORE_DB.prepare("DELETE FROM amazon_ads_oauth_states WHERE expires_at < ?").bind(created).run();
  await env.CORE_DB.prepare("INSERT INTO amazon_ads_oauth_states (state_hash, expires_at, created_at) VALUES (?, ?, ?)").bind(await sha256(state), expires, created).run();
  return { state, expires };
}
async function consumeOauthState(env, state, flow) {
  if (!String(state).startsWith(`${flow}.`)) return false;
  const row = await env.CORE_DB.prepare("DELETE FROM amazon_ads_oauth_states WHERE state_hash = ? AND expires_at >= ? RETURNING state_hash").bind(await sha256(state), now()).first();
  return Boolean(row);
}
function regionFor(url) { const raw = String(url.searchParams.get("region") || "na").toLowerCase(); return REGIONS[raw] ? raw : "na"; }
function callbackUrl(request) { return new URL("/oauth/callback", request.url).toString(); }
function publicCallbackUrl(env, request) { return String(env.AMAZON_ADS_REDIRECT_URI || callbackUrl(request)).trim(); }
async function fetchBounded(url, init) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: controller.signal }); } finally { clearTimeout(timer); }
}
function delay(milliseconds) { return new Promise(resolve => setTimeout(resolve, milliseconds)); }
async function fetchReadWithRetry(url, init) {
  let response;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await fetchBounded(url, init);
    if (response.ok || ![429, 500, 502, 503, 504].includes(response.status) || attempt === 1) return response;
    const retryAfter = Number(response.headers.get("Retry-After"));
    await delay(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 1_000) : 250);
  }
  return response;
}
function classifyAdsFailure(cause) {
  const text = String(cause?.message || cause || "ADS_REQUEST_FAILED");
  const match = /(?:ADS_API|LWA_TOKEN|ADS_NON_JSON)_(\d{3})/.exec(text);
  const status = Number(match?.[1] || 0);
  if (status === 401) return { stage: "authorization", code: "AMAZON_UNAUTHORIZED", message: "Amazon 授权已失效或无法换取访问令牌。" };
  if (status === 403) return { stage: "permission", code: "AMAZON_PERMISSION_DENIED", message: "当前 Amazon Ads 用户或 Profile 没有执行该操作的权限。" };
  if (status === 429) return { stage: "rate-limit", code: "AMAZON_RATE_LIMITED", message: "Amazon Ads 暂时限流，请稍后重试。" };
  if (status >= 500) return { stage: "ads-api", code: "AMAZON_UPSTREAM_UNAVAILABLE", message: "Amazon Ads 服务暂时不可用，请稍后重试。" };
  if (/TOKEN_STORAGE/.test(text)) return { stage: "storage", code: "TOKEN_STORAGE_ERROR", message: "受保护的令牌存储暂时不可用。" };
  if (/AbortError|TIMEOUT/.test(text)) return { stage: "network", code: "AMAZON_TIMEOUT", message: "Amazon Ads 请求超时，请稍后重试。" };
  return { stage: "ads-api", code: "CONNECTION_CHECK_FAILED", message: "Amazon Ads 连接检查未完成。" };
}
async function tokenRequest(region, body) {
  const response = await fetchBounded(REGIONS[region].lwaToken, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", Accept: "application/json" }, body: new URLSearchParams(body) });
  let data; try { data = await response.json(); } catch { throw new Error(`LWA_NON_JSON_${response.status}`); }
  if (!response.ok || !data?.access_token) throw new Error(`LWA_TOKEN_${response.status}_${data?.error || "INVALID_RESPONSE"}`);
  return data;
}
async function encryptionKey(env) {
  const raw = String(env.AMAZON_ADS_TOKEN_ENCRYPTION_KEY || "").trim();
  if (!raw) throw new Error("TOKEN_STORAGE_NOT_CONFIGURED");
  return crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function encrypt(env, text) { const iv = new Uint8Array(12); crypto.getRandomValues(iv); const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(env), new TextEncoder().encode(text)); return `${base64url(iv)}.${base64url(new Uint8Array(cipher))}`; }
function fromBase64url(value) { const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4); return Uint8Array.from(atob(padded), c => c.charCodeAt(0)); }
async function decrypt(env, value) { const [ivText, dataText] = String(value).split("."); if (!ivText || !dataText) throw new Error("TOKEN_STORAGE_INVALID"); const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64url(ivText) }, await encryptionKey(env), fromBase64url(dataText)); return new TextDecoder().decode(plain); }
async function storedRefreshToken(env) {
  const secret = String(env.AMAZON_ADS_REFRESH_TOKEN || "").trim();
  if (env.CORE_DB) {
    try {
      const row = await env.CORE_DB.prepare("SELECT encrypted_refresh_token, last_token_refresh_at FROM amazon_ads_credentials WHERE credential_key = 'primary'").first();
      if (row?.encrypted_refresh_token) return {
        token: await decrypt(env, row.encrypted_refresh_token),
        source: "encrypted-d1",
        lastTokenRefreshAt: row.last_token_refresh_at || null,
      };
    } catch (cause) {
      if (!secret) throw cause;
    }
  }
  return secret ? { token: secret, source: "worker-secret-fallback", lastTokenRefreshAt: null } : null;
}
async function storeRefreshToken(env, refreshToken) {
  const encrypted = await encrypt(env, refreshToken);
  const updated = now();
  await env.CORE_DB.prepare("INSERT INTO amazon_ads_credentials (credential_key, encrypted_refresh_token, updated_at, last_token_refresh_at) VALUES ('primary', ?, ?, ?) ON CONFLICT(credential_key) DO UPDATE SET encrypted_refresh_token=excluded.encrypted_refresh_token, updated_at=excluded.updated_at, last_token_refresh_at=excluded.last_token_refresh_at").bind(encrypted, updated, updated).run();
}
async function markTokenRefreshed(env) {
  if (!env.CORE_DB) return null;
  const refreshedAt = now();
  await env.CORE_DB.prepare(
    "UPDATE amazon_ads_credentials SET last_token_refresh_at=? WHERE credential_key='primary'"
  ).bind(refreshedAt).run();
  return refreshedAt;
}
async function readSmallJson(request) {
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_MANUAL_CALLBACK_BYTES) throw new Error("REQUEST_TOO_LARGE");
  if (!request.body) throw new Error("REQUEST_BODY_REQUIRED");
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_MANUAL_CALLBACK_BYTES) { await reader.cancel(); throw new Error("REQUEST_TOO_LARGE"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
async function status(env, region) {
  const checked_at = now();
  const write = {
    mode: writeGateConfigured(env) ? "operator-gated" : "not-configured",
    operator_gate_configured: writeGateConfigured(env),
    confirmation_required: true,
    actions: ["sp-campaign-state"],
  };
  if (!configured(env)) return { connector_id: "amazon-ads", status: "AUTH_REQUIRED", checked_at, source: "ads-bridge", capabilities: ["oauth"], details: { region, profiles_count: 0, last_token_refresh: null }, write, error: { stage: "configuration", code: "MISSING_CLIENT_CREDENTIALS", message: "Amazon Ads Client ID / Client Secret 尚未配置为 Worker Secret。" } };
  try {
    const token = await storedRefreshToken(env);
    if (!token) return { connector_id: "amazon-ads", status: "AUTH_REQUIRED", checked_at, source: "ads-bridge", capabilities: ["oauth"], details: { region, profiles_count: 0, last_token_refresh: null }, write, error: { stage: "authorization", code: "MISSING_REFRESH_TOKEN", message: "尚未完成 Amazon Ads 授权。" } };
    const profiles = await listProfiles(env, region, token.token);
    if (!profiles.length) throw new Error("PROFILES_EMPTY");
    await pinProfiles(env, profiles);
    const refreshed = await storedRefreshToken(env);
    return {
      connector_id: "amazon-ads", status: "CONNECTED", checked_at, source: "ads-bridge",
      capabilities: ["profiles", "campaigns-readonly", "ad-groups-readonly", ...(write.operator_gate_configured ? ["sp-campaign-state-write"] : [])],
      details: { region, profiles_count: profiles.length, last_token_refresh: refreshed?.lastTokenRefreshAt || token.lastTokenRefreshAt, credential_source: token.source },
      write,
      error: null,
    };
  } catch (cause) {
    const detail = classifyAdsFailure(cause);
    return { connector_id: "amazon-ads", status: "DEGRADED", checked_at, source: "ads-bridge", capabilities: ["oauth"], details: { region, profiles_count: 0, last_token_refresh: null }, write, error: detail };
  }
}
function apiId(value, field) {
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return value.trim();
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  throw new Error(`${field}_INVALID_OR_UNSAFE`);
}
// Amazon profile/accountInfo.id is an opaque advertiser identifier and may be alphanumeric.
function opaqueId(value, field) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length > 0 && normalized.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(normalized)) return normalized;
  }
  throw new Error(`${field}_INVALID`);
}
function finiteNumberOrNull(value) { return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null; }
function validProfile(x) {
  if (!x || typeof x !== "object" || typeof x.countryCode !== "string" || !/^[A-Z]{2}$/.test(x.countryCode) || typeof x.currencyCode !== "string" || !/^[A-Z]{3}$/.test(x.currencyCode) || typeof x.timezone !== "string" || !x.timezone || !x.accountInfo || typeof x.accountInfo !== "object") return false;
  try { apiId(x.profileId, "PROFILE_ID"); opaqueId(x.accountInfo.id, "ACCOUNT_ID"); return true; } catch { return false; }
}
async function adsAccessToken(env, region, refreshToken) {
  const token = await tokenRequest(region, { grant_type: "refresh_token", refresh_token: refreshToken, client_id: env.AMAZON_ADS_CLIENT_ID, client_secret: env.AMAZON_ADS_CLIENT_SECRET });
  await markTokenRefreshed(env);
  return token;
}
async function adsGet(env, region, path, profileId, refreshToken) { const auth = await adsAccessToken(env, region, refreshToken); const response = await fetchReadWithRetry(`${REGIONS[region].adsApi}${path}`, { headers: { Authorization: `Bearer ${auth.access_token}`, "Amazon-Advertising-API-ClientId": env.AMAZON_ADS_CLIENT_ID, ...(profileId ? { "Amazon-Advertising-API-Scope": String(profileId) } : {}), Accept: "application/json" } }); let payload; try { payload = await response.json(); } catch { throw new Error(`ADS_NON_JSON_${response.status}`); } if (!response.ok) throw new Error(`ADS_API_${response.status}_${String(payload?.code || "FAILED").slice(0, 48)}`); return payload; }
async function adsPostWithAccessToken(env, region, path, profileId, mediaType, body, accessToken) { const response = await fetchReadWithRetry(`${REGIONS[region].adsApi}${path}`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Amazon-Advertising-API-ClientId": env.AMAZON_ADS_CLIENT_ID, "Amazon-Advertising-API-Scope": String(profileId), Accept: mediaType, "Content-Type": mediaType }, body: JSON.stringify(body) }); let payload; try { payload = await response.json(); } catch { throw new Error(`ADS_NON_JSON_${response.status}`); } if (!response.ok) throw new Error(`ADS_API_${response.status}_${String(payload?.code || "FAILED").slice(0, 48)}`); return payload; }
async function adsPutCampaignState(env, region, profileId, campaignId, state, accessToken) {
  const mediaType = "application/vnd.spCampaign.v3+json";
  const response = await fetchBounded(`${REGIONS[region].adsApi}/sp/campaigns`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Amazon-Advertising-API-ClientId": env.AMAZON_ADS_CLIENT_ID,
      "Amazon-Advertising-API-Scope": String(profileId),
      Prefer: "return=representation",
      Accept: mediaType,
      "Content-Type": mediaType,
    },
    body: JSON.stringify({ campaigns: [{ campaignId: String(campaignId), state }] }),
  });
  let payload;
  try { payload = await response.json(); } catch { throw new Error(`ADS_NON_JSON_${response.status}`); }
  if (!response.ok || (Array.isArray(payload?.campaigns?.error) && payload.campaigns.error.length)) {
    throw new Error(`ADS_API_${response.status}_${String(payload?.code || payload?.campaigns?.error?.[0]?.code || "FAILED").slice(0, 48)}`);
  }
  return { payload, requestId: response.headers.get("x-amzn-requestid") || response.headers.get("x-amz-rid") || null };
}
async function listProfiles(env, region, refreshToken) { const payload = await adsGet(env, region, "/v2/profiles", null, refreshToken); if (!Array.isArray(payload) || !payload.every(validProfile)) throw new Error("PROFILES_SCHEMA_INVALID"); return payload.map(x => ({ profileId: apiId(x.profileId, "PROFILE_ID"), countryCode: x.countryCode, currencyCode: x.currencyCode, timezone: x.timezone, accountId: opaqueId(x.accountInfo.id, "ACCOUNT_ID"), accountType: typeof x.accountInfo.type === "string" ? x.accountInfo.type : null, region })); }
async function profileHash(profile) { return sha256(`${profile.region}:${profile.profileId}`); }
async function readProfilePins(env) {
  if (!env.CORE_DB) return [];
  const result = await env.CORE_DB.prepare("SELECT profile_hash FROM amazon_ads_profile_pins WHERE credential_key = 'primary'").all();
  return Array.isArray(result?.results) ? result.results.map(row => String(row.profile_hash || "")).filter(Boolean) : [];
}
async function pinProfiles(env, profiles) {
  if (!env.CORE_DB || !profiles.length) return;
  const observed = now();
  const statements = await Promise.all(profiles.map(async profile => env.CORE_DB.prepare("INSERT INTO amazon_ads_profile_pins (credential_key, region, profile_hash, created_at, last_seen_at) VALUES ('primary', ?, ?, ?, ?) ON CONFLICT(credential_key, region, profile_hash) DO UPDATE SET last_seen_at=excluded.last_seen_at").bind(profile.region, await profileHash(profile), observed, observed)));
  await env.CORE_DB.batch(statements);
}
async function verifyAccountContinuity(env, region, candidateProfiles) {
  let pins = await readProfilePins(env);
  if (!pins.length) {
    const current = await storedRefreshToken(env);
    if (!current) return;
    let existingProfiles;
    try { existingProfiles = await listProfiles(env, region, current.token); } catch { throw new Error("EXISTING_AUTHORIZATION_UNVERIFIABLE"); }
    await pinProfiles(env, existingProfiles);
    pins = await readProfilePins(env);
  }
  const candidateHashes = new Set(await Promise.all(candidateProfiles.map(profileHash)));
  if (!pins.some(pin => candidateHashes.has(pin))) throw new Error("AUTHORIZED_ACCOUNT_MISMATCH");
}
async function pagedAdsList(env, region, profileId, path, mediaType, collectionKey, initialBody, refreshToken) {
  const auth = await adsAccessToken(env, region, refreshToken);
  const items = [];
  const seenTokens = new Set();
  let nextToken = null;
  let pages = 0;
  do {
    if (pages >= MAX_ADS_LIST_PAGES) throw new Error("ADS_PAGINATION_LIMIT_EXCEEDED");
    const body = { ...initialBody, ...(nextToken ? { nextToken } : {}) };
    const payload = await adsPostWithAccessToken(env, region, path, profileId, mediaType, body, auth.access_token);
    if (!payload || !Array.isArray(payload[collectionKey])) throw new Error(`${collectionKey.toUpperCase()}_SCHEMA_INVALID`);
    items.push(...payload[collectionKey]);
    pages += 1;
    if (payload.nextToken !== undefined && payload.nextToken !== null && typeof payload.nextToken !== "string") throw new Error("ADS_NEXT_TOKEN_SCHEMA_INVALID");
    nextToken = String(payload.nextToken || "").trim() || null;
    if (nextToken && seenTokens.has(nextToken)) throw new Error("ADS_PAGINATION_TOKEN_REPEATED");
    if (nextToken) seenTokens.add(nextToken);
  } while (nextToken);
  return { items, pages };
}
async function campaigns(env, region, profileId, refreshToken) {
  const result = await pagedAdsList(env, region, profileId, "/sp/campaigns/list", "application/vnd.spCampaign.v3+json", "campaigns", {}, refreshToken);
  return { pages: result.pages, items: result.items.map(x => { if (!x || typeof x !== "object" || typeof x.name !== "string" || typeof x.state !== "string") throw new Error("CAMPAIGNS_SCHEMA_INVALID"); return { campaignId: apiId(x.campaignId, "CAMPAIGN_ID"), name: x.name, state: x.state, budget: finiteNumberOrNull(x.budget?.budget), targetingType: typeof x.targetingType === "string" ? x.targetingType : null }; }) };
}
async function adGroups(env, region, profileId, campaignId, refreshToken) {
  const filters = campaignId ? { campaignIdFilter: { include: [campaignId] } } : {};
  const result = await pagedAdsList(env, region, profileId, "/sp/adGroups/list", "application/vnd.spAdGroup.v3+json", "adGroups", filters, refreshToken);
  return { pages: result.pages, items: result.items.map(x => { if (!x || typeof x !== "object" || typeof x.name !== "string" || typeof x.state !== "string") throw new Error("AD_GROUPS_SCHEMA_INVALID"); return { adGroupId: apiId(x.adGroupId, "AD_GROUP_ID"), campaignId: apiId(x.campaignId, "CAMPAIGN_ID"), name: x.name, state: x.state, defaultBid: finiteNumberOrNull(x.defaultBid) }; }) };
}

async function requireWriteAccess(request, env) {
  const expected = String(env.AMAZON_ADS_WRITE_ACCESS_KEY || "").trim();
  const presented = String(request.headers.get("X-1122-Ads-Write-Key") || "").trim();
  if (!expected) {
    const failure = new Error("WRITE_ACCESS_NOT_CONFIGURED");
    failure.httpStatus = 503;
    throw failure;
  }
  if (!presented || !fixedTimeEqual(presented, expected)) {
    const failure = new Error("WRITE_ACCESS_DENIED");
    failure.httpStatus = 401;
    throw failure;
  }
}

function idempotencyKey(request) {
  const value = String(request.headers.get("Idempotency-Key") || "").trim();
  if (!/^[A-Za-z0-9._:-]{16,160}$/.test(value)) {
    const failure = new Error("IDEMPOTENCY_KEY_REQUIRED");
    failure.httpStatus = 400;
    throw failure;
  }
  return value;
}

function campaignStateInput(body) {
  let profileId;
  let campaignId;
  try {
    profileId = apiId(body?.profile_id, "PROFILE_ID");
    campaignId = apiId(body?.campaign_id, "CAMPAIGN_ID");
  } catch {
    const failure = new Error("INVALID_WRITE_INPUT");
    failure.httpStatus = 400;
    throw failure;
  }
  const state = String(body?.state || "").trim().toUpperCase();
  if (!["ENABLED", "PAUSED"].includes(state)) {
    const failure = new Error("CAMPAIGN_STATE_NOT_ALLOWED");
    failure.httpStatus = 400;
    throw failure;
  }
  if (String(body?.confirmation || "") !== CAMPAIGN_STATE_CONFIRMATION) {
    const failure = new Error("WRITE_CONFIRMATION_REQUIRED");
    failure.httpStatus = 400;
    throw failure;
  }
  return { profileId, campaignId, state };
}

async function beginWriteIntent(env, { idempotencyKey: key, region, profileId, campaignId, state }) {
  const profileHashValue = await sha256(`${region}:${profileId}`);
  const targetHash = await sha256(`sp-campaign:${campaignId}`);
  const requestHash = await sha256(JSON.stringify({ region, profileId, campaignId, state, action: "sp-campaign-state" }));
  const existing = await env.CORE_DB.prepare(
    "SELECT intent_id, request_hash, requested_state, status, amazon_request_id, error_code FROM amazon_ads_write_intents WHERE idempotency_key=?"
  ).bind(key).first();
  if (existing) {
    if (!fixedTimeEqual(existing.request_hash, requestHash)) {
      const failure = new Error("IDEMPOTENCY_KEY_CONFLICT");
      failure.httpStatus = 409;
      throw failure;
    }
    return { existing, intentId: existing.intent_id, requestHash };
  }
  const intentId = crypto.randomUUID();
  const createdAt = now();
  try {
    await env.CORE_DB.prepare(
      `INSERT INTO amazon_ads_write_intents (
        intent_id, idempotency_key, credential_key, region, profile_hash, target_type,
        target_hash, action_type, request_hash, requested_state, status, created_at
      ) VALUES (?, ?, 'primary', ?, ?, 'sp-campaign', ?, 'state-change', ?, ?, 'PENDING', ?)`
    ).bind(intentId, key, region, profileHashValue, targetHash, requestHash, state, createdAt).run();
  } catch (cause) {
    const concurrent = await env.CORE_DB.prepare(
      "SELECT intent_id, request_hash, requested_state, status, amazon_request_id, error_code FROM amazon_ads_write_intents WHERE idempotency_key=?"
    ).bind(key).first();
    if (concurrent && fixedTimeEqual(concurrent.request_hash, requestHash)) return { existing: concurrent, intentId: concurrent.intent_id, requestHash };
    throw cause;
  }
  return { existing: null, intentId, requestHash };
}

async function completeWriteIntent(env, intentId, status, { requestId = null, errorCode = null } = {}) {
  await env.CORE_DB.prepare(
    "UPDATE amazon_ads_write_intents SET status=?, amazon_request_id=?, error_code=?, completed_at=? WHERE intent_id=?"
  ).bind(status, requestId, errorCode, now(), intentId).run();
}

function writeError(origin, cause) {
  const code = String(cause?.message || "WRITE_FAILED");
  const status = Number(cause?.httpStatus || 502);
  const messages = {
    WRITE_ACCESS_NOT_CONFIGURED: "受控写入尚未配置管理员操作密钥。",
    WRITE_ACCESS_DENIED: "写入操作密钥无效。",
    WRITE_CONFIRMATION_REQUIRED: "写入必须包含明确的人工确认。",
    IDEMPOTENCY_KEY_REQUIRED: "写入必须带有效的幂等键。",
    IDEMPOTENCY_KEY_CONFLICT: "此幂等键已被另一项不同操作使用。",
    CAMPAIGN_STATE_NOT_ALLOWED: "只允许将 Sponsored Products Campaign 切换为 ENABLED 或 PAUSED。",
    INVALID_WRITE_INPUT: "Profile ID 和 Campaign ID 必须是允许的数字标识。",
    REQUEST_TOO_LARGE: "写入请求过大。",
    REQUEST_BODY_REQUIRED: "写入请求格式无效。",
    INVALID_JSON: "写入请求格式无效。",
    AUTH_REQUIRED: "Amazon Ads 尚未完成授权。",
    PROFILE_NOT_AUTHORIZED: "所选 Profile 不属于当前 Amazon Ads 授权。",
    SERVICE_NOT_CONFIGURED: "Amazon Ads Worker 尚未完成安全配置。",
  };
  const message = messages[code] || "Amazon Ads 写入未完成；没有自动重试。";
  return error("write", code, status, origin, message);
}

async function executeCampaignStateWrite(request, env, region, origin) {
  try {
    await requireWriteAccess(request, env);
    if (!configured(env) || !env.CORE_DB) {
      const failure = new Error("SERVICE_NOT_CONFIGURED");
      failure.httpStatus = 503;
      throw failure;
    }
    const key = idempotencyKey(request);
    let body;
    try {
      body = await readSmallJson(request);
    } catch (cause) {
      cause.httpStatus = cause?.message === "REQUEST_TOO_LARGE" ? 413 : 400;
      throw cause;
    }
    const input = campaignStateInput(body);
    const token = await storedRefreshToken(env);
    if (!token) {
      const failure = new Error("AUTH_REQUIRED");
      failure.httpStatus = 401;
      throw failure;
    }
    const profiles = await listProfiles(env, region, token.token);
    if (!profiles.some(profile => profile.profileId === input.profileId)) {
      const failure = new Error("PROFILE_NOT_AUTHORIZED");
      failure.httpStatus = 403;
      throw failure;
    }
    const intent = await beginWriteIntent(env, { idempotencyKey: key, region, ...input });
    if (intent.existing) {
      if (intent.existing.status === "SUCCEEDED") {
        return json({ ok: true, intent_id: intent.intentId, status: "SUCCEEDED", idempotent_replay: true, requested_state: intent.existing.requested_state, amazon_request_id: intent.existing.amazon_request_id || null }, 200, origin);
      }
      const failure = new Error(intent.existing.status === "PENDING" ? "WRITE_INTENT_PENDING" : "WRITE_INTENT_ALREADY_FAILED");
      failure.httpStatus = 409;
      throw failure;
    }
    try {
      const access = await adsAccessToken(env, region, token.token);
      const result = await adsPutCampaignState(env, region, input.profileId, input.campaignId, input.state, access.access_token);
      await completeWriteIntent(env, intent.intentId, "SUCCEEDED", { requestId: result.requestId });
      return json({ ok: true, intent_id: intent.intentId, status: "SUCCEEDED", requested_state: input.state, amazon_request_id: result.requestId, checked_at: now() }, 200, origin);
    } catch (cause) {
      const detail = classifyAdsFailure(cause);
      await completeWriteIntent(env, intent.intentId, "FAILED", { errorCode: detail.code });
      const failure = new Error(detail.code);
      failure.httpStatus = /PERMISSION|UNAUTHORIZED/.test(detail.code) ? 403 : /RATE_LIMIT/.test(detail.code) ? 429 : 502;
      throw failure;
    }
  } catch (cause) {
    return writeError(origin, cause);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url); const origin = request.headers.get("Origin") || ""; const region = regionFor(url);
    if (request.method === "OPTIONS") return WEB_ORIGINS.has(origin) ? new Response(null, { status: 204, headers: cors(origin) }) : new Response(null, { status: 403 });
    if ((origin && !WEB_ORIGINS.has(origin)) || (TRUSTED_ORIGIN_PATHS.has(url.pathname) && !WEB_ORIGINS.has(origin))) return error("cors", "ORIGIN_NOT_ALLOWED", 403, origin, "A registered 1122 web origin is required.");
    if (request.method === "POST" && url.pathname === "/oauth/manual/complete") {
      if (!configured(env) || !env.CORE_DB || !String(env.AMAZON_ADS_TOKEN_ENCRYPTION_KEY || "").trim()) return error("configuration", "SERVICE_NOT_CONFIGURED", 503, origin, "Authorization service is not configured.");
      let returnUrl;
      try {
        const body = await readSmallJson(request);
        returnUrl = new URL(String(body?.return_url || ""));
      } catch (cause) {
        return error("validation", cause?.message === "REQUEST_TOO_LARGE" ? "REQUEST_TOO_LARGE" : "INVALID_RETURN_URL", cause?.message === "REQUEST_TOO_LARGE" ? 413 : 400, origin, "Paste the complete Amazon return URL.");
      }
      if (returnUrl.protocol !== "https:" || returnUrl.username || returnUrl.password) return error("validation", "RETURN_URL_NOT_ALLOWED", 400, origin, "Only an HTTPS Amazon return URL is accepted.");
      const code = returnUrl.searchParams.get("code");
      const receivedState = returnUrl.searchParams.get("state");
      if (!code || !receivedState) return error("validation", "MISSING_CODE_OR_STATE", 400, origin, "The Amazon return URL does not contain code and state.");
      const callbackRegion = regionFromState(receivedState, "manual");
      if (!callbackRegion || !allowedManualReturnHosts(callbackRegion).has(returnUrl.hostname.toLowerCase())) return error("validation", "RETURN_URL_NOT_ALLOWED", 400, origin, "The Amazon return URL does not match the authorization region.");
      if (!await consumeOauthState(env, receivedState, `manual.${callbackRegion}`)) return error("callback", "INVALID_OR_EXPIRED_STATE", 400, origin, "Authorization state is invalid, expired, or already used.");
      try {
        const token = await tokenRequest(callbackRegion, { grant_type: "authorization_code", code, client_id: env.AMAZON_ADS_CLIENT_ID, client_secret: env.AMAZON_ADS_CLIENT_SECRET, redirect_uri: MANUAL_REDIRECT_URL });
        if (!token.refresh_token) throw new Error("LWA_REFRESH_TOKEN_MISSING");
        const profiles = await listProfiles(env, callbackRegion, token.refresh_token);
        if (!profiles.length) throw new Error("PROFILES_EMPTY");
        await verifyAccountContinuity(env, callbackRegion, profiles);
        await storeRefreshToken(env, token.refresh_token);
        await pinProfiles(env, profiles);
        return json({ ok: true, status: "CONNECTED", region: callbackRegion, profiles_count: profiles.length, checked_at: now() }, 200, origin);
      } catch {
        return error("token_exchange", "AUTHORIZATION_VERIFICATION_FAILED", 502, origin, "Amazon authorization or Profiles verification failed. Generate a new link and try again.");
      }
    }
    if (request.method === "POST" && url.pathname === "/write-intents/campaign-state") return executeCampaignStateWrite(request, env, region, origin);
    if (request.method !== "GET") return error("routing", "METHOD_NOT_ALLOWED", 405, origin, "Only GET, the documented POST endpoints, and OPTIONS are supported.");
    if (url.pathname === "/" || url.pathname === "/health") return json({ ok: true, service: "1122-amazon-ads-bridge", status: "online", version: "1.3.0", checked_at: now(), configured: configured(env), write_gate_configured: writeGateConfigured(env) }, 200, origin);
    if (url.pathname === "/connection-status") return json(await status(env, region), 200, origin);
    if (url.pathname === "/oauth/manual/start") {
      if (!configured(env)) return error("configuration", "MISSING_CLIENT_CREDENTIALS", 503, origin, "Worker Secrets AMAZON_ADS_CLIENT_ID and AMAZON_ADS_CLIENT_SECRET are required before authorization.");
      if (!String(env.AMAZON_ADS_TOKEN_ENCRYPTION_KEY || "").trim()) return error("configuration", "MISSING_TOKEN_ENCRYPTION_KEY", 503, origin, "Worker Secret AMAZON_ADS_TOKEN_ENCRYPTION_KEY is required before authorization.");
      if (!env.CORE_DB) return error("storage", "MISSING_CORE_DB", 503, origin, "Secure OAuth state storage is not available.");
      const { state, expires } = await createOauthState(env, `manual.${region}`);
      const target = new URL(REGIONS[region].lwaAuthorize);
      target.search = new URLSearchParams({ client_id: env.AMAZON_ADS_CLIENT_ID, scope: "advertising::campaign_management advertising::audiences", response_type: "code", redirect_uri: MANUAL_REDIRECT_URL, state }).toString();
      return json({ ok: true, authorization_url: target.toString(), redirect_uri: MANUAL_REDIRECT_URL, expires_at: expires }, 200, origin);
    }
    if (url.pathname === "/oauth/start") {
      if (!configured(env)) return error("configuration", "MISSING_CLIENT_CREDENTIALS", 503, origin, "Worker Secrets AMAZON_ADS_CLIENT_ID and AMAZON_ADS_CLIENT_SECRET are required before authorization.");
      if (!String(env.AMAZON_ADS_TOKEN_ENCRYPTION_KEY || "").trim()) return error("configuration", "MISSING_TOKEN_ENCRYPTION_KEY", 503, origin, "Worker Secret AMAZON_ADS_TOKEN_ENCRYPTION_KEY is required before authorization.");
      if (!env.CORE_DB) return error("storage", "MISSING_CORE_DB", 503, origin, "Secure OAuth state storage is not available.");
      const { state } = await createOauthState(env, `callback.${region}`);
      const target = new URL(REGIONS[region].lwaAuthorize); target.search = new URLSearchParams({ client_id: env.AMAZON_ADS_CLIENT_ID, scope: "advertising::campaign_management advertising::audiences", response_type: "code", redirect_uri: publicCallbackUrl(env, request), state }).toString();
      return Response.redirect(target.toString(), 302);
    }
    if (url.pathname === "/oauth/callback") {
      const code = url.searchParams.get("code"); const receivedState = url.searchParams.get("state");
      if (!code || !receivedState) return error("callback", "MISSING_CODE_OR_STATE", 400, "", "Authorization response is incomplete.");
      if (!configured(env) || !env.CORE_DB) return error("callback", "SERVICE_NOT_CONFIGURED", 503, "", "Authorization service is not configured.");
      const callbackRegion = regionFromState(receivedState, "callback");
      if (!callbackRegion || !await consumeOauthState(env, receivedState, `callback.${callbackRegion}`)) return error("callback", "INVALID_OR_EXPIRED_STATE", 400, "", "Authorization state is invalid or expired.");
      try {
        const token = await tokenRequest(callbackRegion, { grant_type: "authorization_code", code, client_id: env.AMAZON_ADS_CLIENT_ID, client_secret: env.AMAZON_ADS_CLIENT_SECRET, redirect_uri: publicCallbackUrl(env, request) });
        if (!token.refresh_token) throw new Error("LWA_REFRESH_TOKEN_MISSING");
        const profiles = await listProfiles(env, callbackRegion, token.refresh_token);
        if (!profiles.length) throw new Error("PROFILES_EMPTY");
        await verifyAccountContinuity(env, callbackRegion, profiles);
        await storeRefreshToken(env, token.refresh_token);
        await pinProfiles(env, profiles);
        return Response.redirect("https://1122.sorilo-uk.com/#/operations/ads?authorized=1", 302);
      } catch {
        return error("token_exchange", "TOKEN_EXCHANGE_FAILED", 502, "", "Amazon authorization could not be completed.");
      }
    }
    const token = await storedRefreshToken(env);
    if (!token) return error("authorization", "AUTH_REQUIRED", 401, origin, "Complete OAuth first.");
    try {
      if (url.pathname === "/profiles") {
        const profiles = await listProfiles(env, region, token.token);
        await pinProfiles(env, profiles);
        return json({ ok: true, region, profiles, checked_at: now() }, 200, origin);
      }
      if (url.pathname === "/campaigns") {
        const profileId = url.searchParams.get("profile_id");
        if (!profileId || !/^\d+$/.test(profileId)) return error("validation", "PROFILE_ID_REQUIRED", 400, origin, "A numeric profile_id is required.");
        const result = await campaigns(env, region, profileId, token.token);
        return json({ ok: true, region, profile_id: profileId, campaigns: result.items, page_count: result.pages, checked_at: now() }, 200, origin);
      }
      if (url.pathname === "/ad-groups") {
        const profileId = url.searchParams.get("profile_id");
        const campaignId = url.searchParams.get("campaign_id");
        if (!profileId || !/^\d+$/.test(profileId)) return error("validation", "PROFILE_ID_REQUIRED", 400, origin, "A numeric profile_id is required.");
        if (campaignId && !/^\d+$/.test(campaignId)) return error("validation", "CAMPAIGN_ID_INVALID", 400, origin, "campaign_id must be numeric.");
        const result = await adGroups(env, region, profileId, campaignId, token.token);
        return json({ ok: true, region, profile_id: profileId, campaign_id: campaignId || null, ad_groups: result.items, page_count: result.pages, checked_at: now() }, 200, origin);
      }
      return error("routing", "NOT_FOUND", 404, origin, "Endpoint not found.");
    } catch {
      return error("ads-api", "READ_FAILED", 502, origin, "Amazon Ads read request failed.");
    }
  }
};
