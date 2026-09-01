const ALLOWED_ORIGIN = "https://miaoqi098-sys.github.io";
const SIF_MCP_URL = "https://mcp.sif.com/mcp";
const MCP_PROTOCOL_VERSION = "2024-11-05";

function cors(origin = "") {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
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

function parseMcpBody(text, contentType = "") {
  if (!text) return null;

  if (contentType.includes("text/event-stream") || text.includes("\ndata:")) {
    const events = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);

    for (let i = events.length - 1; i >= 0; i -= 1) {
      try {
        return JSON.parse(events[i]);
      } catch {}
    }
    throw new Error("Sif MCP 返回了无法解析的 SSE 数据");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Sif MCP 返回了非 JSON 数据");
  }
}

async function mcpRequest(payload, secret, sessionId = null) {
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
    "secret-key": secret,
    "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
    "User-Agent": "1122SifBridge/1.0",
  };

  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const response = await fetch(SIF_MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const responseSessionId = response.headers.get("Mcp-Session-Id") || sessionId;
  const text = await response.text();
  let data = null;

  if (text) data = parseMcpBody(text, response.headers.get("content-type") || "");

  if (!response.ok) {
    const detail = data?.error?.message || data?.message || `HTTP ${response.status}`;
    throw new Error(`Sif MCP 请求失败：${detail}`);
  }

  if (data?.error) {
    throw new Error(`Sif MCP 错误：${data.error.message || "Unknown MCP error"}`);
  }

  return { data, sessionId: responseSessionId };
}

async function startSession(secret) {
  const init = await mcpRequest(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: {
          name: "1122-sif-bridge",
          version: "1.0.0",
        },
      },
    },
    secret
  );

  try {
    await mcpRequest(
      {
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      },
      secret,
      init.sessionId
    );
  } catch {}

  return {
    sessionId: init.sessionId,
    protocolVersion: init.data?.result?.protocolVersion || MCP_PROTOCOL_VERSION,
    serverInfo: init.data?.result?.serverInfo || null,
  };
}

async function listTools(secret) {
  const session = await startSession(secret);
  const tools = await mcpRequest(
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    },
    secret,
    session.sessionId
  );

  return {
    ...session,
    tools: Array.isArray(tools.data?.result?.tools) ? tools.data.result.tools : [],
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (origin && origin !== ALLOWED_ORIGIN) {
      return json({ success: false, message: "Origin not allowed" }, 403, origin);
    }

    if (request.method === "GET" && url.pathname === "/") {
      return json(
        {
          ok: true,
          service: "1122-sif-bridge",
          status: "online",
          version: "1.0.1",
          mode: "MCP",
          secretConfigured: Boolean(env.SIF_MCP_SECRET),
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
            {
              success: false,
              configured: false,
              message: "SIF_MCP_SECRET 尚未配置",
            },
            503,
            origin
          );
        }

        const result = await listTools(secret);

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
              toolCount: result.tools.length,
              defaultMarketplace: "US",
            },
          },
          200,
          origin
        );
      } catch (error) {
        return json(
          {
            success: false,
            configured: true,
            message: "Sif MCP 连接检查失败",
            error: error.message,
          },
          502,
          origin
        );
      }
    }

    if (request.method === "GET" && url.pathname === "/diagnostics/tools") {
      try {
        const secret = String(env.SIF_MCP_SECRET || "").trim();
        if (!secret) return json({ success: false, message: "SIF_MCP_SECRET 尚未配置" }, 503, origin);

        const result = await listTools(secret);
        return json(
          {
            success: true,
            protocolVersion: result.protocolVersion,
            toolCount: result.tools.length,
            tools: result.tools.map((tool) => ({
              name: tool.name,
              description: tool.description || "",
              inputSchema: tool.inputSchema || null,
            })),
          },
          200,
          origin
        );
      } catch (error) {
        return json({ success: false, message: "读取 Sif MCP 工具失败", error: error.message }, 502, origin);
      }
    }

    return json({ success: false, message: "Endpoint（接口地址）不存在" }, 404, origin);
  },
};
