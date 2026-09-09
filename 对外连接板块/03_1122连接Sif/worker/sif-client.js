export const SIF_MCP_URL = "https://mcp.sif.com/mcp";
export const MCP_PROTOCOL_VERSION = "2024-11-05";
export const PARSER_VERSION = "sif-v1.2";

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

export class SifClientError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "SifClientError";
    this.code = code;
    this.stage = options.stage || "SIF_CALL";
    this.retryable = Boolean(options.retryable);
    this.httpStatus = options.httpStatus || 502;
  }
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
    throw new SifClientError("SIF_INVALID_RESPONSE", "Sif MCP returned invalid SSE data", { stage: "SIF_PARSE" });
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new SifClientError("SIF_INVALID_RESPONSE", "Sif MCP returned non-JSON data", { stage: "SIF_PARSE" });
  }
}

async function readTextWithLimit(response, limit = MAX_RESPONSE_BYTES) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > limit) {
    throw new SifClientError("SIF_RESPONSE_TOO_LARGE", "Sif MCP response exceeded the configured limit", { stage: "SIF_PARSE" });
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new SifClientError("SIF_RESPONSE_TOO_LARGE", "Sif MCP response exceeded the configured limit", { stage: "SIF_PARSE" });
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function retryDelay(attempt) {
  return new Promise((resolve) => setTimeout(resolve, Math.min(1_000, 250 * (2 ** attempt))));
}

export async function mcpRequest(payload, secret, sessionId = null, options = {}) {
  const timeoutMs = Math.max(1_000, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS);
  const retries = Math.min(1, Math.max(0, Number(options.retries) || 0));
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
    "secret-key": secret,
    "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
    "User-Agent": "1122SifBridge/1.4",
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(SIF_MCP_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const responseSessionId = response.headers.get("Mcp-Session-Id") || sessionId;
      const text = await readTextWithLimit(response);
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < retries) {
          await retryDelay(attempt);
          continue;
        }
        let data = null;
        try {
          data = text ? parseMcpBody(text, response.headers.get("content-type") || "") : null;
        } catch {
          // HTTP status determines retryability even when an upstream error page is not JSON.
        }
        const detail = data?.error?.message || data?.message || `HTTP ${response.status}`;
        throw new SifClientError(
          response.status === 429 ? "SIF_RATE_LIMITED" : "SIF_UPSTREAM_ERROR",
          `Sif MCP request failed: ${detail}`,
          { stage: "SIF_CALL", retryable, httpStatus: response.status === 429 ? 429 : 502 }
        );
      }
      const data = text ? parseMcpBody(text, response.headers.get("content-type") || "") : null;
      if (data?.error) {
        throw new SifClientError("SIF_MCP_ERROR", data.error.message || "Unknown MCP error", { stage: "SIF_CALL" });
      }
      return { data, sessionId: responseSessionId };
    } catch (error) {
      if (error?.name === "AbortError") {
        const timeoutError = new SifClientError("SIF_TIMEOUT", "Sif MCP request timed out", {
          stage: "SIF_CALL", retryable: true, httpStatus: 504,
        });
        if (attempt < retries) {
          await retryDelay(attempt);
          continue;
        }
        throw timeoutError;
      }
      if (error instanceof SifClientError) throw error;
      if (attempt < retries) {
        await retryDelay(attempt);
        continue;
      }
      throw new SifClientError("SIF_NETWORK_ERROR", "Sif MCP network request failed", {
        stage: "SIF_CALL", retryable: true, httpStatus: 502,
      });
    } finally {
      clearTimeout(timer);
    }
  }
  throw new SifClientError("SIF_UPSTREAM_ERROR", "Sif MCP request failed", { stage: "SIF_CALL" });
}

export async function startSifSession(secret) {
  const init = await mcpRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "1122-sif-bridge", version: "1.4.0" },
    },
  }, secret, null, { retries: 1 });

  try {
    await mcpRequest({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    }, secret, init.sessionId);
  } catch {
    // Streamable HTTP notifications can legitimately return an empty body.
  }

  return {
    sessionId: init.sessionId,
    protocolVersion: init.data?.result?.protocolVersion || MCP_PROTOCOL_VERSION,
    serverInfo: init.data?.result?.serverInfo || null,
  };
}
export async function initializeAndListSifTools(secret) {
  const session = await startSifSession(secret);
  const toolsResult = await mcpRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  }, secret, session.sessionId, { retries: 1 });
  const tools = Array.isArray(toolsResult.data?.result?.tools) ? toolsResult.data.result.tools : [];
  return { ...session, tools, toolCount: tools.length };
}

function parsePotentialJson(text) {
  const value = String(text || "").trim();
  if (!value) return null;
  const stripped = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

function extractToolPayload(data) {
  const result = data?.result;
  if (!result) return null;
  if (result.structuredContent && typeof result.structuredContent === "object") return result.structuredContent;
  if (Array.isArray(result.content)) {
    for (const item of result.content) {
      if (item?.type !== "text") continue;
      const parsed = parsePotentialJson(item.text);
      if (parsed && typeof parsed === "object") return parsed;
    }
  }
  return result;
}

export async function callSifTool(secret, sessionId, id, name, args) {
  const response = await mcpRequest({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  }, secret, sessionId);
  if (response.data?.result?.isError) {
    const payload = extractToolPayload(response.data);
    const detail = payload?.message || payload?.error || "Sif tool returned an error";
    throw new SifClientError("SIF_TOOL_ERROR", String(detail), { stage: "SIF_CALL" });
  }
  return extractToolPayload(response.data);
}

export function publicSifError(error) {
  const code = error instanceof SifClientError ? error.code : "SIF_REQUEST_FAILED";
  const messages = {
    SIF_TIMEOUT: "SIF 查询超时，系统会按有限次数重试。",
    SIF_RATE_LIMITED: "SIF 当前限流，系统会稍后重试。",
    SIF_RESPONSE_TOO_LARGE: "SIF 返回内容超过安全上限。",
    SIF_INVALID_RESPONSE: "SIF 返回结构不符合接口契约。",
    SIF_NETWORK_ERROR: "暂时无法连接 SIF。",
    SIF_TOOL_ERROR: "SIF 未能完成本次关键词查询。",
    SIF_MCP_ERROR: "SIF MCP 返回错误。",
    SIF_UPSTREAM_ERROR: "SIF 上游服务暂时不可用。",
  };
  return {
    code,
    stage: error?.stage || "SIF_CALL",
    message: messages[code] || "SIF 查询失败。",
    retryable: Boolean(error?.retryable),
  };
}
