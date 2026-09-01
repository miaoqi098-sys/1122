const ALLOWED_ORIGIN = "https://miaoqi098-sys.github.io";
const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const US_MARKETPLACE_ID = "ATVPDKIKX0DER";
const REGION_ENDPOINTS = {
  na: "https://sellingpartnerapi-na.amazon.com",
  eu: "https://sellingpartnerapi-eu.amazon.com",
  fe: "https://sellingpartnerapi-fe.amazon.com",
};

function cors(origin = "") {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=UTF-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data, null, 2), { status, headers: cors(origin) });
}

function getServerCredentials(env) {
  const clientId = String(env.AMAZON_LWA_CLIENT_ID || "").trim();
  const clientSecret = String(env.AMAZON_LWA_CLIENT_SECRET || "").trim();
  const refreshToken = String(env.AMAZON_LWA_REFRESH_TOKEN || "").trim();
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Worker Secret 未完整配置 Amazon LWA 三项凭据");
  if (!clientId.startsWith("amzn1.application-oa2-client.")) throw new Error("Worker Secret 中的 LWA Client ID 格式不正确");
  return { clientId, clientSecret, refreshToken };
}

async function exchangeAccessToken(clientId, clientSecret, refreshToken) {
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret });
  const response = await fetch(LWA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "Accept": "application/json" },
    body,
  });
  let data = {};
  try { data = await response.json(); } catch { throw new Error(`Amazon LWA 返回非 JSON 响应（HTTP ${response.status}）`); }
  if (!response.ok || !data.access_token) throw new Error(`LWA 认证失败：${data.error_description || data.error || `HTTP ${response.status}`}`);
  return { accessToken: data.access_token, expiresIn: data.expires_in || 3600, tokenType: data.token_type || "bearer" };
}

function spHeaders(accessToken) {
  return {
    "Accept": "application/json",
    "x-amz-access-token": accessToken,
    "x-amz-date": new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""),
    "user-agent": "1122AmazonBridge/3.0 (Language=JavaScript; Platform=CloudflareWorkers)",
  };
}

async function spGet(endpoint, path, accessToken) {
  const response = await fetch(`${endpoint}${path}`, { method: "GET", headers: spHeaders(accessToken) });
  let data = {};
  try { data = await response.json(); } catch { throw new Error(`SP-API 返回非 JSON 响应（HTTP ${response.status}）`); }
  if (!response.ok) {
    const message = data?.errors?.[0]?.message || data?.message || `HTTP ${response.status}`;
    const code = data?.errors?.[0]?.code || "SP_API_ERROR";
    throw new Error(`SP-API 调用失败：${code} · ${message}`);
  }
  return data;
}

async function getMarketplaceParticipations(endpoint, accessToken) {
  const data = await spGet(endpoint, "/sellers/v1/marketplaceParticipations", accessToken);
  return Array.isArray(data.payload) ? data.payload : [];
}

async function getFbaInventory(endpoint, accessToken, marketplaceId) {
  const items = [];
  let nextToken = null;
  let pages = 0;
  do {
    const params = new URLSearchParams({ details: "true", granularityType: "Marketplace", granularityId: marketplaceId, marketplaceIds: marketplaceId });
    if (nextToken) params.set("nextToken", nextToken);
    const data = await spGet(endpoint, `/fba/inventory/v1/summaries?${params.toString()}`, accessToken);
    const summaries = Array.isArray(data?.payload?.inventorySummaries) ? data.payload.inventorySummaries : [];
    items.push(...summaries);
    nextToken = data?.pagination?.nextToken || data?.payload?.pagination?.nextToken || null;
    pages += 1;
    if (nextToken) await new Promise((resolve) => setTimeout(resolve, 550));
  } while (nextToken && pages < 50);
  if (nextToken) throw new Error("FBA Inventory 分页超过安全上限 50 页，已停止刷新");
  return { items, pages };
}

