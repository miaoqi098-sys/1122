const ALLOWED_ORIGINS = new Set(["https://1122-web-agent.pages.dev", "https://miaoqi098-sys.github.io"]);
const PRIMARY_WEB_ORIGIN = "https://1122-web-agent.pages.dev";
const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const US_MARKETPLACE_ID = "ATVPDKIKX0DER";
const REGION_ENDPOINTS = {
  na: "https://sellingpartnerapi-na.amazon.com",
  eu: "https://sellingpartnerapi-eu.amazon.com",
  fe: "https://sellingpartnerapi-fe.amazon.com",
};

function cors(origin = "") {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : PRIMARY_WEB_ORIGIN,
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
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
    "user-agent": "1122AmazonBridge/4.2 (Language=JavaScript; Platform=CloudflareWorkers)",
  };
}

async function spRequest(endpoint, path, accessToken) {
  const response = await fetch(`${endpoint}${path}`, { method: "GET", headers: spHeaders(accessToken) });
  let data = {};
  try { data = await response.json(); } catch {
    return { ok: false, status: response.status, data: {}, error: `SP-API 返回非 JSON 响应（HTTP ${response.status}）` };
  }
  if (!response.ok) {
    const message = data?.errors?.[0]?.message || data?.message || `HTTP ${response.status}`;
    const code = data?.errors?.[0]?.code || "SP_API_ERROR";
    return { ok: false, status: response.status, data, error: `${code} · ${message}` };
  }
  return { ok: true, status: response.status, data, error: null };
}

async function spGet(endpoint, path, accessToken) {
  const result = await spRequest(endpoint, path, accessToken);
  if (!result.ok) throw new Error(`SP-API 调用失败：${result.error}`);
  return result.data;
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
    const params = new URLSearchParams({
      details: "true",
      granularityType: "Marketplace",
      granularityId: marketplaceId,
      marketplaceIds: marketplaceId,
    });
    if (nextToken) params.set("nextToken", nextToken);
    const data = await spGet(endpoint, `/fba/inventory/v1/summaries?${params.toString()}`, accessToken);
    const summaries = Array.isArray(data?.payload?.inventorySummaries) ? data.payload.inventorySummaries : [];
    items.push(...summaries);
    nextToken = data?.pagination?.nextToken || data?.payload?.pagination?.nextToken || null;
    pages += 1;
    if (nextToken) await sleep(550);
  } while (nextToken && pages < 50);
  if (nextToken) throw new Error("FBA Inventory 分页超过安全上限 50 页，已停止刷新");
  return { items, pages };
}

function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
  return result;
}

async function getPricingBySkus(endpoint, accessToken, marketplaceId, skus) {
  const records = [];
  const errors = [];
  const batches = chunk(skus.filter(Boolean), 20);
  for (let i = 0; i < batches.length; i += 1) {
    const params = new URLSearchParams({
      MarketplaceId: marketplaceId,
      ItemType: "Sku",
      Skus: batches[i].join(","),
      ItemCondition: "New",
      OfferType: "B2C",
    });
    const result = await spRequest(endpoint, `/products/pricing/v0/price?${params.toString()}`, accessToken);
    if (result.ok) {
      const payload = Array.isArray(result.data?.payload) ? result.data.payload : [];
      records.push(...payload);
    } else {
      errors.push({ batch: i + 1, error: result.error });
    }
    if (i < batches.length - 1) await sleep(2200);
  }
  return { records, errors };
}

function firstAttributeValue(attributes, key) {
  const list = attributes?.[key];
  if (!Array.isArray(list) || !list.length) return null;
  const item = list[0];
  if (item == null) return null;
  if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") return item;
  if (Object.prototype.hasOwnProperty.call(item, "value")) return item.value;
  return null;
}

function findDeepValue(value, wantedKeys) {
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    if (wantedKeys.includes(key) && (typeof child === "string" || typeof child === "number")) return child;
    const nested = findDeepValue(child, wantedKeys);
    if (nested != null) return nested;
  }
  return null;
}

