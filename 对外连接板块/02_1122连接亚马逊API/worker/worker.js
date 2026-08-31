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

function validateCredentialShape(clientId, clientSecret, refreshToken, region) {
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("LWA Client ID、Client Secret、Refresh Token 必须全部填写");
  }
  if (!clientId.startsWith("amzn1.application-oa2-client.")) {
    throw new Error("LWA Client ID 格式不正确");
  }
  if (!REGION_ENDPOINTS[region]) {
    throw new Error("SP-API Region 不受支持");
  }
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
      "user-agent": "1122AmazonBridge/1.0 (Language=JavaScript; Platform=CloudflareWorkers)",
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

export default {
  async fetch(request) {
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
        version: "1.0.0",
        persistence: "none",
      }, 200, origin);
    }

    if (origin && origin !== ALLOWED_ORIGIN) {
      return json({ success: false, message: "Origin not allowed" }, 403, origin);
    }

    if (request.method === "POST" && url.pathname === "/test-connection") {
      try {
        const body = await request.json();
        const clientId = String(body.clientId || "").trim();
        const clientSecret = String(body.clientSecret || "").trim();
        const refreshToken = String(body.refreshToken || "").trim();
        const region = String(body.region || "na").trim();

        validateCredentialShape(clientId, clientSecret, refreshToken, region);

        const lwa = await exchangeAccessToken(clientId, clientSecret, refreshToken);
        const endpoint = REGION_ENDPOINTS[region];
        const participations = await getMarketplaceParticipations(endpoint, lwa.accessToken);

        const marketplaces = participations.map((entry) => ({
          id: entry?.marketplace?.id || null,
          name: entry?.marketplace?.name || null,
          countryCode: entry?.marketplace?.countryCode || null,
          domainName: entry?.marketplace?.domainName || null,
          defaultCurrencyCode: entry?.marketplace?.defaultCurrencyCode || null,
          isParticipating: entry?.participation?.isParticipating ?? null,
          hasSuspendedListings: entry?.participation?.hasSuspendedListings ?? null,
        }));

        return json({
          success: true,
          message: "1122 已成功连接 Amazon SP-API",
          authentication: {
            lwaAccessTokenIssued: true,
            expiresIn: lwa.expiresIn,
            tokenType: lwa.tokenType,
          },
          spApi: {
            region,
            endpoint,
            testOperation: "getMarketplaceParticipations",
            marketplaceCount: marketplaces.length,
            marketplaces,
          },
          credentialsPersisted: false,
        }, 200, origin);
      } catch (error) {
        return json({
          success: false,
          message: "Amazon SP-API 连接测试失败",
          error: error.message,
        }, 400, origin);
      }
    }

    return json({ success: false, message: "Endpoint（接口地址）不存在" }, 404, origin);
  },
};
