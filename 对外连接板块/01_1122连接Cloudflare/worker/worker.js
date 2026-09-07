const DEFAULT_ALLOWED_ORIGINS = [
  "https://1122-web-agent.pages.dev",
  "https://miaoqi098-sys.github.io",
];
const TARGET_ZONE = "sorilo-uk.com";
const TARGET_PAGES_PROJECT = "sorilo-uk";

function splitList(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

// Exact origins are the safe default.  Optional suffixes support an explicitly
// configured Pages preview/custom-domain family without opening CORS to everyone.
function isAllowedOrigin(origin, env) {
  if (!origin) return true; // server-to-server checks do not send Origin
  const allowed = new Set([...DEFAULT_ALLOWED_ORIGINS, ...splitList(env.ALLOWED_ORIGINS)]);
  if (allowed.has(origin)) return true;
  try {
    const hostname = new URL(origin).hostname;
    return splitList(env.ALLOWED_ORIGIN_HOST_SUFFIXES).some((suffix) =>
      hostname === suffix || hostname.endsWith(`.${suffix}`)
    );
  } catch {
    return false;
  }
}

function corsHeaders(origin = "") {
  const headers = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=UTF-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function health({ status, checkedAt, latencyMs, details = {}, error = null }) {
  return {
    connector_id: "cloudflare",
    status,
    checked_at: checkedAt,
    latency_ms: latencyMs,
    source: "1122-cloudflare-bridge",
    capabilities: ["token_verify", "zone_read", "dns_read", "pages_read", "r2_configuration_check"],
    details,
    error,
  };
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: corsHeaders(origin),
  });
}

function getAccountIdFromR2Endpoint(endpoint) {
  if (!endpoint) return null;
  try {
    const hostname = new URL(endpoint.trim()).hostname;
    const firstPart = hostname.split(".")[0];
    return /^[a-f0-9]{32}$/i.test(firstPart) ? firstPart : null;
  } catch {
    return null;
  }
}

async function cfFetch(path, token) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`HTTP ${response.status}: Cloudflare returned non-JSON response`);
  }

  if (!response.ok || data.success !== true) {
    const error = data?.errors?.[0];
    throw new Error(
      [
        `HTTP ${response.status}`,
        error?.code ? `Code ${error.code}` : "",
        error?.message || "Cloudflare API request failed",
      ]
        .filter(Boolean)
        .join(" · ")
    );
  }
  return data;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (origin && !isAllowedOrigin(origin, env)) {
      return new Response(JSON.stringify({ success: false, message: "Origin not allowed" }), {
        status: 403,
        headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store", "Vary": "Origin" },
      });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return json(
        {
          ok: true,
          service: "1122-cloudflare-bridge",
          status: "online",
          version: "2.1.0",
          secrets: {
            apiTokenConfigured: Boolean(env.CLOUDFLARE_API_TOKEN),
            r2AccessKeyConfigured: Boolean(env.CLOUDFLARE_R2_ACCESS_KEY_ID),
            r2SecretKeyConfigured: Boolean(env.CLOUDFLARE_R2_SECRET_ACCESS_KEY),
            r2EndpointConfigured: Boolean(env.CLOUDFLARE_R2_S3_ENDPOINT),
            accountIdDetected: Boolean(
              getAccountIdFromR2Endpoint(env.CLOUDFLARE_R2_S3_ENDPOINT)
            ),
          },
        },
        200,
        origin
      );
    }

    if (request.method === "GET" && url.pathname === "/cloudflare-status") {
      const startedAt = Date.now();
      const checkedAt = new Date().toISOString();
      let step = "初始化";
      try {
        const token = env.CLOUDFLARE_API_TOKEN?.trim();
        if (!token) throw new Error("没有读取到 CLOUDFLARE_API_TOKEN");

        const accountId = getAccountIdFromR2Endpoint(
          env.CLOUDFLARE_R2_S3_ENDPOINT
        );
        if (!accountId) throw new Error("无法从 S3 API Endpoint 识别 Account ID");

        step = "Account API Token 验证";
        const verify = await cfFetch(
          `/accounts/${accountId}/tokens/verify`,
          token
        );

        step = "读取 Zone（域名区域）";
        const zones = await cfFetch(
          `/zones?name=${encodeURIComponent(TARGET_ZONE)}`,
          token
        );
        if (!zones.result?.length) throw new Error(`没有找到 ${TARGET_ZONE}`);

        const zone = zones.result[0];
        const zoneId = zone.id;

        step = "读取 DNS";
        const dns = await cfFetch(
          `/zones/${zoneId}/dns_records?per_page=100`,
          token
        );

        step = "读取 Pages";
        const pages = await cfFetch(
          `/accounts/${accountId}/pages/projects`,
          token
        );
        const project =
          pages.result?.find((p) => p.name === TARGET_PAGES_PROJECT) || null;

        const details = {
          bridge: "online",
          token: { status: verify.result?.status || "active" },
          zone: {
            name: zone.name,
            status: zone.status,
            paused: zone.paused,
          },
          dns: { recordCount: dns.result?.length || 0 },
          pages: {
            projectFound: Boolean(project),
            projectName: project?.name || null,
            subdomain: project?.subdomain || null,
            productionBranch: project?.production_branch || null,
          },
          r2: {
            credentialsConfigured:
              Boolean(env.CLOUDFLARE_R2_ACCESS_KEY_ID) &&
              Boolean(env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) &&
              Boolean(env.CLOUDFLARE_R2_S3_ENDPOINT),
          },
        };
        const status = details.pages.projectFound && details.zone.status === "active" ? "LIVE" : "DEGRADED";
        return json({
            ...health({ status, checkedAt, latencyMs: Date.now() - startedAt, details }),
            success: true,
            message: "1122 已成功连接 Cloudflare",
            connection: status === "LIVE" ? "connected" : "degraded",
            // Compatibility fields for existing consumers; new consumers use details.
            ...details,
          },
          200,
          origin
        );
      } catch (error) {
        return json(
          {
            ...health({ status: "ERROR", checkedAt, latencyMs: Date.now() - startedAt, details: { bridge: "online" }, error: { stage: step, message: error.message } }),
            success: false,
            message: "Cloudflare 连接检查失败",
            failedAt: step,
            error_message: error.message,
          },
          500,
          origin
        );
      }
    }

    return json(
      { success: false, message: "Endpoint（接口地址）不存在" },
      404,
      origin
    );
  },
};