function normalizePricing(records) {
  const bySku = new Map();
  let sellerId = null;
  for (const record of records) {
    const sku = record?.SellerSKU || record?.Product?.Identifiers?.SKUIdentifier?.SellerSKU || null;
    const discoveredSellerId = record?.Product?.Identifiers?.SKUIdentifier?.SellerId || null;
    if (!sellerId && discoveredSellerId) sellerId = discoveredSellerId;
    if (!sku) continue;
    const offer = Array.isArray(record?.Product?.Offers) ? record.Product.Offers[0] : null;
    bySku.set(sku, {
      status: record?.status || null,
      asin: record?.Product?.Identifiers?.MarketplaceASIN?.ASIN || record?.ASIN || null,
      seller_id: discoveredSellerId,
      listing_price: offer?.BuyingPrice?.ListingPrice?.Amount ?? null,
      listing_currency: offer?.BuyingPrice?.ListingPrice?.CurrencyCode || null,
      landed_price: offer?.BuyingPrice?.LandedPrice?.Amount ?? null,
      regular_price: offer?.RegularPrice?.Amount ?? null,
      regular_price_currency: offer?.RegularPrice?.CurrencyCode || null,
      fulfillment_channel: offer?.FulfillmentChannel || null,
      item_condition: offer?.ItemCondition || null,
    });
  }
  return { bySku, sellerId };
}

async function getListingsBySkus(endpoint, accessToken, sellerId, marketplaceId, skus) {
  const bySku = new Map();
  const errors = [];
  if (!sellerId) return { bySku, errors: [{ error: "SellerId 未解析，无法读取 Listings Items" }] };

  for (let i = 0; i < skus.length; i += 1) {
    const sku = skus[i];
    if (!sku) continue;
    const params = new URLSearchParams({
      marketplaceIds: marketplaceId,
      includedData: "summaries,attributes,issues,offers,fulfillmentAvailability,relationships,productTypes",
      issueLocale: "en_US",
    });
    const path = `/listings/2021-08-01/items/${encodeURIComponent(sellerId)}/${encodeURIComponent(sku)}?${params.toString()}`;
    const result = await spRequest(endpoint, path, accessToken);
    if (result.ok) bySku.set(sku, result.data);
    else errors.push({ sku, error: result.error, status: result.status });
    if (i < skus.length - 1) await sleep(230);
  }
  return { bySku, errors };
}

