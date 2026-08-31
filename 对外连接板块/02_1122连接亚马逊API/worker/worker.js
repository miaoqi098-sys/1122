const ALLOWED_ORIGIN = "https://miaoqi098-sys.github.io";
const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const REGION_ENDPOINTS = {
  na: "https://sellingpartnerapi-na.amazon.com",
  eu: "https://sellingpartnerapi-eu.amazon.com",
  fe: "https://sellingpartnerapi-fe.amazon.com",
};

function cors(origin = "") {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=UTF-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: cors(origin),
  });
}

function getServerCredentials(env) {
  const clientId = String(env.AMAZON_LWA_CLIENT_ID || "").trim();
  const clientSecret = String(env.AMAZON_LWA_CLIENT_SECRET || "").trim();
  const refreshToken = String(env.AMAZON_LWA_REFRESH_TOKEN || "").trim();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Worker Secret 未完整配置 Amazon LWA 三项凭据");
  }
  if (!clientId.startsWith("amzn1.application-oa2-client.")) {
    throw new Error("Worker Secret 中的 LWA Client ID 格式不正确");
  }

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
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "Accept": "application/json",
    },
    body,
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    throw new Error(`Amazon LWA 返回非 JSON 响应（HTTP ${response.status}）`);
  }

  if (!response.ok || !data.access_token) {
    const detail = data.error_description || data.error || `HTTP ${response.status}`;
    throw new Error(`LWA 认证失败：${detail}`);
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600,
    tokenType: data.token_type || "bearer",
  };
}

async function getMarketplaceParticipations(endpoint, accessToken) {
  const response = await fetch(`${endpoint}/sellers/v1/marketplaceParticipations`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "x-amz-access-token": accessToken,
      "x-amz-date": new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""),
      "user-agent": "1122AmazonBridge/2.0 (Language=JavaScript; Platform=CloudflareWorkers)",
    },
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    throw new Error(`SP-API 返回非 JSON 响应（HTTP ${response.status}）`);
  }

  if (!response.ok) {
    const message = data?.errors?.[0]?.message || data?.message || `HTTP ${response.status}`;
    const code = data?.errors?.[0]?.code || "SP_API_ERROR";
    throw new Error(`SP-API 调用失败：${code} · ${message}`);
  }

  return Array.isArray(data.payload) ? data.payload : [];
}

async function buildConnectionStatus(env) {
  const { clientId, clientSecret, refreshToken } = getServerCredentials(env);
  const region = "na";
  const endpoint = REGION_ENDPOINTS[region];
  const lwa = await exchangeAccessToken(clientId, clientSecret, refreshToken);
  const participations = await getMarketplaceParticipations(endpoint, lwa.accessToken);

  const marketplaces = participations.map((entry) => ({
    countryCode: entry?.marketplace?.countryCode || null,
    domainName: entry?.marketplace?.domainName || null,
    isParticipating: entry?.participation?.isParticipating ?? null,
  }));

  return {
    success: true,
    message: "1122 已成功连接 Amazon SP-API",
    connection: "connected",
    authentication: {
      lwaAccessTokenIssued: true,
      expiresIn: lwa.expiresIn,
    },
    spApi: {
      region,
      testOperation: "getMarketplaceParticipations",
      marketplaceCount: marketplaces.length,
      marketplaces,
    },
    credentialMode: "worker-secrets",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        ok: true,
        service: "1122-amazon-sp-api-bridge",
        status: "online",
        version: "2.0.0",
        credentialMode: "worker-secrets",
      }, 200, origin);
    }

    if (origin && origin !== ALLOWED_ORIGIN) {
      return json({ success: false, message: "Origin not allowed" }, 403, origin);
    }

    if (request.method === "GET" && url.pathname === "/connection-status") {
      try {
        const status = await buildConnectionStatus(env);
        return json(status, 200, origin);
      } catch (error) {
        return json({
          success: false,
          message: "Amazon SP-API 后端连接检查失败",
          error: error.message,
          credentialMode: "worker-secrets",
        }, 400, origin);
      }
    }

    if (request.method === "POST" && url.pathname === "/test-connection") {
      return json({
        success: false,
        message: "已切换为 Worker Secret（后端密钥）模式。请刷新 1122，使用连接状态检查。",
      }, 410, origin);
    }

    return json({ success: false, message: "Endpoint（接口地址）不存在" }, 404, origin);
  },
};
