import fs from 'node:fs';

const path = '对外连接板块/02_1122连接亚马逊API/worker/worker.js';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes('async function persistProductSnapshotToCore(')) {
  const marker = 'async function refreshProductIdentities(env) {';
  if (!code.includes(marker)) throw new Error('Missing refreshProductIdentities marker');
  const helpers = `async function coreBatch(env, statements, chunkSize = 50) {
  if (!env.CORE_DB || !statements.length) return 0;
  let total = 0;
  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize);
    await env.CORE_DB.batch(chunk);
    total += chunk.length;
  }
  return total;
}

function jsonText(value) {
  return value == null ? null : JSON.stringify(value);
}

function archiveDateParts(observedAt) {
  const d = new Date(observedAt || Date.now());
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  return {
    year: String(safe.getUTCFullYear()),
    month: String(safe.getUTCMonth() + 1).padStart(2, "0"),
    day: String(safe.getUTCDate()).padStart(2, "0"),
    stamp: safe.toISOString().replace(/[:.]/g, "-")
  };
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function archiveJson(env, dataset, payload, observedAt, source = "Amazon") {
  if (!env.DATA_ARCHIVE) return null;
  const parts = archiveDateParts(observedAt);
  const key = \`amazon/\${dataset}/\${parts.year}/\${parts.month}/\${parts.day}/\${dataset}-\${parts.stamp}-\${crypto.randomUUID()}.json\`;
  const body = JSON.stringify(payload);
  await env.DATA_ARCHIVE.put(key, body, { httpMetadata: { contentType: "application/json" } });
  if (env.CORE_DB) {
    await env.CORE_DB.prepare(
      "INSERT OR IGNORE INTO raw_archive_manifest (archive_id, source, dataset, marketplace, r2_object_key, content_type, object_size_bytes, sha256, schema_version, source_observed_at, archived_at, ingestion_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      crypto.randomUUID(), source, dataset, payload?.marketplace || "US", key, "application/json",
      new TextEncoder().encode(body).byteLength, await sha256Hex(body), payload?.schema || null,
      observedAt || null, new Date().toISOString(), "ARCHIVED"
    ).run();
  }
  return key;
}

async function upsertDataSourceState(env, sourceKey, sourceName, dataset, status, observedAt, details = null) {
  if (!env.CORE_DB) return;
  const now = new Date().toISOString();
  await env.CORE_DB.prepare(
    "INSERT INTO data_source_state (source_key, source_name, dataset, status, last_success_at, last_attempt_at, freshness_status, schema_version, details_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source_key) DO UPDATE SET source_name=excluded.source_name, dataset=excluded.dataset, status=excluded.status, last_success_at=excluded.last_success_at, last_attempt_at=excluded.last_attempt_at, freshness_status=excluded.freshness_status, schema_version=excluded.schema_version, details_json=excluded.details_json, updated_at=excluded.updated_at"
  ).bind(sourceKey, sourceName, dataset, status, observedAt || now, now, "CURRENT_AT_WRITE", "v1", jsonText(details), now).run();
}

async function persistProductSnapshotToCore(env, snapshot, inventorySnapshot) {
  if (!env.CORE_DB) return { persisted: false, reason: "CORE_DB_NOT_BOUND" };
  const now = new Date().toISOString();
  const statements = [];
  for (const p of snapshot.products || []) {
    statements.push(env.CORE_DB.prepare(
      "INSERT INTO products (product_id, marketplace, marketplace_id, seller_id, parent_asin, asin, sku, fnsku, title, brand, product_type, main_image, listing_status_json, listing_price, regular_price, currency, fulfillment_channel, source, source_observed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(product_id) DO UPDATE SET marketplace=excluded.marketplace, marketplace_id=excluded.marketplace_id, seller_id=excluded.seller_id, parent_asin=excluded.parent_asin, asin=excluded.asin, sku=excluded.sku, fnsku=excluded.fnsku, title=excluded.title, brand=excluded.brand, product_type=excluded.product_type, main_image=excluded.main_image, listing_status_json=excluded.listing_status_json, listing_price=excluded.listing_price, regular_price=excluded.regular_price, currency=excluded.currency, fulfillment_channel=excluded.fulfillment_channel, source=excluded.source, source_observed_at=excluded.source_observed_at, updated_at=excluded.updated_at"
    ).bind(
      p.product_id, p.marketplace, p.marketplace_id, p.seller_id, p.parent_asin, p.asin, p.seller_sku, p.fnsku,
      p.product_name, p.brand, p.product_type, p.main_image, jsonText(p.listing_status), p.listing_price,
      p.regular_price, p.listing_currency, p.fulfillment_channel, "Amazon ProductIdentitySnapshot.v2", snapshot.updated_at, now
    ));
  }
  for (const r of inventorySnapshot.records || []) {
    statements.push(env.CORE_DB.prepare(
      "INSERT OR IGNORE INTO inventory_snapshots (snapshot_id, product_id, marketplace, observed_at, total_quantity, fulfillable_quantity, inbound_working_quantity, inbound_shipped_quantity, inbound_receiving_quantity, inbound_total_quantity, inventory_state, source, parser_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      r.snapshot_id, r.product_id, r.marketplace, r.observed_at, r.total_quantity, r.fulfillable_quantity,
      r.inbound_working_quantity, r.inbound_shipped_quantity, r.inbound_receiving_quantity, r.inbound_total_quantity,
      r.inventory_state, r.source, "amazon-bridge-4.5"
    ));
  }
  await coreBatch(env, statements);
  await upsertDataSourceState(env, "amazon-product-identity-us", "Amazon SP-API", "product_identity", "READY", snapshot.updated_at, { product_count: snapshot.product_count });
  await upsertDataSourceState(env, "amazon-inventory-us", "Amazon FBA Inventory API", "inventory", "READY", inventorySnapshot.observed_at, { record_count: inventorySnapshot.record_count });
  await archiveJson(env, "product-identity", snapshot, snapshot.updated_at);
  await archiveJson(env, "inventory", inventorySnapshot, inventorySnapshot.observed_at);
  return { persisted: true, products: (snapshot.products || []).length, inventory: (inventorySnapshot.records || []).length };
}

async function persistSalesSnapshotToCore(env, snapshot) {
  if (!env.CORE_DB) return { persisted: false, reason: "CORE_DB_NOT_BOUND" };
  const statements = [];
  for (const [periodKey, row] of Object.entries(snapshot.ranges || {})) {
    const parts = String(row.interval || "").split("--");
    statements.push(env.CORE_DB.prepare(
      "INSERT INTO sales_period_snapshots (sales_snapshot_id, marketplace, product_id, period_key, interval_start, interval_end, total_sales, currency, order_count, order_item_count, unit_count, average_unit_price, observed_at, source, parser_version) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      crypto.randomUUID(), snapshot.marketplace, periodKey, parts[0] || snapshot.observed_at, parts[1] || snapshot.observed_at,
      row.total_sales, row.currency, row.order_count, row.order_item_count, row.unit_count, row.average_unit_price,
      snapshot.observed_at, snapshot.source, "amazon-bridge-4.5"
    ));
  }
  await coreBatch(env, statements);
  await upsertDataSourceState(env, "amazon-sales-us", "Amazon Sales API", "sales", "READY", snapshot.observed_at, { ranges: Object.keys(snapshot.ranges || {}) });
  await archiveJson(env, "sales", snapshot, snapshot.observed_at);
  return { persisted: true, periods: statements.length };
}

async function persistTrafficSnapshotToCore(env, snapshot, rawReport = null) {
  if (!env.CORE_DB) return { persisted: false, reason: "CORE_DB_NOT_BOUND" };
  const statements = [];
  for (const row of snapshot.by_date || []) {
    statements.push(env.CORE_DB.prepare(
      "INSERT OR IGNORE INTO traffic_daily (traffic_daily_id, marketplace, product_id, business_date, sessions, page_views, browser_sessions, mobile_app_sessions, buy_box_percentage, order_item_session_percentage, unit_session_percentage, units_ordered, order_items, ordered_product_sales, currency, units_refunded, refund_rate, observed_at, source, parser_version) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      \`\${snapshot.report_id}:store:\${row.date}\`, snapshot.marketplace, row.date, row.sessions, row.page_views,
      row.browser_sessions, row.mobile_app_sessions, row.buy_box_percentage, row.order_item_session_percentage,
      row.unit_session_percentage, row.units_ordered, row.order_items, row.ordered_product_sales, row.currency,
      row.units_refunded, row.refund_rate, snapshot.observed_at, snapshot.source, "amazon-bridge-4.5"
    ));
  }
  await coreBatch(env, statements);
  await upsertDataSourceState(env, "amazon-traffic-us", "Amazon Sales & Traffic Report", "traffic", "READY", snapshot.observed_at, { date_records: (snapshot.by_date || []).length, product_records: (snapshot.by_product || []).length });
  if (rawReport) await archiveJson(env, "traffic-raw-report", { schema: "AmazonSalesTrafficRaw.v1", marketplace: snapshot.marketplace, observed_at: snapshot.observed_at, report: rawReport }, snapshot.observed_at);
  else await archiveJson(env, "traffic", snapshot, snapshot.observed_at);
  return { persisted: true, dailyRecords: statements.length };
}

async function persistFinanceSnapshotToCore(env, snapshot) {
  if (!env.CORE_DB) return { persisted: false, reason: "CORE_DB_NOT_BOUND" };
  await env.CORE_DB.prepare(
    "INSERT INTO finance_period_snapshots (finance_snapshot_id, marketplace, posted_after, posted_before, currency, transaction_count, net_amount, transaction_types_json, observed_at, source, semantic_status, parser_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    crypto.randomUUID(), snapshot.marketplace, snapshot.posted_after, snapshot.posted_before, snapshot.currency,
    snapshot.transaction_count, snapshot.net_amount, jsonText(snapshot.by_transaction_type), snapshot.observed_at,
    snapshot.source, "PENDING_VALIDATION", "amazon-bridge-4.5"
  ).run();
  await upsertDataSourceState(env, "amazon-finance-us", "Amazon Finances API", "finance", "CONNECTED_SEMANTIC_VALIDATION_PENDING", snapshot.observed_at, { transaction_count: snapshot.transaction_count });
  await archiveJson(env, "finance", snapshot, snapshot.observed_at);
  return { persisted: true, transactionCount: snapshot.transaction_count };
}

async function migrateCurrentKvToCore(env) {
  if (!env.CORE_DB) throw new Error("CORE_DB D1 尚未绑定");
  if (!env.PRODUCT_STATE) throw new Error("PRODUCT_STATE KV 尚未绑定");
  const keys = ["product-identities:US", "inventory-snapshot:US", "sales-snapshot:US", "traffic-snapshot:US", "finance-snapshot:US"];
  const values = Object.fromEntries(await Promise.all(keys.map(async (key) => [key, await env.PRODUCT_STATE.get(key)])));
  const result = { products: 0, inventory: 0, salesPeriods: 0, trafficDays: 0, financeSnapshots: 0, archiveAvailable: Boolean(env.DATA_ARCHIVE) };
  const productSnapshot = values["product-identities:US"] ? JSON.parse(values["product-identities:US"]) : null;
  const inventorySnapshot = values["inventory-snapshot:US"] ? JSON.parse(values["inventory-snapshot:US"]) : null;
  if (productSnapshot && inventorySnapshot) {
    const r = await persistProductSnapshotToCore(env, productSnapshot, inventorySnapshot);
    result.products = r.products || 0;
    result.inventory = r.inventory || 0;
  }
  if (values["sales-snapshot:US"]) {
    const r = await persistSalesSnapshotToCore(env, JSON.parse(values["sales-snapshot:US"]));
    result.salesPeriods = r.periods || 0;
  }
  if (values["traffic-snapshot:US"]) {
    const r = await persistTrafficSnapshotToCore(env, JSON.parse(values["traffic-snapshot:US"]));
    result.trafficDays = r.dailyRecords || 0;
  }
  if (values["finance-snapshot:US"]) {
    await persistFinanceSnapshotToCore(env, JSON.parse(values["finance-snapshot:US"]));
    result.financeSnapshots = 1;
  }
  await env.CORE_DB.prepare(
    "INSERT INTO data_layer_audit (audit_id, action_type, object_type, actor, summary, metadata_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(crypto.randomUUID(), "MIGRATE_CURRENT_KV_TO_D1", "DATA_LAYER", "1122-amazon-bridge", "Migrated existing current snapshots from KV into D1 permanent facts", JSON.stringify(result), new Date().toISOString()).run();
  return result;
}

`;
  code = code.replace(marker, helpers + marker);
}

