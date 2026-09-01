import fs from 'node:fs';

const path='对外连接板块/02_1122连接亚马逊API/worker/worker.js';
let code=fs.readFileSync(path,'utf8');

code=code.replace('reportOptions: { dateGranularity: "DAY", asinGranularity: "SKU" },','reportOptions: { dateGranularity: "DAY", asinGranularity: "CHILD" },');

code=code.replace(
`function normalizeTrafficProductRecord(row, productMap) {
  const sales = row?.salesByAsin || {};
  const traffic = row?.trafficByAsin || {};
  const sku = row?.sku || null;
  return {
    product_id: sku ? productMap.get(sku) || null : null,`,
`function normalizeTrafficProductRecord(row, identityMaps) {
  const sales = row?.salesByAsin || {};
  const traffic = row?.trafficByAsin || {};
  const sku = row?.sku || null;
  const childAsin = row?.childAsin || null;
  const productId = (sku && identityMaps.bySku.get(sku)) || (childAsin && identityMaps.byAsin.get(childAsin)) || null;
  return {
    product_id: productId,`
);

code=code.replace(
`  const productMap = new Map((productSnapshot.products || []).filter((p) => p.seller_sku).map((p) => [p.seller_sku, p.product_id]));

  const byDate = Array.isArray(reportData?.salesAndTrafficByDate)
    ? reportData.salesAndTrafficByDate.map(normalizeTrafficDateRecord)
    : [];
  const byProduct = Array.isArray(reportData?.salesAndTrafficByAsin)
    ? reportData.salesAndTrafficByAsin.map((row) => normalizeTrafficProductRecord(row, productMap))
    : [];`,
`  const products = productSnapshot.products || [];
  const identityMaps = {
    bySku: new Map(products.filter((p) => p.seller_sku).map((p) => [p.seller_sku, p.product_id])),
    byAsin: new Map(products.filter((p) => p.asin).map((p) => [p.asin, p.product_id])),
  };

  const byDate = Array.isArray(reportData?.salesAndTrafficByDate)
    ? reportData.salesAndTrafficByDate.map(normalizeTrafficDateRecord)
    : [];
  const byProduct = Array.isArray(reportData?.salesAndTrafficByAsin)
    ? reportData.salesAndTrafficByAsin.map((row) => normalizeTrafficProductRecord(row, identityMaps))
    : [];`
);