async function makeProductId(marketplaceId, asin, sellerSku) {
  const input = new TextEncoder().encode(`${marketplaceId}|${asin || ""}|${sellerSku || ""}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

async function normalizeProductIdentities(inventoryItems) {
  const normalized = [];
  for (const item of inventoryItems) {
    const asin = item?.asin || null;
    const sellerSku = item?.sellerSku || null;
    if (!asin && !sellerSku) continue;
    normalized.push({
      product_id: await makeProductId(US_MARKETPLACE_ID, asin, sellerSku),
      marketplace: "US",
      marketplace_id: US_MARKETPLACE_ID,
      asin,
      seller_sku: sellerSku,
      fnsku: item?.fnSku || null,
      product_name: item?.productName || null,
      condition: item?.condition || null,
      total_quantity: item?.totalQuantity ?? null,
      fulfillable_quantity: item?.inventoryDetails?.fulfillableQuantity ?? null,
      inbound_working_quantity: item?.inventoryDetails?.inboundWorkingQuantity ?? null,
      inbound_shipped_quantity: item?.inventoryDetails?.inboundShippedQuantity ?? null,
      inbound_receiving_quantity: item?.inventoryDetails?.inboundReceivingQuantity ?? null,
      source: "amazon_sp_api_fba_inventory",
    });
  }
  return normalized;
}

async function refreshProductIdentities(env) {
  if (!env.PRODUCT_STATE) throw new Error("PRODUCT_STATE KV 尚未绑定");
  const { clientId, clientSecret, refreshToken } = getServerCredentials(env);
  const endpoint = REGION_ENDPOINTS.na;
  const lwa = await exchangeAccessToken(clientId, clientSecret, refreshToken);
  const { items, pages } = await getFbaInventory(endpoint, lwa.accessToken, US_MARKETPLACE_ID);
  const products = await normalizeProductIdentities(items);
  const updatedAt = new Date().toISOString();
  const snapshot = { schema: "ProductIdentitySnapshot.v1", marketplace: "US", marketplace_id: US_MARKETPLACE_ID, updated_at: updatedAt, source: "Amazon FBA Inventory API", product_count: products.length, products };
  const status = { success: true, marketplace: "US", marketplaceId: US_MARKETPLACE_ID, productCount: products.length, pages, updatedAt, source: "Amazon FBA Inventory API", detailVisibility: "private-kv" };
  await env.PRODUCT_STATE.put("product-identities:US", JSON.stringify(snapshot));
  await env.PRODUCT_STATE.put("product-identity-status:US", JSON.stringify(status));
  return status;
}

function isInternalAuthorized(request, env) {
  const expected = String(env.OPERATIONS_REFRESH_TOKEN || "").trim();
  if (!expected) return false;
  const auth = request.headers.get("Authorization") || "";
  return auth === `Bearer ${expected}`;
}

async function getPublicProductIdentityStatus(env) {
  if (!env.PRODUCT_STATE) return { success: false, configured: false, message: "PRODUCT_STATE KV 尚未绑定" };
  const raw = await env.PRODUCT_STATE.get("product-identity-status:US");
  if (!raw) return { success: true, configured: true, ready: false, marketplace: "US", message: "产品身份数据层已配置，等待首次私有刷新" };
  const status = JSON.parse(raw);
  return { success: true, configured: true, ready: true, marketplace: status.marketplace, productCount: status.productCount, updatedAt: status.updatedAt, source: status.source, detailVisibility: "private" };
}

async function buildConnectionStatus(env) {
  const { clientId, clientSecret, refreshToken } = getServerCredentials(env);
  const endpoint = REGION_ENDPOINTS.na;
  const lwa = await exchangeAccessToken(clientId, clientSecret, refreshToken);
  const participations = await getMarketplaceParticipations(endpoint, lwa.accessToken);
  const marketplaces = participations.map((entry) => ({
    marketplaceId: entry?.marketplace?.id || null,
    countryCode: entry?.marketplace?.countryCode || null,
    domainName: entry?.marketplace?.domainName || null,
    isParticipating: entry?.participation?.isParticipating ?? null,
  }));
  return {
    success: true,
    message: "1122 已成功连接 Amazon SP-API",
    connection: "connected",
    authentication: { lwaAccessTokenIssued: true, expiresIn: lwa.expiresIn },
    spApi: { region: "na", testOperation: "getMarketplaceParticipations", marketplaceCount: marketplaces.length, marketplaces },
    productIdentity: await getPublicProductIdentityStatus(env),
    credentialMode: "worker-secrets",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });

    if (request.method === "POST" && url.pathname === "/internal/refresh-product-identities") {
      if (!isInternalAuthorized(request, env)) return json({ success: false, message: "Unauthorized" }, 401, origin);
      try {
        const status = await refreshProductIdentities(env);
        return json(status, 200, origin);
      } catch (error) {
        return json({ success: false, message: "ProductIdentity 私有刷新失败", error: error.message }, 502, origin);
      }
    }

    if (request.method === "GET" && url.pathname === "/") {
      return json({ ok: true, service: "1122-amazon-sp-api-bridge", status: "online", version: "3.0.0", credentialMode: "worker-secrets", productState: Boolean(env.PRODUCT_STATE) }, 200, origin);
    }

    if (origin && origin !== ALLOWED_ORIGIN) return json({ success: false, message: "Origin not allowed" }, 403, origin);

    if (request.method === "GET" && url.pathname === "/connection-status") {
      try { return json(await buildConnectionStatus(env), 200, origin); }
      catch (error) { return json({ success: false, message: "Amazon SP-API 后端连接检查失败", error: error.message, credentialMode: "worker-secrets" }, 400, origin); }
    }

    if (request.method === "GET" && url.pathname === "/product-identity-status") {
      try { return json(await getPublicProductIdentityStatus(env), 200, origin); }
      catch (error) { return json({ success: false, message: "ProductIdentity 状态读取失败", error: error.message }, 500, origin); }
    }

    if (request.method === "POST" && url.pathname === "/test-connection") {
      return json({ success: false, message: "已切换为 Worker Secret（后端密钥）模式。请使用连接状态检查。" }, 410, origin);
    }

    return json({ success: false, message: "Endpoint（接口地址）不存在" }, 404, origin);
  },
};