function replaceOnce(oldText, newText, label) {
  if (code.includes(newText)) return;
  if (!code.includes(oldText)) throw new Error('Missing patch target: ' + label);
  code = code.replace(oldText, newText);
}

replaceOnce(
`  await env.PRODUCT_STATE.put("product-identities:US", JSON.stringify(snapshot));
  await env.PRODUCT_STATE.put("inventory-snapshot:US", JSON.stringify(inventorySnapshot));
  await env.PRODUCT_STATE.put("product-identity-status:US", JSON.stringify(status));
  return status;`,
`  await env.PRODUCT_STATE.put("product-identities:US", JSON.stringify(snapshot));
  await env.PRODUCT_STATE.put("inventory-snapshot:US", JSON.stringify(inventorySnapshot));
  await env.PRODUCT_STATE.put("product-identity-status:US", JSON.stringify(status));
  await persistProductSnapshotToCore(env, snapshot, inventorySnapshot);
  return status;`,
'product persistence');

replaceOnce(
`  await env.PRODUCT_STATE.put("sales-snapshot:US", JSON.stringify(snapshot));
  await env.PRODUCT_STATE.put("sales-status:US", JSON.stringify(status));
  return status;`,
`  await env.PRODUCT_STATE.put("sales-snapshot:US", JSON.stringify(snapshot));
  await env.PRODUCT_STATE.put("sales-status:US", JSON.stringify(status));
  await persistSalesSnapshotToCore(env, snapshot);
  return status;`,
'sales persistence');