async function makeProductId(marketplaceId, asin, sellerSku) {
  const input = new TextEncoder().encode(`${marketplaceId}|${asin || ""}|${sellerSku || ""}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

async function normalizeProductIdentities(inventoryItems, pricingBySku, listingsBySku) {
  const normalized = [];
  for (const item of inventoryItems) {
    const inventoryAsin = item?.asin || null;
    const sellerSku = item?.sellerSku || null;
    if (!inventoryAsin && !sellerSku) continue;

    const pricing = pricingBySku.get(sellerSku) || null;
    const listing = listingsBySku.get(sellerSku) || null;
    const summary = Array.isArray(listing?.summaries) ? listing.summaries[0] : null;
    const attributes = listing?.attributes || {};
    const listingOffer = Array.isArray(listing?.offers) ? listing.offers[0] : null;
    const asin = summary?.asin || pricing?.asin || inventoryAsin;
    const productName = summary?.itemName || firstAttributeValue(attributes, "item_name") || item?.productName || null;
    const productType = summary?.productType || findDeepValue(listing?.productTypes, ["productType", "product_type"]) || null;
    const brand = firstAttributeValue(attributes, "brand") || null;
    const listingStatus = Array.isArray(summary?.status) ? summary.status : [];
    const relationships = Array.isArray(listing?.relationships) ? listing.relationships : [];
    const issues = Array.isArray(listing?.issues) ? listing.issues : [];
    const listingPrice = listingOffer?.price?.amount ?? pricing?.listing_price ?? null;
    const listingCurrency = listingOffer?.price?.currencyCode || pricing?.listing_currency || null;

    normalized.push({
      product_id: await makeProductId(US_MARKETPLACE_ID, asin, sellerSku),
      marketplace: "US",
      marketplace_id: US_MARKETPLACE_ID,
      seller_id: pricing?.seller_id || null,
      asin,
      seller_sku: sellerSku,
      fnsku: item?.fnSku || null,
      product_name: productName,
      brand,
      product_type: productType,
      parent_asin: findDeepValue(relationships, ["parentAsin", "parentASIN", "parent_asin"]),
      main_image: summary?.mainImage?.link || null,
      condition: summary?.conditionType || item?.condition || pricing?.item_condition || null,
      listing_status: listingStatus,
      is_buyable: listingStatus.includes("BUYABLE"),
      listing_created_at: summary?.createdDate || null,
      listing_updated_at: summary?.lastUpdatedDate || null,
      listing_price: listingPrice,
      listing_currency: listingCurrency,
      landed_price: pricing?.landed_price ?? null,
      regular_price: pricing?.regular_price ?? null,
      fulfillment_channel: pricing?.fulfillment_channel || null,
      total_quantity: item?.totalQuantity ?? null,
      fulfillable_quantity: item?.inventoryDetails?.fulfillableQuantity ?? null,
      inbound_working_quantity: item?.inventoryDetails?.inboundWorkingQuantity ?? null,
      inbound_shipped_quantity: item?.inventoryDetails?.inboundShippedQuantity ?? null,
      inbound_receiving_quantity: item?.inventoryDetails?.inboundReceivingQuantity ?? null,
      listing_fulfillment_availability: listing?.fulfillmentAvailability || [],
      listing_issues: issues,
      relationships,
      data_sources: {
        identity: "amazon_sp_api_fba_inventory",
        pricing: pricing ? "amazon_sp_api_product_pricing" : null,
        listing: listing ? "amazon_sp_api_listings_items" : null,
      },
    });
  }
  return normalized;
}

function buildInventorySnapshot(products, observedAt) {
  const records = products.map((product) => {
    const working = Number(product.inbound_working_quantity || 0);
    const shipped = Number(product.inbound_shipped_quantity || 0);
    const receiving = Number(product.inbound_receiving_quantity || 0);
    return {
      snapshot_id: `${observedAt}:${product.product_id}`,
      product_id: product.product_id,
      marketplace: product.marketplace,
      marketplace_id: product.marketplace_id,
      asin: product.asin,
      seller_sku: product.seller_sku,
      fnsku: product.fnsku,
      observed_at: observedAt,
      source: "Amazon FBA Inventory API",
      total_quantity: product.total_quantity,
      fulfillable_quantity: product.fulfillable_quantity,
      inbound_working_quantity: product.inbound_working_quantity,
      inbound_shipped_quantity: product.inbound_shipped_quantity,
      inbound_receiving_quantity: product.inbound_receiving_quantity,
      inbound_total_quantity: working + shipped + receiving,
      inventory_state: "observed",
      freshness: { observed_at: observedAt, status: "current_at_write" },
    };
  });

  return {
    schema: "InventorySnapshot.v1",
    marketplace: "US",
    marketplace_id: US_MARKETPLACE_ID,
    observed_at: observedAt,
    source: "Amazon FBA Inventory API",
    record_count: records.length,
    records,
  };
}

async function refreshProductIdentities(env) {
  if (!env.PRODUCT_STATE) throw new Error("PRODUCT_STATE KV 尚未绑定");
  const { clientId, clientSecret, refreshToken } = getServerCredentials(env);
  const endpoint = REGION_ENDPOINTS.na;
  const lwa = await exchangeAccessToken(clientId, clientSecret, refreshToken);

  const { items, pages } = await getFbaInventory(endpoint, lwa.accessToken, US_MARKETPLACE_ID);
  const skus = items.map((item) => item?.sellerSku).filter(Boolean);

  const pricingResult = await getPricingBySkus(endpoint, lwa.accessToken, US_MARKETPLACE_ID, skus);
  const pricingNormalized = normalizePricing(pricingResult.records);

  const listingsResult = await getListingsBySkus(
    endpoint,
    lwa.accessToken,
    pricingNormalized.sellerId,
    US_MARKETPLACE_ID,
    skus,
  );

  const products = await normalizeProductIdentities(items, pricingNormalized.bySku, listingsResult.bySku);
  const updatedAt = new Date().toISOString();
  const inventorySnapshot = buildInventorySnapshot(products, updatedAt);
  const listingResolvedCount = products.filter((product) => product.data_sources.listing).length;
  const priceResolvedCount = products.filter((product) => product.listing_price != null).length;
  const buyableCount = products.filter((product) => product.is_buyable).length;
  const issueProductCount = products.filter((product) => Array.isArray(product.listing_issues) && product.listing_issues.length > 0).length;
  const titleResolvedCount = products.filter((product) => Boolean(product.product_name)).length;
  const imageResolvedCount = products.filter((product) => Boolean(product.main_image)).length;

  const snapshot = {
    schema: "ProductIdentitySnapshot.v2",
    marketplace: "US",
    marketplace_id: US_MARKETPLACE_ID,
    updated_at: updatedAt,
    sources: ["Amazon FBA Inventory API", "Amazon Product Pricing API", "Amazon Listings Items API"],
    product_count: products.length,
    seller_identity_resolved: Boolean(pricingNormalized.sellerId),
    diagnostics: {
      pricing_batch_errors: pricingResult.errors,
      listing_errors: listingsResult.errors,
    },
    products,
  };

  const status = {
    success: true,
    marketplace: "US",
    marketplaceId: US_MARKETPLACE_ID,
    productCount: products.length,
    pages,
    updatedAt,
    source: "Amazon FBA Inventory + Product Pricing + Listings Items",
    detailVisibility: "private-kv",
    v12: {
      sellerIdentityResolved: Boolean(pricingNormalized.sellerId),
      listingResolvedCount,
      titleResolvedCount,
      imageResolvedCount,
      priceResolvedCount,
      buyableCount,
      issueProductCount,
      pricingBatchErrorCount: pricingResult.errors.length,
      listingErrorCount: listingsResult.errors.length,
    },
    v13: {
      inventorySnapshotReady: true,
      inventoryRecordCount: inventorySnapshot.record_count,
      observedAt: inventorySnapshot.observed_at,
      source: inventorySnapshot.source,
    },
  };

  await env.PRODUCT_STATE.put("product-identities:US", JSON.stringify(snapshot));
  await env.PRODUCT_STATE.put("inventory-snapshot:US", JSON.stringify(inventorySnapshot));
  await env.PRODUCT_STATE.put("product-identity-status:US", JSON.stringify(status));
  return status;
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return {
    year: Number(map.year), month: Number(map.month), day: Number(map.day),
    hour: Number(map.hour), minute: Number(map.minute), second: Number(map.second),
  };
}

function zonedDateTimeToUtcMs(parts, timeZone) {
  const desired = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour || 0, parts.minute || 0, parts.second || 0);
  let guess = desired;
  for (let i = 0; i < 3; i += 1) {
    const actual = zonedParts(new Date(guess), timeZone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const delta = desired - actualAsUtc;
    guess += delta;
    if (Math.abs(delta) < 1000) break;
  }
  return guess;
}

function localMidnightDaysAgoIso(daysAgo, timeZone) {
  const today = zonedParts(new Date(), timeZone);
  const shifted = new Date(Date.UTC(today.year, today.month - 1, today.day - daysAgo));
  const startMs = zonedDateTimeToUtcMs({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: 0, minute: 0, second: 0,
  }, timeZone);
  return new Date(startMs).toISOString();
}

function normalizeOrderMetrics(payload, interval) {
  const metrics = Array.isArray(payload) ? payload : [];
  let totalSales = 0;
  let orderCount = 0;
  let orderItemCount = 0;
  let unitCount = 0;
  let currency = null;
  for (const metric of metrics) {
    totalSales += Number(metric?.totalSales?.amount || 0);
    orderCount += Number(metric?.orderCount || 0);
    orderItemCount += Number(metric?.orderItemCount || 0);
    unitCount += Number(metric?.unitCount || 0);
    currency = currency || metric?.totalSales?.currencyCode || metric?.averageUnitPrice?.currencyCode || null;
  }
  return {
    interval,
    total_sales: Number(totalSales.toFixed(2)),
    currency,
    order_count: orderCount,
    order_item_count: orderItemCount,
    unit_count: unitCount,
    average_unit_price: unitCount > 0 ? Number((totalSales / unitCount).toFixed(2)) : 0,
  };
}

async function getSalesRange(endpoint, accessToken, marketplaceId, startIso, endIso) {
  const interval = `${startIso}--${endIso}`;
  const params = new URLSearchParams({
    marketplaceIds: marketplaceId,
    interval,
    granularity: "Total",
    granularityTimeZone: "UTC",
    buyerType: "All",
  });
  const data = await spGet(endpoint, `/sales/v1/orderMetrics?${params.toString()}`, accessToken);
  return normalizeOrderMetrics(data?.payload, interval);
}

async function refreshSalesSnapshot(env) {
  if (!env.PRODUCT_STATE) throw new Error("PRODUCT_STATE KV 尚未绑定");
  const { clientId, clientSecret, refreshToken } = getServerCredentials(env);
  const endpoint = REGION_ENDPOINTS.na;
  const lwa = await exchangeAccessToken(clientId, clientSecret, refreshToken);
  const nowIso = new Date().toISOString();
  const timeZone = "America/Los_Angeles";

  const today = await getSalesRange(endpoint, lwa.accessToken, US_MARKETPLACE_ID, localMidnightDaysAgoIso(0, timeZone), nowIso);
  await sleep(2100);
  const last7Days = await getSalesRange(endpoint, lwa.accessToken, US_MARKETPLACE_ID, localMidnightDaysAgoIso(6, timeZone), nowIso);
  await sleep(2100);
  const last30Days = await getSalesRange(endpoint, lwa.accessToken, US_MARKETPLACE_ID, localMidnightDaysAgoIso(29, timeZone), nowIso);

  const snapshot = {
    schema: "SalesSnapshot.v1",
    marketplace: "US",
    marketplace_id: US_MARKETPLACE_ID,
    observed_at: nowIso,
    source: "Amazon Sales API /sales/v1/orderMetrics",
    time_zone: timeZone,
    ranges: { today, last_7_days: last7Days, last_30_days: last30Days },
  };
  const status = {
    success: true,
    ready: true,
    marketplace: "US",
    updatedAt: nowIso,
    source: "Amazon Sales API",
    currency: today.currency || last7Days.currency || last30Days.currency || null,
    rangesAvailable: ["today", "last_7_days", "last_30_days"],
    detailVisibility: "private-kv",
  };
  await env.PRODUCT_STATE.put("sales-snapshot:US", JSON.stringify(snapshot));
  await env.PRODUCT_STATE.put("sales-status:US", JSON.stringify(status));
  return status;
}

async function getPublicSalesStatus(env) {
  if (!env.PRODUCT_STATE) return { success: false, configured: false, message: "PRODUCT_STATE KV 尚未绑定" };
  const raw = await env.PRODUCT_STATE.get("sales-status:US");
  if (!raw) return { success: true, configured: true, ready: false, marketplace: "US", message: "SalesSnapshot 数据层已配置，等待首次私有刷新" };
  const status = JSON.parse(raw);
  return {
    success: true,
    configured: true,
    ready: Boolean(status.ready),
    marketplace: status.marketplace,
    updatedAt: status.updatedAt,
    source: status.source,
    currency: status.currency,
    rangesAvailable: status.rangesAvailable || [],
    detailVisibility: "private",
  };
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
  return {
    success: true,
    configured: true,
    ready: true,
    marketplace: status.marketplace,
    productCount: status.productCount,
    updatedAt: status.updatedAt,
    source: status.source,
    detailVisibility: "private",
    v12: status.v12 ? {
      sellerIdentityResolved: Boolean(status.v12.sellerIdentityResolved),
      listingResolvedCount: status.v12.listingResolvedCount ?? 0,
      titleResolvedCount: status.v12.titleResolvedCount ?? 0,
      imageResolvedCount: status.v12.imageResolvedCount ?? 0,
      priceResolvedCount: status.v12.priceResolvedCount ?? 0,
      buyableCount: status.v12.buyableCount ?? 0,
      issueProductCount: status.v12.issueProductCount ?? 0,
      pricingBatchErrorCount: status.v12.pricingBatchErrorCount ?? 0,
      listingErrorCount: status.v12.listingErrorCount ?? 0,
    } : null,
    v13: status.v13 ? {
      inventorySnapshotReady: Boolean(status.v13.inventorySnapshotReady),
      inventoryRecordCount: status.v13.inventoryRecordCount ?? 0,
      observedAt: status.v13.observedAt || null,
      source: status.v13.source || "Amazon FBA Inventory API",
    } : null,
  };
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

    if (request.method === "POST" && url.pathname === "/internal/refresh-sales") {
      if (!isInternalAuthorized(request, env)) return json({ success: false, message: "Unauthorized" }, 401, origin);
      try {
        const status = await refreshSalesSnapshot(env);
        return json(status, 200, origin);
      } catch (error) {
        return json({ success: false, message: "SalesSnapshot 私有刷新失败", error: error.message }, 502, origin);
      }
    }

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
      return json({
        ok: true,
        service: "1122-amazon-sp-api-bridge",
        status: "online",
        version: "4.2.0",
        credentialMode: "worker-secrets",
        productState: Boolean(env.PRODUCT_STATE),
      }, 200, origin);
    }

    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ success: false, message: "Origin not allowed" }, 403, origin);

    if (request.method === "GET" && url.pathname === "/connection-status") {
      try { return json(await buildConnectionStatus(env), 200, origin); }
      catch (error) { return json({ success: false, message: "Amazon SP-API 后端连接检查失败", error: error.message, credentialMode: "worker-secrets" }, 400, origin); }
    }

    if (request.method === "GET" && url.pathname === "/sales-status") {
      try { return json(await getPublicSalesStatus(env), 200, origin); }
      catch (error) { return json({ success: false, message: "SalesSnapshot 状态读取失败", error: error.message }, 500, origin); }
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
