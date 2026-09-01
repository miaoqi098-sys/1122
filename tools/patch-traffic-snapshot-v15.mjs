import fs from 'node:fs';

const path='对外连接板块/02_1122连接亚马逊API/worker/worker.js';
let code=fs.readFileSync(path,'utf8');

const oldRequest=`async function spRequest(endpoint, path, accessToken) {
  const response = await fetch(\`${'${endpoint}'}${'${path}'}\`, { method: "GET", headers: spHeaders(accessToken) });
  let data = {};
  try { data = await response.json(); } catch {
    return { ok: false, status: response.status, data: {}, error: \`SP-API 返回非 JSON 响应（HTTP ${'${response.status}'}）\` };
  }
  if (!response.ok) {
    const message = data?.errors?.[0]?.message || data?.message || \`HTTP ${'${response.status}'}\`;
    const code = data?.errors?.[0]?.code || "SP_API_ERROR";
    return { ok: false, status: response.status, data, error: \`${'${code}'} · ${'${message}'}\` };
  }
  return { ok: true, status: response.status, data, error: null };
}`;

const newRequest=`async function spRequest(endpoint, path, accessToken, options = {}) {
  const method = options.method || "GET";
  const headers = spHeaders(accessToken);
  let body;
  if (options.body !== undefined && options.body !== null) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const response = await fetch(\`${'${endpoint}'}${'${path}'}\`, { method, headers, body });
  let data = {};
  try { data = await response.json(); } catch {
    return { ok: false, status: response.status, data: {}, error: \`SP-API 返回非 JSON 响应（HTTP ${'${response.status}'}）\` };
  }
  if (!response.ok) {
    const message = data?.errors?.[0]?.message || data?.message || \`HTTP ${'${response.status}'}\`;
    const errorCode = data?.errors?.[0]?.code || "SP_API_ERROR";
    return { ok: false, status: response.status, data, error: \`${'${errorCode}'} · ${'${message}'}\` };
  }
  return { ok: true, status: response.status, data, error: null };
}`;

if(code.includes(oldRequest)) code=code.replace(oldRequest,newRequest);
else if(!code.includes('options = {}')) throw new Error('Missing spRequest target');

if(!code.includes('async function spPost(')){
  const marker='async function getMarketplaceParticipations(endpoint, accessToken) {';
  if(!code.includes(marker)) throw new Error('Missing marketplace marker');
  code=code.replace(marker,`async function spPost(endpoint, path, accessToken, body) {
  const result = await spRequest(endpoint, path, accessToken, { method: "POST", body });
  if (!result.ok) throw new Error(\`SP-API 调用失败：${'${result.error}'}\`);
  return result.data;
}

${marker}`);
}