if(!code.includes('async function refreshFinanceSnapshot(env)')){
  const marker='function isInternalAuthorized(request, env) {';
  if(!code.includes(marker)) throw new Error('Missing internal authorization marker');
  const finance=`function aggregateFinanceTransactions(transactions, postedAfter, postedBefore) {
  const groups = new Map();
  let transactionCount = 0;
  let netAmount = 0;
  let currency = null;
  for (const tx of transactions) {
    const marketplaceId = tx?.sellingPartnerMetadata?.marketplaceId || null;
    if (marketplaceId && marketplaceId !== US_MARKETPLACE_ID) continue;
    const amount = Number(tx?.totalAmount?.currencyAmount || 0);
    const txCurrency = tx?.totalAmount?.currencyCode || null;
    const type = tx?.transactionType || "Unknown";
    transactionCount += 1;
    netAmount += amount;
    currency = currency || txCurrency;
    const current = groups.get(type) || { transaction_type: type, count: 0, total_amount: 0 };
    current.count += 1;
    current.total_amount += amount;
    groups.set(type, current);
  }
  return {
    schema: "FinanceSnapshot.v1",
    marketplace: "US",
    marketplace_id: US_MARKETPLACE_ID,
    observed_at: new Date().toISOString(),
    posted_after: postedAfter,
    posted_before: postedBefore,
    source: "Amazon Finances API 2024-06-19",
    currency,
    transaction_count: transactionCount,
    net_amount: Number(netAmount.toFixed(2)),
    by_transaction_type: Array.from(groups.values()).map((g) => ({ ...g, total_amount: Number(g.total_amount.toFixed(2)) })),
  };
}

async function refreshFinanceSnapshot(env) {
  if (!env.PRODUCT_STATE) throw new Error("PRODUCT_STATE KV 尚未绑定");
  const { clientId, clientSecret, refreshToken } = getServerCredentials(env);
  const endpoint = REGION_ENDPOINTS.na;
  const lwa = await exchangeAccessToken(clientId, clientSecret, refreshToken);
  const postedBeforeDate = new Date(Date.now() - 3 * 60 * 1000);
  const postedAfterDate = new Date(postedBeforeDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const postedBefore = postedBeforeDate.toISOString();
  const postedAfter = postedAfterDate.toISOString();
  const transactions = [];
  let nextToken = null;
  let pages = 0;
  do {
    const params = new URLSearchParams({ postedAfter, postedBefore, marketplaceId: US_MARKETPLACE_ID });
    if (nextToken) params.set("nextToken", nextToken);
    const data = await spGet(endpoint, \`/finances/2024-06-19/transactions?${'${params.toString()}'}\`, lwa.accessToken);
    const pageTransactions = Array.isArray(data?.payload?.transactions) ? data.payload.transactions : [];
    transactions.push(...pageTransactions);
    nextToken = data?.payload?.nextToken || null;
    pages += 1;
    if (nextToken) await sleep(2100);
  } while (nextToken && pages < 100);
  if (nextToken) throw new Error("Finances 分页超过安全上限 100 页，已停止刷新");

  const snapshot = aggregateFinanceTransactions(transactions, postedAfter, postedBefore);
  const status = {
    success: true,
    ready: true,
    marketplace: "US",
    updatedAt: snapshot.observed_at,
    source: snapshot.source,
    currency: snapshot.currency,
    transactionCount: snapshot.transaction_count,
    transactionTypeCount: snapshot.by_transaction_type.length,
    pages,
    postedAfter,
    postedBefore,
    detailVisibility: "private-kv",
  };
  await env.PRODUCT_STATE.put("finance-snapshot:US", JSON.stringify(snapshot));
  await env.PRODUCT_STATE.put("finance-status:US", JSON.stringify(status));
  return status;
}

async function getPublicFinanceStatus(env) {
  if (!env.PRODUCT_STATE) return { success: false, configured: false, message: "PRODUCT_STATE KV 尚未绑定" };
  const raw = await env.PRODUCT_STATE.get("finance-status:US");
  if (!raw) return { success: true, configured: true, ready: false, marketplace: "US", message: "FinanceSnapshot 数据层已配置，等待首次私有刷新" };
  const status = JSON.parse(raw);
  return {
    success: true,
    configured: true,
    ready: Boolean(status.ready),
    marketplace: status.marketplace,
    updatedAt: status.updatedAt,
    source: status.source,
    currency: status.currency,
    transactionCount: status.transactionCount ?? 0,
    transactionTypeCount: status.transactionTypeCount ?? 0,
    pages: status.pages ?? 0,
    postedAfter: status.postedAfter || null,
    postedBefore: status.postedBefore || null,
    detailVisibility: "private",
  };
}

`;
  code=code.replace(marker,finance+marker);
}

if(!code.includes('url.pathname === "/internal/refresh-finance"')){
  const marker='    if (request.method === "POST" && url.pathname === "/internal/create-traffic-report") {';
  if(!code.includes(marker)) throw new Error('Missing traffic internal route');
  const route=`    if (request.method === "POST" && url.pathname === "/internal/refresh-finance") {
      if (!isInternalAuthorized(request, env)) return json({ success: false, message: "Unauthorized" }, 401, origin);
      try { return json(await refreshFinanceSnapshot(env), 200, origin); }
      catch (error) { return json({ success: false, message: "FinanceSnapshot 私有刷新失败", error: error.message }, 502, origin); }
    }

`;
  code=code.replace(marker,route+marker);
}

if(!code.includes('url.pathname === "/finance-status"')){
  const marker='    if (request.method === "GET" && url.pathname === "/traffic-status") {';
  if(!code.includes(marker)) throw new Error('Missing traffic status route');
  const route=`    if (request.method === "GET" && url.pathname === "/finance-status") {
      try { return json(await getPublicFinanceStatus(env), 200, origin); }
      catch (error) { return json({ success: false, message: "FinanceSnapshot 状态读取失败", error: error.message }, 500, origin); }
    }

`;
  code=code.replace(marker,route+marker);
}

code=code.replace('version: "4.3.0"','version: "4.4.0"');
code=code.replace('1122AmazonBridge/4.3','1122AmazonBridge/4.4');

fs.writeFileSync(path,code);
console.log('FinanceSnapshot V1.6 + CHILD Traffic mapping patch complete');
