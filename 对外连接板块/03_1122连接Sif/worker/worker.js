import {
  PARSER_VERSION,
  SIF_MCP_URL,
  callSifTool,
  initializeAndListSifTools,
  publicSifError,
  startSifSession,
} from "./sif-client.js";
import { handleResearchRequest, processResearchQueue, researchCapability } from "./research.js";

const ALLOWED_ORIGINS = new Set(["https://1122.sorilo-uk.com", "https://1122-web-agent.pages.dev", "https://miaoqi098-sys.github.io"]);

function cors(origin = "") {
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=UTF-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }
  return headers;
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: cors(origin),
  });
}

function fixedTimeEqual(leftValue, rightValue) {
  const left = new TextEncoder().encode(String(leftValue || ""));
  const right = new TextEncoder().encode(String(rightValue || ""));
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] || 0) ^ (right[index] || 0);
  }
  return mismatch === 0;
}

function isInternalAuthorized(request, env) {
  const expected = String(env.SIF_INTERNAL_TOKEN || "").trim();
  if (!expected) return false;
  const value = String(request.headers.get("Authorization") || "");
  return fixedTimeEqual(value, `Bearer ${expected}`);
}

function safeToolMetadata(tool) {
  return {
    name: String(tool?.name || ""),
    description: String(tool?.description || ""),
    inputSchema: tool?.inputSchema && typeof tool.inputSchema === "object" ? tool.inputSchema : null,
  };
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toInteger(value) {
  const n = toNumber(value);
  return n === null ? null : Math.round(n);
}

function arrayAt(value, index) {
  return Array.isArray(value) ? value[index] : null;
}

function nowIso() {
  return new Date().toISOString();
}

async function writeObservation(db, { toolName, dataset, subjectType, subjectKey, productId, marketplace, observedAt, payload }) {
  await db.prepare(
    `INSERT INTO external_tool_observations (
      observation_id, provider, tool_name, dataset, subject_type, subject_key,
      product_id, marketplace, observed_at, payload_json, schema_version, parser_version
    ) VALUES (?, 'sif', ?, ?, ?, ?, ?, ?, ?, ?, 'ExternalToolObservation.v1', ?)`
  ).bind(
    crypto.randomUUID(),
    toolName,
    dataset,
    subjectType,
    subjectKey,
    productId || null,
    marketplace || null,
    observedAt,
    JSON.stringify(payload ?? null),
    PARSER_VERSION
  ).run();
}

async function persistProfile(db, product, payload, observedAt) {
  const list = Array.isArray(payload?.list) ? payload.list : [];
  const row = list.find((x) => String(x?.asin || "").toUpperCase() === product.asin.toUpperCase()) || list[0];
  if (!row) return 0;

  await db.prepare(
    `INSERT INTO sif_asin_profile_snapshots (
      snapshot_id, product_id, marketplace, asin, title, brand, price, star_rating,
      rating_num, bought_in_past_month, first_available_day, variation_num,
      weight_oz, package_weight_oz, dimensions_json, package_dimensions_json,
      bsr_json, item_highlights_json, observed_at, parser_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(), product.product_id, product.marketplace, product.asin,
    row.title ?? null, row.brand ?? null, toNumber(row.price), toNumber(row.star_rating),
    toInteger(row.rating_num), toInteger(row.bought_in_past_month), row.first_available_day ?? null,
    toInteger(row.variation_num), toNumber(row.weight_oz), toNumber(row.package_weight_oz),
    JSON.stringify(row.dims_in ?? null), JSON.stringify(row.package_dims_in ?? null),
    JSON.stringify(row.bsr_list ?? null), JSON.stringify(row.item_highlights ?? null),
    observedAt, PARSER_VERSION
  ).run();
  return 1;
}

async function persistTraffic(db, product, payload, observedAt) {
  const dates = Array.isArray(payload?.dates) ? payload.dates : [];
  if (!dates.length) return 0;

  const statements = [];
  for (let i = 0; i < dates.length; i += 1) {
    statements.push(
      db.prepare(
        `INSERT OR IGNORE INTO sif_asin_traffic_daily (
          traffic_id, product_id, marketplace, asin, business_date,
          total_score, natural_score, ad_score, sp_score, rec_sp_score, sb_score, sbv_score,
          deal_price, buybox_price, prime_price, limited_deal_price, bsr, star_rating,
          review_count, bought_in_past_month, observed_at, parser_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(), product.product_id, product.marketplace, product.asin, String(dates[i]),
        toNumber(arrayAt(payload.totalScore, i)), toNumber(arrayAt(payload.nfScore, i)),
        toNumber(arrayAt(payload.adScore, i)), toNumber(arrayAt(payload.spScore, i)),
        toNumber(arrayAt(payload.recSpScore, i)), toNumber(arrayAt(payload.sbScore, i)),
        toNumber(arrayAt(payload.sbvScore, i)), toNumber(arrayAt(payload.dealPrice, i)),
        toNumber(arrayAt(payload.buyboxPrice, i)), toNumber(arrayAt(payload.primePrice, i)),
        toNumber(arrayAt(payload.ldPrice, i)), toInteger(arrayAt(payload.bsr, i)),
        toNumber(arrayAt(payload.star, i)), toInteger(arrayAt(payload.review, i)),
        toInteger(arrayAt(payload.boughtInPastMonth, i)), observedAt, PARSER_VERSION
      )
    );
  }
  await db.batch(statements);
  return statements.length;
}

