import fs from 'node:fs';

const path='对外连接板块/02_1122连接亚马逊API/worker/worker.js';
let code=fs.readFileSync(path,'utf8');

if(!code.includes('function buildInventorySnapshot(')){
  const marker='async function refreshProductIdentities(env) {';
  if(!code.includes(marker))throw new Error('Missing refreshProductIdentities marker');
  const fn=`function buildInventorySnapshot(products, observedAt) {
  const records = products.map((product) => {
    const working = Number(product.inbound_working_quantity || 0);
    const shipped = Number(product.inbound_shipped_quantity || 0);
    const receiving = Number(product.inbound_receiving_quantity || 0);
    return {
      snapshot_id: \`${'${observedAt}'}:${'${product.product_id}'}\`,
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

`;
  code=code.replace(marker,fn+marker);
}

const updatedMarker='  const products = await normalizeProductIdentities(items, pricingNormalized.bySku, listingsResult.bySku);\n  const updatedAt = new Date().toISOString();';
if(!code.includes('const inventorySnapshot = buildInventorySnapshot(products, updatedAt);')){
  if(!code.includes(updatedMarker))throw new Error('Missing products/updatedAt marker');
  code=code.replace(updatedMarker,updatedMarker+'\n  const inventorySnapshot = buildInventorySnapshot(products, updatedAt);');
}

const v12End=`      listingErrorCount: listingsResult.errors.length,
    },
  };`;
if(!code.includes('inventorySnapshotReady: true')){
  if(!code.includes(v12End))throw new Error('Missing status v12 marker');
  code=code.replace(v12End,`      listingErrorCount: listingsResult.errors.length,
    },
    v13: {
      inventorySnapshotReady: true,
      inventoryRecordCount: inventorySnapshot.record_count,
      observedAt: inventorySnapshot.observed_at,
      source: inventorySnapshot.source,
    },
  };`);
}

const storeMarker='  await env.PRODUCT_STATE.put("product-identities:US", JSON.stringify(snapshot));\n  await env.PRODUCT_STATE.put("product-identity-status:US", JSON.stringify(status));';
if(!code.includes('inventory-snapshot:US')){
  if(!code.includes(storeMarker))throw new Error('Missing KV store marker');
  code=code.replace(storeMarker,'  await env.PRODUCT_STATE.put("product-identities:US", JSON.stringify(snapshot));\n  await env.PRODUCT_STATE.put("inventory-snapshot:US", JSON.stringify(inventorySnapshot));\n  await env.PRODUCT_STATE.put("product-identity-status:US", JSON.stringify(status));');
}

const publicV12End=`      listingErrorCount: status.v12.listingErrorCount ?? 0,
    } : null,
  };`;
if(!code.includes('inventorySnapshotReady: Boolean(status.v13.inventorySnapshotReady)')){
  if(!code.includes(publicV12End))throw new Error('Missing public v12 marker');
  code=code.replace(publicV12End,`      listingErrorCount: status.v12.listingErrorCount ?? 0,
    } : null,
    v13: status.v13 ? {
      inventorySnapshotReady: Boolean(status.v13.inventorySnapshotReady),
      inventoryRecordCount: status.v13.inventoryRecordCount ?? 0,
      observedAt: status.v13.observedAt || null,
      source: status.v13.source || "Amazon FBA Inventory API",
    } : null,
  };`);
}

code=code.replace('version: "4.0.0"','version: "4.1.0"');
fs.writeFileSync(path,code);
console.log('InventorySnapshot V1.3 patch complete');
