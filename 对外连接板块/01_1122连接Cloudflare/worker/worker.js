const ALLOWED_ORIGINS = new Set([
  "https://1122-web-agent.pages.dev",
  "https://miaoqi098-sys.github.io",
]);
const TARGET_ZONE = "sorilo-uk.com";
const TARGET_PAGES_PROJECT = "sorilo-uk";

function corsHeaders(origin = "") {
  const allowedOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://1122-web-agent.pages.dev";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=UTF-8",
    "Cache-Control": "no-store",
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

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json({ success: false, message: "Origin not allowed" }, 403, origin);
    }

    if (request.method === "GET" && url.pathname === "/cloudflare-status") {
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

        return json(
          {
            success: true,
            message: "1122 已成功连接 Cloudflare",
            connection: "connected",
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
          },
          200,
          origin
        );
      } catch (error) {
        return json(
          {
            success: false,
            message: "Cloudflare 连接检查失败",
            failedAt: step,
            error: error.message,
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