replaceOnce(
`  await env.PRODUCT_STATE.put("traffic-snapshot:US", JSON.stringify(snapshot));
  await env.PRODUCT_STATE.put("traffic-status:US", JSON.stringify(status));
  await env.PRODUCT_STATE.delete("traffic-job:US");
  return status;`,
`  await env.PRODUCT_STATE.put("traffic-snapshot:US", JSON.stringify(snapshot));
  await env.PRODUCT_STATE.put("traffic-status:US", JSON.stringify(status));
  await env.PRODUCT_STATE.delete("traffic-job:US");
  await persistTrafficSnapshotToCore(env, snapshot, reportData);
  return status;`,
'traffic persistence');

replaceOnce(
`  await env.PRODUCT_STATE.put("finance-snapshot:US", JSON.stringify(snapshot));
  await env.PRODUCT_STATE.put("finance-status:US", JSON.stringify(status));
  return status;`,
`  await env.PRODUCT_STATE.put("finance-snapshot:US", JSON.stringify(snapshot));
  await env.PRODUCT_STATE.put("finance-status:US", JSON.stringify(status));
  await persistFinanceSnapshotToCore(env, snapshot);
  return status;`,
'finance persistence');

if (!code.includes('url.pathname === "/internal/migrate-current-data-layer"')) {
  const marker = '    if (request.method === "POST" && url.pathname === "/internal/refresh-finance") {';
  if (!code.includes(marker)) throw new Error('Missing internal finance route marker');
  const route = `    if (request.method === "POST" && url.pathname === "/internal/migrate-current-data-layer") {
      if (!isInternalAuthorized(request, env)) return json({ success: false, message: "Unauthorized" }, 401, origin);
      try {
        const migrated = await migrateCurrentKvToCore(env);
        return json({ success: true, migrated, detailVisibility: "private-d1" }, 200, origin);
      } catch (error) {
        return json({ success: false, message: "Data Layer migration failed", error: error.message }, 502, origin);
      }
    }

`;
  code = code.replace(marker, route + marker);
}

code = code.replace('version: "4.4.1"', 'version: "4.5.0"');
code = code.replace('1122AmazonBridge/4.4.1', '1122AmazonBridge/4.5');
code = code.replace(
`        productState: Boolean(env.PRODUCT_STATE),`,
`        productState: Boolean(env.PRODUCT_STATE),
        coreData: Boolean(env.CORE_DB),
        archive: Boolean(env.DATA_ARCHIVE),`
);

fs.writeFileSync(path, code);
console.log('Permanent D1 persistence and current-KV migration route added');