async function persistKeywordSignals(db, product, payload, observedAt) {
  const rows = Array.isArray(payload?.top_keywords) ? payload.top_keywords : [];
  if (!rows.length) return 0;

  const statements = rows.map((row) => db.prepare(
    `INSERT INTO sif_asin_keyword_signals (
      signal_id, product_id, marketplace, asin, keyword, keyword_health, rank_evolution,
      traffic_share, contribution_change, contribution_severity, natural_ratio,
      traffic_dependency, search_volume, aba_rank, cpc_median, top3_click_share,
      top3_conversion_share, organic_rank, sp_rank, sb_rank, sbv_rank,
      channel_coverage_json, observed_at, parser_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(), product.product_id, product.marketplace, product.asin,
    String(row.keyword || ""), row.keyword_health ?? null, row.rank_evolution ?? null,
    toNumber(row.traffic_share), toNumber(row.contri_change), row.contri_severity ?? null,
    toNumber(row.natural_ratio), row.traffic_dependency ?? null, toNumber(row.search_volume),
    toInteger(row.aba_rank), toNumber(row.cpc_median), toNumber(row.top3_click_share),
    toNumber(row.top3_conversion_share), toNumber(row.organic_rank), toNumber(row.sp_rank),
    toNumber(row.sb_rank), toNumber(row.sbv_rank), JSON.stringify(row.channel_coverage ?? null),
    observedAt, PARSER_VERSION
  ));

  await db.batch(statements);
  return statements.length;
}

async function persistAdStructure(db, product, payload, observedAt) {
  const total = payload?.total_campaign_count ?? payload?.totalCampaignCount;
  const adTypes = payload?.ad_types ?? payload?.adTypes;
  if (total === undefined && !Array.isArray(adTypes)) return 0;

  await db.prepare(
    `INSERT INTO sif_asin_ad_structure_snapshots (
      snapshot_id, product_id, marketplace, asin, total_campaign_count,
      ad_types_json, structure_scope, observed_at, parser_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(), product.product_id, product.marketplace, product.asin,
    toInteger(total), JSON.stringify(adTypes ?? null),
    payload?.structureScope ?? payload?.structure_scope ?? 'historical', observedAt, PARSER_VERSION
  ).run();
  return 1;
}

async function selectStalestProducts(db, marketplace, limit) {
  const result = await db.prepare(
    `SELECT p.product_id, p.marketplace, p.asin
     FROM products p
     LEFT JOIN (
       SELECT product_id, MAX(observed_at) AS last_sif_observed_at
       FROM sif_asin_profile_snapshots
       GROUP BY product_id
     ) s ON s.product_id = p.product_id
     WHERE p.asin IS NOT NULL AND p.asin <> '' AND p.marketplace = ?
     ORDER BY COALESCE(s.last_sif_observed_at, '1970-01-01T00:00:00Z') ASC, p.updated_at DESC
     LIMIT ?`
  ).bind(marketplace, limit).all();
  return Array.isArray(result?.results) ? result.results : [];
}

async function syncOneAsin(db, secret, product) {
  const observedAt = nowIso();
  const session = await startSifSession(secret);
  let callId = 10;
  const results = {
    asin: product.asin,
    productId: product.product_id,
    marketplace: product.marketplace,
    profileRows: 0,
    trafficRows: 0,
    keywordRows: 0,
    adStructureRows: 0,
  };

  const profile = await callSifTool(secret, session.sessionId, callId++, 'market_get_asin_profile', {
    asins: [product.asin],
    country: product.marketplace,
  });
  await writeObservation(db, {
    toolName: 'market_get_asin_profile', dataset: 'asin_profile', subjectType: 'asin',
    subjectKey: product.asin, productId: product.product_id, marketplace: product.marketplace,
    observedAt, payload: profile,
  });
  results.profileRows = await persistProfile(db, product, profile, observedAt);

  const traffic = await callSifTool(secret, session.sessionId, callId++, 'ops_get_asin_traffic_trend', {
    asin: product.asin,
    country: product.marketplace,
    granularity: 'day',
    lastDays: 30,
    listingSearch: true,
  });
  await writeObservation(db, {
    toolName: 'ops_get_asin_traffic_trend', dataset: 'asin_traffic_trend', subjectType: 'asin',
    subjectKey: product.asin, productId: product.product_id, marketplace: product.marketplace,
    observedAt, payload: traffic,
  });
  results.trafficRows = await persistTraffic(db, product, traffic, observedAt);

  const keywords = await callSifTool(secret, session.sessionId, callId++, 'market_get_asin_keyword_signals', {
    asin: product.asin,
    country: product.marketplace,
    time_type: 'lately',
    time_value: '30',
    listingSearch: true,
    topN: 50,
  });
  await writeObservation(db, {
    toolName: 'market_get_asin_keyword_signals', dataset: 'asin_keyword_signals', subjectType: 'asin',
    subjectKey: product.asin, productId: product.product_id, marketplace: product.marketplace,
    observedAt, payload: keywords,
  });
  results.keywordRows = await persistKeywordSignals(db, product, keywords, observedAt);

  const ads = await callSifTool(secret, session.sessionId, callId++, 'ads_get_asin_ad_structure', {
    asin: product.asin,
    country: product.marketplace,
    granularity: 'week',
  });
  await writeObservation(db, {
    toolName: 'ads_get_asin_ad_structure', dataset: 'asin_ad_structure', subjectType: 'asin',
    subjectKey: product.asin, productId: product.product_id, marketplace: product.marketplace,
    observedAt, payload: ads,
  });
  results.adStructureRows = await persistAdStructure(db, product, ads, observedAt);

  return results;
}

async function updateSifSourceState(db, success, details) {
  const now = nowIso();
  await db.prepare(
    `INSERT INTO data_source_state (
      source_key, source_name, dataset, status, last_success_at, last_attempt_at,
      freshness_status, schema_version, parser_version, details_json, updated_at
    ) VALUES ('sif_mcp', 'Sif MCP', 'market_intelligence', ?, ?, ?, ?, 'SifIntelligence.v1', ?, ?, ?)
    ON CONFLICT(source_key) DO UPDATE SET
      status=excluded.status,
      last_success_at=CASE WHEN excluded.status='READY' THEN excluded.last_success_at ELSE data_source_state.last_success_at END,
      last_attempt_at=excluded.last_attempt_at,
      freshness_status=excluded.freshness_status,
      schema_version=excluded.schema_version,
      parser_version=excluded.parser_version,
      details_json=excluded.details_json,
      updated_at=excluded.updated_at`
  ).bind(
    success ? 'READY' : 'ERROR', success ? now : null, now,
    success ? 'FRESH' : 'STALE', PARSER_VERSION, JSON.stringify(details || {}), now
  ).run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (!origin || !ALLOWED_ORIGINS.has(origin)) {
        return json({ success: false, message: "Origin not allowed" }, 403, origin);
      }
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json({ success: false, message: "Origin not allowed" }, 403, origin);
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json(
        {
          ok: true,
          service: "1122-sif-bridge",
          status: "online",
          version: "1.4.0",
          mode: "MCP+D1+QUEUE",
          secretConfigured: Boolean(env.SIF_MCP_SECRET),
          dataLayerBound: Boolean(env.CORE_DB),
          research: researchCapability(env),
        },
        200,
        origin
      );
    }

    if (request.method === "GET" && url.pathname === "/connection-status") {
      try {
        const secret = String(env.SIF_MCP_SECRET || "").trim();
        if (!secret) {
          return json(
            { success: false, configured: false, message: "SIF_MCP_SECRET 尚未配置" },
            503,
            origin
          );
        }

        const result = await initializeAndListSifTools(secret);
        return json(
          {
            success: true,
            configured: true,
            message: "1122 已成功连接 Sif MCP",
            sif: {
              endpoint: SIF_MCP_URL,
              protocolVersion: result.protocolVersion,
              serverName: result.serverInfo?.name || "Sif MCP",
              serverVersion: result.serverInfo?.version || null,
              toolCount: result.toolCount,
              defaultMarketplace: "US",
            },
            dataLayer: {
              d1Bound: Boolean(env.CORE_DB),
              queueBound: Boolean(env.KEYWORD_RESEARCH_QUEUE),
              ingestionMode: "protected-predefined-queue",
            },
            research: researchCapability(env),
          },
          200,
          origin
        );
      } catch (error) {
        return json(
          { success: false, configured: true, message: "Sif MCP 连接检查失败", error: publicSifError(error) },
          502,
          origin
        );
      }
    }

    const researchResponse = await handleResearchRequest(request, env, { json, origin });
    if (researchResponse) return researchResponse;

    if (request.method === "GET" && url.pathname === "/internal/tools") {
      if (!isInternalAuthorized(request, env)) {
        return json({ success: false, message: "Unauthorized" }, 401, origin);
      }
      try {
        const secret = String(env.SIF_MCP_SECRET || "").trim();
        if (!secret) return json({ success: false, message: "SIF_MCP_SECRET 尚未配置" }, 503, origin);
        const result = await initializeAndListSifTools(secret);
        return json(
          {
            success: true,
            protocolVersion: result.protocolVersion,
            serverName: result.serverInfo?.name || "Sif MCP",
            toolCount: result.toolCount,
            tools: result.tools.map(safeToolMetadata),
          },
          200,
          origin
        );
      } catch (error) {
        return json({ success: false, message: "Sif MCP 工具发现失败", error: error.message }, 502, origin);
      }
    }

    if (request.method === "POST" && url.pathname === "/internal/sync-asins") {
      if (!isInternalAuthorized(request, env)) {
        return json({ success: false, message: "Unauthorized" }, 401, origin);
      }
      if (!env.CORE_DB) {
        return json({ success: false, message: "CORE_DB 尚未绑定" }, 503, origin);
      }

      const secret = String(env.SIF_MCP_SECRET || "").trim();
      if (!secret) return json({ success: false, message: "SIF_MCP_SECRET 尚未配置" }, 503, origin);

      const marketplace = String(url.searchParams.get('marketplace') || 'US').toUpperCase();
      const requestedLimit = Number(url.searchParams.get('limit') || 1);
      const limit = Math.min(5, Math.max(1, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 1));

      try {
        const products = await selectStalestProducts(env.CORE_DB, marketplace, limit);
        if (!products.length) {
          await updateSifSourceState(env.CORE_DB, true, { marketplace, productsSelected: 0 });
          return json({ success: true, marketplace, productsSelected: 0, results: [] }, 200, origin);
        }

        const results = [];
        for (const product of products) {
          results.push(await syncOneAsin(env.CORE_DB, secret, product));
        }

        const summary = results.reduce((acc, row) => {
          acc.profileRows += row.profileRows;
          acc.trafficRows += row.trafficRows;
          acc.keywordRows += row.keywordRows;
          acc.adStructureRows += row.adStructureRows;
          return acc;
        }, { profileRows: 0, trafficRows: 0, keywordRows: 0, adStructureRows: 0 });

        await updateSifSourceState(env.CORE_DB, true, {
          marketplace,
          productsSelected: products.length,
          ...summary,
        });

        return json({
          success: true,
          marketplace,
          productsSelected: products.length,
          summary,
          results,
          observedAt: nowIso(),
        }, 200, origin);
      } catch (error) {
        try {
          await updateSifSourceState(env.CORE_DB, false, { marketplace, error: error.message });
        } catch {}
        return json({ success: false, message: "Sif ASIN 数据入库失败", error: error.message }, 502, origin);
      }
    }

    return json({ success: false, message: "Endpoint（接口地址）不存在" }, 404, origin);
  },

  async queue(batch, env) {
    await processResearchQueue(batch, env);
  },
};
