const WEB_ORIGINS = new Set([
  "https://1122.sorilo-uk.com",
  "https://1122-web-agent.pages.dev",
  "https://miaoqi098-sys.github.io",
]);
const NA = { lwaAuthorize: "https://www.amazon.com/ap/oa", lwaToken: "https://api.amazon.com/auth/o2/token", adsApi: "https://advertising-api.amazon.com" };
const REGIONS = { na: NA, eu: { lwaAuthorize: "https://www.amazon.co.uk/ap/oa", lwaToken: "https://api.amazon.co.uk/auth/o2/token", adsApi: "https://advertising-api-eu.amazon.com" }, fe: { lwaAuthorize: "https://www.amazon.co.jp/ap/oa", lwaToken: "https://api.amazon.co.jp/auth/o2/token", adsApi: "https://advertising-api-fe.amazon.com" } };
const OAUTH_STATE_TTL_SECONDS = 600;
const FETCH_TIMEOUT_MS = 10_000;

function now() { return new Date().toISOString(); }
function configured(env) { return Boolean(String(env.AMAZON_ADS_CLIENT_ID || "").trim() && String(env.AMAZON_ADS_CLIENT_SECRET || "").trim()); }
function cors(origin) {
  const headers = { "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Vary": "Origin" };
  if (origin && WEB_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
function json(payload, status = 200, origin = "") { return new Response(JSON.stringify(payload), { status, headers: { ...cors(origin), "Content-Type": "application/json; charset=UTF-8" } }); }
function error(stage, code, status, origin, message) { return json({ ok: false, error: { stage, code, message }, checked_at: now() }, status, origin); }
function base64url(bytes) { return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
function randomToken() { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return base64url(bytes); }
async function sha256(value) { return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))); }
function regionFor(url) { const raw = String(url.searchParams.get("region") || "na").toLowerCase(); return REGIONS[raw] ? raw : "na"; }
function callbackUrl(request) { return new URL("/oauth/callback", request.url).toString(); }
function publicCallbackUrl(env, request) { return String(env.AMAZON_ADS_REDIRECT_URI || callbackUrl(request)).trim(); }
async function fetchBounded(url, init) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: controller.signal }); } finally { clearTimeout(timer); }
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
async function storedRefreshToken(env) { const secret = String(env.AMAZON_ADS_REFRESH_TOKEN || "").trim(); if (secret) return { token: secret, source: "worker-secret" }; if (!env.CORE_DB) return null; const row = await env.CORE_DB.prepare("SELECT encrypted_refresh_token FROM amazon_ads_credentials WHERE credential_key = 'primary'").first(); return row?.encrypted_refresh_token ? { token: await decrypt(env, row.encrypted_refresh_token), source: "encrypted-d1" } : null; }
async function status(env, region) {
  const checked_at = now();
  if (!configured(env)) return { connector_id: "amazon-ads", status: "AUTH_REQUIRED", checked_at, source: "ads-bridge", capabilities: ["oauth"], details: { region, profiles_count: 0, last_token_refresh: null }, error: { stage: "configuration", code: "MISSING_CLIENT_CREDENTIALS", message: "Amazon Ads Client ID / Client Secret 尚未配置为 Worker Secret。" } };
  try { const token = await storedRefreshToken(env); if (!token) return { connector_id: "amazon-ads", status: "AUTH_REQUIRED", checked_at, source: "ads-bridge", capabilities: ["oauth"], details: { region, profiles_count: 0, last_token_refresh: null }, error: { stage: "authorization", code: "MISSING_REFRESH_TOKEN", message: "尚未完成 Amazon Ads 授权。" } }; const profiles = await listProfiles(env, region, token.token); return { connector_id: "amazon-ads", status: "CONNECTED", checked_at, source: "ads-bridge", capabilities: ["profiles", "campaigns-readonly"], details: { region, profiles_count: profiles.length, last_token_refresh: checked_at }, error: null }; } catch (cause) { return { connector_id: "amazon-ads", status: "DEGRADED", checked_at, source: "ads-bridge", capabilities: ["oauth"], details: { region, profiles_count: 0, last_token_refresh: null }, error: { stage: "ads-api", code: "CONNECTION_CHECK_FAILED", message: String(cause.message || cause).slice(0, 160) } }; }
}
function validProfile(x) { return x && typeof x === "object" && (typeof x.profileId === "number" || typeof x.profileId === "string") && typeof x.countryCode === "string" && typeof x.currencyCode === "string" && typeof x.timezone === "string"; }
async function adsAccessToken(env, region, refreshToken) { return tokenRequest(region, { grant_type: "refresh_token", refresh_token: refreshToken, client_id: env.AMAZON_ADS_CLIENT_ID, client_secret: env.AMAZON_ADS_CLIENT_SECRET }); }
async function adsGet(env, region, path, profileId, refreshToken) { const auth = await adsAccessToken(env, region, refreshToken); const response = await fetchBounded(`${REGIONS[region].adsApi}${path}`, { headers: { Authorization: `Bearer ${auth.access_token}`, "Amazon-Advertising-API-ClientId": env.AMAZON_ADS_CLIENT_ID, ...(profileId ? { "Amazon-Advertising-API-Scope": String(profileId) } : {}), Accept: "application/json" } }); let payload; try { payload = await response.json(); } catch { throw new Error(`ADS_NON_JSON_${response.status}`); } if (!response.ok) throw new Error(`ADS_API_${response.status}`); return payload; }
async function listProfiles(env, region, refreshToken) { const payload = await adsGet(env, region, "/v2/profiles", null, refreshToken); if (!Array.isArray(payload) || !payload.every(validProfile)) throw new Error("PROFILES_SCHEMA_INVALID"); return payload.map(x => ({ profileId: String(x.profileId), countryCode: x.countryCode, currencyCode: x.currencyCode, timezone: x.timezone, accountId: x.accountInfo?.id ? String(x.accountInfo.id) : null, accountType: x.accountInfo?.type || null, region })); }
async function campaigns(env, region, profileId, refreshToken) { const payload = await adsGet(env, region, "/v2/sp/campaigns", profileId, refreshToken); if (!Array.isArray(payload)) throw new Error("CAMPAIGNS_SCHEMA_INVALID"); return payload.map(x => ({ campaignId: String(x.campaignId ?? ""), name: String(x.name ?? ""), state: String(x.state ?? ""), budget: Number.isFinite(Number(x.dailyBudget)) ? Number(x.dailyBudget) : null, targetingType: x.targetingType || null })); }

