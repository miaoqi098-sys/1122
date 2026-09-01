import fs from 'node:fs';

const path='对外连接板块/02_1122连接亚马逊API/worker/worker.js';
let code=fs.readFileSync(path,'utf8');

code=code.replace(
  'const ALLOWED_ORIGIN = "https://miaoqi098-sys.github.io";',
  'const ALLOWED_ORIGINS = new Set(["https://1122-web-agent.pages.dev", "https://miaoqi098-sys.github.io"]);\nconst PRIMARY_WEB_ORIGIN = "https://1122-web-agent.pages.dev";'
);

code=code.replace(
  '"Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,',
  '"Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : PRIMARY_WEB_ORIGIN,'
);

code=code.replace(
  'if (origin && origin !== ALLOWED_ORIGIN) return json({ success: false, message: "Origin not allowed" }, 403, origin);',
  'if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ success: false, message: "Origin not allowed" }, 403, origin);'
);

if(!code.includes('async function refreshSalesSnapshot(env)')){
  const marker='function isInternalAuthorized(request, env) {';
  if(!code.includes(marker)) throw new Error('Missing internal auth marker');
  const salesCode=`function zonedParts(date, timeZone) {
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
  const interval = \`${'${startIso}'}--${'${endIso}'}\`;
  const params = new URLSearchParams({
    marketplaceIds: marketplaceId,
    interval,
    granularity: "Total",
    granularityTimeZone: "UTC",
    buyerType: "All",
  });
  const data = await spGet(endpoint, \`/sales/v1/orderMetrics?${'${params.toString()}'}\`, accessToken);
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

`;
  code=code.replace(marker,salesCode+marker);
}

if(!code.includes('url.pathname === "/internal/refresh-sales"')){
  const marker='    if (request.method === "POST" && url.pathname === "/internal/refresh-product-identities") {';
  if(!code.includes(marker)) throw new Error('Missing refresh product route');
  const route=`    if (request.method === "POST" && url.pathname === "/internal/refresh-sales") {
      if (!isInternalAuthorized(request, env)) return json({ success: false, message: "Unauthorized" }, 401, origin);
      try {
        const status = await refreshSalesSnapshot(env);
        return json(status, 200, origin);
      } catch (error) {
        return json({ success: false, message: "SalesSnapshot 私有刷新失败", error: error.message }, 502, origin);
      }
    }

`;
  code=code.replace(marker,route+marker);
}

if(!code.includes('url.pathname === "/sales-status"')){
  const marker='    if (request.method === "GET" && url.pathname === "/product-identity-status") {';
  if(!code.includes(marker)) throw new Error('Missing product status route');
  const route=`    if (request.method === "GET" && url.pathname === "/sales-status") {
      try { return json(await getPublicSalesStatus(env), 200, origin); }
      catch (error) { return json({ success: false, message: "SalesSnapshot 状态读取失败", error: error.message }, 500, origin); }
    }

`;
  code=code.replace(marker,route+marker);
}

code=code.replace('version: "4.1.0"','version: "4.2.0"');
code=code.replace('1122AmazonBridge/4.0','1122AmazonBridge/4.2');

fs.writeFileSync(path,code);
console.log('SalesSnapshot V1.4 + Cloudflare Pages CORS patch complete');