if(!code.includes('async function createTrafficReportJob(env)')){
  const marker='function isInternalAuthorized(request, env) {';
  if(!code.includes(marker)) throw new Error('Missing internal auth marker');
  const traffic=`function normalizeTrafficDateRecord(row) {
  const sales = row?.salesByDate || {};
  const traffic = row?.trafficByDate || {};
  return {
    date: row?.date || null,
    sessions: Number(traffic.sessions || 0),
    page_views: Number(traffic.pageViews || 0),
    browser_sessions: Number(traffic.browserSessions || 0),
    mobile_app_sessions: Number(traffic.mobileAppSessions || 0),
    buy_box_percentage: Number(traffic.buyBoxPercentage || 0),
    order_item_session_percentage: Number(traffic.orderItemSessionPercentage || 0),
    unit_session_percentage: Number(traffic.unitSessionPercentage || 0),
    units_ordered: Number(sales.unitsOrdered || 0),
    order_items: Number(sales.totalOrderItems || 0),
    ordered_product_sales: Number(sales?.orderedProductSales?.amount || 0),
    currency: sales?.orderedProductSales?.currencyCode || null,
    units_refunded: Number(sales.unitsRefunded || 0),
    refund_rate: Number(sales.refundRate || 0),
  };
}

function normalizeTrafficProductRecord(row, productMap) {
  const sales = row?.salesByAsin || {};
  const traffic = row?.trafficByAsin || {};
  const sku = row?.sku || null;
  return {
    product_id: sku ? productMap.get(sku) || null : null,
    sku,
    asin: row?.childAsin || null,
    parent_asin: row?.parentAsin || null,
    sessions: Number(traffic.sessions || 0),
    page_views: Number(traffic.pageViews || 0),
    buy_box_percentage: Number(traffic.buyBoxPercentage || 0),
    unit_session_percentage: Number(traffic.unitSessionPercentage || 0),
    units_ordered: Number(sales.unitsOrdered || 0),
    order_items: Number(sales.totalOrderItems || 0),
    ordered_product_sales: Number(sales?.orderedProductSales?.amount || 0),
    currency: sales?.orderedProductSales?.currencyCode || null,
  };
}

async function readReportDocument(meta) {
  const response = await fetch(meta.url, { method: "GET" });
  if (!response.ok) throw new Error(\`Report document 下载失败：HTTP ${'${response.status}'}\`);
  const buffer = await response.arrayBuffer();
  let text;
  if (meta.compressionAlgorithm === "GZIP") {
    if (typeof DecompressionStream === "undefined") throw new Error("运行环境不支持 GZIP 解压");
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder().decode(buffer);
  }
  try { return JSON.parse(text); }
  catch { throw new Error("Sales & Traffic 报告不是有效 JSON"); }
}

async function createTrafficReportJob(env) {
  if (!env.PRODUCT_STATE) throw new Error("PRODUCT_STATE KV 尚未绑定");
  const { clientId, clientSecret, refreshToken } = getServerCredentials(env);
  const lwa = await exchangeAccessToken(clientId, clientSecret, refreshToken);
  const endpoint = REGION_ENDPOINTS.na;
  const timeZone = "America/Los_Angeles";
  const body = {
    reportType: "GET_SALES_AND_TRAFFIC_REPORT",
    marketplaceIds: [US_MARKETPLACE_ID],
    dataStartTime: localMidnightDaysAgoIso(29, timeZone),
    dataEndTime: new Date().toISOString(),
    reportOptions: { dateGranularity: "DAY", asinGranularity: "SKU" },
  };
  const data = await spPost(endpoint, "/reports/2021-06-30/reports", lwa.accessToken, body);
  if (!data?.reportId) throw new Error("Amazon Reports API 未返回 reportId");
  const status = {
    success: true,
    pending: true,
    reportId: data.reportId,
    createdAt: new Date().toISOString(),
    source: "GET_SALES_AND_TRAFFIC_REPORT",
  };
  await env.PRODUCT_STATE.put("traffic-job:US", JSON.stringify(status), { expirationTtl: 86400 });
  return status;
}

async function finalizeTrafficReportJob(env, reportId) {
  if (!env.PRODUCT_STATE) throw new Error("PRODUCT_STATE KV 尚未绑定");
  const { clientId, clientSecret, refreshToken } = getServerCredentials(env);
  const lwa = await exchangeAccessToken(clientId, clientSecret, refreshToken);
  const endpoint = REGION_ENDPOINTS.na;
  const report = await spGet(endpoint, \`/reports/2021-06-30/reports/${'${encodeURIComponent(reportId)}'}\`, lwa.accessToken);
  const processingStatus = report?.processingStatus || "UNKNOWN";
  if (processingStatus === "IN_QUEUE" || processingStatus === "IN_PROGRESS") {
    return { success: true, pending: true, processingStatus };
  }
  if (processingStatus !== "DONE") {
    throw new Error(\`Traffic report 处理失败：${'${processingStatus}'}\`);
  }
  if (!report?.reportDocumentId) throw new Error("Traffic report DONE 但缺少 reportDocumentId");

  const documentMeta = await spGet(endpoint, \`/reports/2021-06-30/documents/${'${encodeURIComponent(report.reportDocumentId)}'}\`, lwa.accessToken);
  const reportData = await readReportDocument(documentMeta);
  const productRaw = await env.PRODUCT_STATE.get("product-identities:US");
  const productSnapshot = productRaw ? JSON.parse(productRaw) : { products: [] };
  const productMap = new Map((productSnapshot.products || []).filter((p) => p.seller_sku).map((p) => [p.seller_sku, p.product_id]));

  const byDate = Array.isArray(reportData?.salesAndTrafficByDate)
    ? reportData.salesAndTrafficByDate.map(normalizeTrafficDateRecord)
    : [];
  const byProduct = Array.isArray(reportData?.salesAndTrafficByAsin)
    ? reportData.salesAndTrafficByAsin.map((row) => normalizeTrafficProductRecord(row, productMap))
    : [];
  const matchedProductCount = byProduct.filter((row) => Boolean(row.product_id)).length;
  const observedAt = new Date().toISOString();
  const snapshot = {
    schema: "TrafficSnapshot.v1",
    marketplace: "US",
    marketplace_id: US_MARKETPLACE_ID,
    observed_at: observedAt,
    source: "Amazon GET_SALES_AND_TRAFFIC_REPORT",
    report_id: reportId,
    report_range: { dataStartTime: report.dataStartTime || null, dataEndTime: report.dataEndTime || null },
    by_date: byDate,
    by_product: byProduct,
  };
  const status = {
    success: true,
    ready: true,
    marketplace: "US",
    updatedAt: observedAt,
    source: "Amazon Sales & Traffic Report",
    dateRecordCount: byDate.length,
    productRecordCount: byProduct.length,
    matchedProductCount,
    dataStartTime: report.dataStartTime || null,
    dataEndTime: report.dataEndTime || null,
    detailVisibility: "private-kv",
  };
  await env.PRODUCT_STATE.put("traffic-snapshot:US", JSON.stringify(snapshot));
  await env.PRODUCT_STATE.put("traffic-status:US", JSON.stringify(status));
  await env.PRODUCT_STATE.delete("traffic-job:US");
  return status;
}

async function getPublicTrafficStatus(env) {
  if (!env.PRODUCT_STATE) return { success: false, configured: false, message: "PRODUCT_STATE KV 尚未绑定" };
  const raw = await env.PRODUCT_STATE.get("traffic-status:US");
  if (!raw) return { success: true, configured: true, ready: false, marketplace: "US", message: "TrafficSnapshot 数据层已配置，等待首次报告刷新" };
  const status = JSON.parse(raw);
  return {
    success: true,
    configured: true,
    ready: Boolean(status.ready),
    marketplace: status.marketplace,
    updatedAt: status.updatedAt,
    source: status.source,
    dateRecordCount: status.dateRecordCount ?? 0,
    productRecordCount: status.productRecordCount ?? 0,
    matchedProductCount: status.matchedProductCount ?? 0,
    dataStartTime: status.dataStartTime || null,
    dataEndTime: status.dataEndTime || null,
    detailVisibility: "private",
  };
}

`;
  code=code.replace(marker,traffic+marker);
}