export default {
  async fetch(request, env) {
    const url = new URL(request.url); const origin = request.headers.get("Origin") || ""; const region = regionFor(url);
    if (request.method === "OPTIONS") return WEB_ORIGINS.has(origin) ? new Response(null, { status: 204, headers: cors(origin) }) : new Response(null, { status: 403 });
    if (origin && !WEB_ORIGINS.has(origin)) return error("cors", "ORIGIN_NOT_ALLOWED", 403, origin, "Origin not allowed");
    if (request.method !== "GET") return error("routing", "METHOD_NOT_ALLOWED", 405, origin, "Only GET and OPTIONS are supported.");
    if (url.pathname === "/" || url.pathname === "/health") return json({ ok: true, service: "1122-amazon-ads-bridge", status: "online", version: "1.0.0", checked_at: now(), configured: configured(env) }, 200, origin);
    if (url.pathname === "/connection-status") return json(await status(env, region), 200, origin);
    if (url.pathname === "/oauth/start") {
      if (!configured(env)) return error("configuration", "MISSING_CLIENT_CREDENTIALS", 503, origin, "Worker Secrets AMAZON_ADS_CLIENT_ID and AMAZON_ADS_CLIENT_SECRET are required before authorization.");
      if (!String(env.AMAZON_ADS_TOKEN_ENCRYPTION_KEY || "").trim()) return error("configuration", "MISSING_TOKEN_ENCRYPTION_KEY", 503, origin, "Worker Secret AMAZON_ADS_TOKEN_ENCRYPTION_KEY is required before authorization.");
      if (!env.CORE_DB) return error("storage", "MISSING_CORE_DB", 503, origin, "Secure OAuth state storage is not available.");
      const state = randomToken(); const stateHash = await sha256(state); const created = now(); const expires = new Date(Date.now() + OAUTH_STATE_TTL_SECONDS * 1000).toISOString();
      await env.CORE_DB.prepare("DELETE FROM amazon_ads_oauth_states WHERE expires_at < ?").bind(created).run();
      await env.CORE_DB.prepare("INSERT INTO amazon_ads_oauth_states (state_hash, expires_at, created_at) VALUES (?, ?, ?)").bind(stateHash, expires, created).run();
      const target = new URL(REGIONS[region].lwaAuthorize); target.search = new URLSearchParams({ client_id: env.AMAZON_ADS_CLIENT_ID, scope: "advertising::campaign_management advertising::audiences", response_type: "code", redirect_uri: publicCallbackUrl(env, request), state }).toString();
      return Response.redirect(target.toString(), 302);
    }
    if (url.pathname === "/oauth/callback") {
      const code = url.searchParams.get("code"); const receivedState = url.searchParams.get("state");
      if (!code || !receivedState) return error("callback", "MISSING_CODE_OR_STATE", 400, "", "Authorization response is incomplete.");
      if (!configured(env) || !env.CORE_DB) return error("callback", "SERVICE_NOT_CONFIGURED", 503, "", "Authorization service is not configured.");
      const stateHash = await sha256(receivedState); const row = await env.CORE_DB.prepare("DELETE FROM amazon_ads_oauth_states WHERE state_hash = ? AND expires_at >= ? RETURNING state_hash").bind(stateHash, now()).first();
      if (!row) return error("callback", "INVALID_OR_EXPIRED_STATE", 400, "", "Authorization state is invalid or expired.");
      try { const token = await tokenRequest(region, { grant_type: "authorization_code", code, client_id: env.AMAZON_ADS_CLIENT_ID, client_secret: env.AMAZON_ADS_CLIENT_SECRET, redirect_uri: publicCallbackUrl(env, request) }); if (!token.refresh_token) throw new Error("LWA_REFRESH_TOKEN_MISSING"); const encrypted = await encrypt(env, token.refresh_token); await env.CORE_DB.prepare("INSERT INTO amazon_ads_credentials (credential_key, encrypted_refresh_token, updated_at, last_token_refresh_at) VALUES ('primary', ?, ?, ?) ON CONFLICT(credential_key) DO UPDATE SET encrypted_refresh_token=excluded.encrypted_refresh_token, updated_at=excluded.updated_at, last_token_refresh_at=excluded.last_token_refresh_at").bind(encrypted, now(), now()).run(); return Response.redirect("https://1122.sorilo-uk.com/#/operations/ads", 302); } catch (cause) { return error("token_exchange", "TOKEN_EXCHANGE_FAILED", 502, "", "Amazon authorization could not be completed."); }
    }
    const token = await storedRefreshToken(env); if (!token) return error("authorization", "AUTH_REQUIRED", 401, origin, "Complete OAuth first.");
    try { if (url.pathname === "/profiles") return json({ ok: true, region, profiles: await listProfiles(env, region, token.token), checked_at: now() }, 200, origin); if (url.pathname === "/campaigns") { const profileId = url.searchParams.get("profile_id"); if (!profileId || !/^\d+$/.test(profileId)) return error("validation", "PROFILE_ID_REQUIRED", 400, origin, "A numeric profile_id is required."); return json({ ok: true, region, profile_id: profileId, campaigns: await campaigns(env, region, profileId, token.token), checked_at: now() }, 200, origin); } return error("routing", "NOT_FOUND", 404, origin, "Endpoint not found."); } catch (cause) { return error("ads-api", "READ_FAILED", 502, origin, "Amazon Ads read request failed."); }
  }
};
