import { connect } from "cloudflare:sockets";

const ALLOWED_ORIGIN = "https://miaoqi098-sys.github.io";
const IMAP_HOST = "imap.163.com";
const IMAP_PORT = 993;

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

function quoteImap(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function createLineReader(reader) {
  const decoder = new TextDecoder();
  let buffer = "";

  return async function readLine() {
    while (true) {
      const index = buffer.indexOf("\r\n");
      if (index >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        return line;
      }

      const { value, done } = await reader.read();
      if (done) {
        if (buffer) {
          const last = buffer;
          buffer = "";
          return last;
        }
        throw new Error("IMAP connection closed unexpectedly");
      }
      buffer += decoder.decode(value, { stream: true });
    }
  };
}

async function readTagged(readLine, tag) {
  const lines = [];
  while (true) {
    const line = await readLine();
    lines.push(line);
    if (line.startsWith(`${tag} `)) {
      if (!line.toUpperCase().startsWith(`${tag} OK`)) {
        throw new Error(`IMAP command failed: ${line}`);
      }
      return lines;
    }
  }
}

function parseStatus(lines) {
  const joined = lines.join(" ");
  const match = joined.match(/STATUS\s+INBOX\s+\(([^)]*)\)/i);
  if (!match) return { messages: null, unseen: null, uidNext: null };
  const values = match[1];
  const pick = (name) => {
    const m = values.match(new RegExp(`${name}\\s+(\\d+)`, "i"));
    return m ? Number(m[1]) : null;
  };
  return {
    messages: pick("MESSAGES"),
    unseen: pick("UNSEEN"),
    uidNext: pick("UIDNEXT"),
  };
}

async function check163Mailbox(email, authCode) {
  const socket = connect(
    { hostname: IMAP_HOST, port: IMAP_PORT },
    { secureTransport: "on" }
  );

  await socket.opened;
  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  const readLine = createLineReader(reader);
  const encoder = new TextEncoder();

  const send = async (text) => {
    await writer.write(encoder.encode(text));
  };

  try {
    const greeting = await readLine();
    if (!greeting.toUpperCase().startsWith("* OK")) {
      throw new Error(`Unexpected IMAP greeting: ${greeting}`);
    }

    await send(`a001 LOGIN ${quoteImap(email)} ${quoteImap(authCode)}\r\n`);
    await readTagged(readLine, "a001");

    await send("a002 STATUS INBOX (MESSAGES UNSEEN UIDNEXT)\r\n");
    const statusLines = await readTagged(readLine, "a002");
    const status = parseStatus(statusLines);

    await send("a003 LOGOUT\r\n");
    return status;
  } finally {
    try { writer.releaseLock(); } catch {}
    try { reader.releaseLock(); } catch {}
    try { await socket.close(); } catch {}
  }
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
      return json({
        ok: true,
        service: "1122-email-bridge",
        provider: "163 Mail",
        mode: "IMAP read-only foundation",
        version: "1.0.0",
      }, 200, origin);
    }

    if (request.method === "GET" && url.pathname === "/connection-status") {
      try {
        const email = String(env.MAILBOX_EMAIL || "").trim();
        const authCode = String(env.MAILBOX_AUTH_CODE || "").trim();

        if (!email || !authCode) {
          return json({
            success: false,
            configured: false,
            message: "邮箱 Secret 尚未配置",
          }, 503, origin);
        }

        await check163Mailbox(email, authCode);

        return json({
          success: true,
          configured: true,
          connected: true,
          provider: "163 Mail",
          protocol: "IMAP over TLS",
          mailbox: "INBOX",
          message: "1122 已成功连接邮箱后端",
          privacy: "Mailbox content is not exposed by this public status endpoint",
        }, 200, origin);
      } catch (error) {
        return json({
          success: false,
          configured: true,
          connected: false,
          message: "邮箱连接检查失败",
          error: error.message,
        }, 502, origin);
      }
    }

    return json({ success: false, message: "Endpoint（接口地址）不存在" }, 404, origin);
  },
};