if(!code.includes('url.pathname === "/internal/create-traffic-report"')){
  const marker='    if (request.method === "POST" && url.pathname === "/internal/refresh-sales") {';
  if(!code.includes(marker)) throw new Error('Missing internal sales route');
  const routes=`    if (request.method === "POST" && url.pathname === "/internal/create-traffic-report") {
      if (!isInternalAuthorized(request, env)) return json({ success: false, message: "Unauthorized" }, 401, origin);
      try { return json(await createTrafficReportJob(env), 202, origin); }
      catch (error) { return json({ success: false, message: "Traffic report 创建失败", error: error.message }, 502, origin); }
    }

    if (request.method === "POST" && url.pathname === "/internal/finalize-traffic-report") {
      if (!isInternalAuthorized(request, env)) return json({ success: false, message: "Unauthorized" }, 401, origin);
      const reportId = url.searchParams.get("reportId");
      if (!reportId) return json({ success: false, message: "reportId required" }, 400, origin);
      try {
        const status = await finalizeTrafficReportJob(env, reportId);
        return json(status, status.pending ? 202 : 200, origin);
      } catch (error) {
        return json({ success: false, message: "Traffic report 完成失败", error: error.message }, 502, origin);
      }
    }

`;
  code=code.replace(marker,routes+marker);
}

if(!code.includes('url.pathname === "/traffic-status"')){
  const marker='    if (request.method === "GET" && url.pathname === "/sales-status") {';
  if(!code.includes(marker)) throw new Error('Missing sales status route');
  const route=`    if (request.method === "GET" && url.pathname === "/traffic-status") {
      try { return json(await getPublicTrafficStatus(env), 200, origin); }
      catch (error) { return json({ success: false, message: "TrafficSnapshot 状态读取失败", error: error.message }, 500, origin); }
    }

`;
  code=code.replace(marker,route+marker);
}

code=code.replace('version: "4.2.0"','version: "4.3.0"');
code=code.replace('1122AmazonBridge/4.2','1122AmazonBridge/4.3');

fs.writeFileSync(path,code);
console.log('TrafficSnapshot V1.5 patch complete');
