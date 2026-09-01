const ALLOWED_ORIGINS = new Set(["https://1122-web-agent.pages.dev"]);
const PRIMARY_ORIGIN = "https://1122-web-agent.pages.dev";

function cors(origin = "") {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : PRIMARY_ORIGIN,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=UTF-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data, null, 2), { status, headers: cors(origin) });
}

async function checkD1(env) {
  if (!env.CORE_DB) return { configured: false, ready: false };
  try {
    const result = await env.CORE_DB.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table'").first();
    return { configured: true, ready: Number(result?.count || 0) > 0 };
  } catch {
    return { configured: true, ready: false };
  }
}

async function checkR2(env) {
  if (!env.DATA_ARCHIVE) return { configured: false, ready: false };
  try {
    const object = await env.DATA_ARCHIVE.head("system/bootstrap/data-layer-v1.json");
    return { configured: true, ready: Boolean(object) };
  } catch {
    return { configured: true, ready: false };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ success: false, message: "Origin not allowed" }, 403, origin);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/status")) {
      const [d1, r2] = await Promise.all([checkD1(env), checkR2(env)]);
      return json({
        success: true,
        service: "1122-data-layer",
        version: "1.0.0",
        storage: {
          d1: { role: "core-operating-facts", ...d1 },
          r2: { role: "permanent-archive", ...r2 },
          kv: { role: "current-state-cache", existing: true },
        },
        policy: {
          rawArchive: "retain",
          historicalFacts: "append-oriented",
          currentCache: "rebuildable",
        },
      }, 200, origin);
    }

    return json({ success: false, message: "Endpoint not found" }, 404, origin);
  },
};
