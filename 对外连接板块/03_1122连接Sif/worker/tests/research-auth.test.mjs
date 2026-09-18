import test from "node:test";
import assert from "node:assert/strict";

import worker from "../worker.js";
import { issueWebConsoleSession } from "../../../../shared/web-console-access-session.js";

const ALLOWED_ORIGIN = "https://1122.sorilo-uk.com";
const CLIENT_IP = "198.51.100.42";

async function body(response) {
  return response.json();
}

function createAccessRateLimitDb() {
  const rows = new Map();
  function prepare(sql) {
    return {
      sql,
      bind(...args) { return { sql, args }; },
    };
  }
  return {
    rows,
    prepare,
    async batch(statements) {
      const [cleanup, reserve, read] = statements;
      const cleanupBefore = Number(cleanup?.args?.[0]);
      for (const [key, row] of rows) if (Number(row.last_attempt_at) < cleanupBefore) rows.delete(key);

      const [clientKey, bucketStart, attemptedAt, maxAttempts] = reserve.args;
      const rowKey = `${clientKey}\u0000${bucketStart}`;
      const current = rows.get(rowKey);
      let changed = 0;
      if (!current) {
        rows.set(rowKey, { client_key: clientKey, bucket_start: bucketStart, attempt_count: 1, last_attempt_at: attemptedAt });
        changed = 1;
      } else if (current.attempt_count < Number(maxAttempts)) {
        current.attempt_count += 1;
        current.last_attempt_at = attemptedAt;
        changed = 1;
      }
      const currentRow = rows.get(`${read.args[0]}\u0000${read.args[1]}`);
      return [
        { success: true, meta: { changes: 0 } },
        { success: true, meta: { changes: changed } },
        { success: true, results: currentRow ? [{ attempt_count: currentRow.attempt_count }] : [] },
      ];
    },
  };
}

function accessLoginRequest(password, { origin = ALLOWED_ORIGIN, clientIp = CLIENT_IP } = {}) {
  return new Request("https://worker.example/access/session", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": clientIp },
    body: JSON.stringify({ password }),
  });
}

test("public research capability is honest when protected bindings are missing", async () => {
  const response = await worker.fetch(new Request("https://worker.example/research-status", {
    headers: { Origin: ALLOWED_ORIGIN },
  }), {});
  const payload = await body(response);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGIN);
  assert.equal(payload.success, true);
  assert.equal(payload.research.configured, false);
  assert.equal(payload.research.access_key_configured, false);
  assert.equal(payload.research.session_auth_configured, false);
  assert.equal(payload.research.auth_required, true);
});

test("a session verifier without a login issuer is not reported as browser-ready", async () => {
  const response = await worker.fetch(new Request("https://worker.example/research-status", {
    headers: { Origin: ALLOWED_ORIGIN },
  }), {
    CORE_DB: {},
    KEYWORD_RESEARCH_QUEUE: {},
    SIF_MCP_SECRET: "test-sif-secret",
    WEB_CONSOLE_SESSION_SIGNING_KEY: "test-session-signing-key",
  });
  const payload = await body(response);

  assert.equal(response.status, 200);
  assert.equal(payload.research.session_auth_configured, true);
  assert.equal(payload.research.web_console_login_configured, false);
  assert.equal(payload.research.configured, false);
  assert.equal(payload.research.manual_import_enabled, false);
});

test("one 1122 login creates a signed session that validates without exposing the password", async () => {
  const env = {
    WEB_CONSOLE_ACCESS_KEY: "test-access-password",
    WEB_CONSOLE_SESSION_SIGNING_KEY: "test-session-signing-key",
    CORE_DB: createAccessRateLimitDb(),
  };
  const login = await worker.fetch(accessLoginRequest("test-access-password"), env);
  const loginPayload = await body(login);

  assert.equal(login.status, 200);
  assert.equal(loginPayload.success, true);
  assert.equal(typeof loginPayload.session.token, "string");
  assert.ok(loginPayload.session.scope.includes("console:read"));
  assert.equal(JSON.stringify(loginPayload).includes("test-access-password"), false);

  const validation = await worker.fetch(new Request("https://worker.example/access/session", {
    headers: { Origin: ALLOWED_ORIGIN, Authorization: `Bearer ${loginPayload.session.token}` },
  }), env);
  const validationPayload = await body(validation);
  assert.equal(validation.status, 200);
  assert.equal(validationPayload.success, true);
  assert.equal(validationPayload.session.scope.includes("research:execute"), true);
});

test("the existing research operation key becomes the production login password during migration", async () => {
  const env = {
    SIF_RESEARCH_ACCESS_KEY: "existing-research-password",
    SIF_MCP_SECRET: "existing-server-only-sif-secret",
    CORE_DB: createAccessRateLimitDb(),
  };
  const login = await worker.fetch(accessLoginRequest("existing-research-password"), env);
  const payload = await body(login);

  assert.equal(login.status, 200);
  assert.equal(payload.success, true);
  assert.equal(typeof payload.session.token, "string");
  assert.equal(JSON.stringify(payload).includes("existing-research-password"), false);
});

test("access login rejects an invalid password and all legacy or unregistered browser origins", async () => {
  const env = {
    WEB_CONSOLE_ACCESS_KEY: "test-access-password",
    WEB_CONSOLE_SESSION_SIGNING_KEY: "test-session-signing-key",
    CORE_DB: createAccessRateLimitDb(),
  };
  const wrongPassword = await worker.fetch(accessLoginRequest("not-the-password"), env);
  assert.equal(wrongPassword.status, 401);
  assert.equal((await body(wrongPassword)).error.code, "ACCESS_DENIED");

  const wrongOrigin = await worker.fetch(accessLoginRequest("test-access-password", { origin: "https://attacker.example" }), env);
  assert.equal(wrongOrigin.status, 403);
  assert.equal((await body(wrongOrigin)).error.code, "ORIGIN_NOT_ALLOWED");
  assert.equal(wrongOrigin.headers.get("Access-Control-Allow-Origin"), null);

  const legacyOrigin = await worker.fetch(accessLoginRequest("test-access-password", { origin: "https://miaoqi098-sys.github.io" }), env);
  assert.equal(legacyOrigin.status, 403);
  assert.equal((await body(legacyOrigin)).error.code, "ORIGIN_NOT_ALLOWED");
  assert.equal(legacyOrigin.headers.get("Access-Control-Allow-Origin"), null);
});

test("access login fails closed when the attempt limiter is unavailable", async () => {
  const response = await worker.fetch(accessLoginRequest("test-access-password"), {
    WEB_CONSOLE_ACCESS_KEY: "test-access-password",
    WEB_CONSOLE_SESSION_SIGNING_KEY: "test-session-signing-key",
  });
  const payload = await body(response);

  assert.equal(response.status, 503);
  assert.equal(payload.error.code, "ACCESS_RATE_LIMIT_UNAVAILABLE");
  assert.equal(payload.session, undefined);
});

test("access login rate limiting is per trusted client and does not store raw IPs", async () => {
  const database = createAccessRateLimitDb();
  const env = {
    WEB_CONSOLE_ACCESS_KEY: "test-access-password",
    WEB_CONSOLE_SESSION_SIGNING_KEY: "test-session-signing-key",
    CORE_DB: database,
  };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await worker.fetch(accessLoginRequest("wrong-password"), env);
    assert.equal(response.status, 401);
  }

  const blocked = await worker.fetch(accessLoginRequest("test-access-password"), env);
  const blockedPayload = await body(blocked);
  assert.equal(blocked.status, 429);
  assert.equal(blockedPayload.error.code, "ACCESS_RATE_LIMITED");
  assert.match(blocked.headers.get("Retry-After") || "", /^[1-9]\d*$/);

  const differentClient = await worker.fetch(accessLoginRequest("test-access-password", { clientIp: "2001:db8::42" }), env);
  assert.equal(differentClient.status, 200);
  assert.ok([...database.rows.keys()].every(key => !key.includes(CLIENT_IP) && !key.includes("2001:db8::42")));
});

test("taxonomy endpoint exposes ten versioned categories without authentication", async () => {
  const response = await worker.fetch(new Request("https://worker.example/api/v1/keyword-taxonomy"), {});
  const payload = await body(response);

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.taxonomy_version, "KeywordTaxonomy.v1.0");
  assert.equal(payload.categories.length, 10);
  assert.match(payload.deduplication.near_duplicate, /never silently merged/i);
});

test("unknown browser origins fail closed for requests and preflight", async () => {
  const requestResponse = await worker.fetch(new Request("https://worker.example/research-status", {
    headers: { Origin: "https://attacker.example" },
  }), {});
  assert.equal(requestResponse.status, 403);
  assert.equal(requestResponse.headers.get("Access-Control-Allow-Origin"), null);

  const preflightResponse = await worker.fetch(new Request("https://worker.example/api/v1/competitor-keyword-runs", {
    method: "OPTIONS",
    headers: { Origin: "https://attacker.example" },
  }), {});
  assert.equal(preflightResponse.status, 403);
  assert.equal(preflightResponse.headers.get("Access-Control-Allow-Origin"), null);
});

test("protected reads never become connected or readable without the operation key", async () => {
  const noKeyResponse = await worker.fetch(new Request("https://worker.example/api/v1/competitor-keyword-runs", {
    headers: { Origin: ALLOWED_ORIGIN },
  }), {});
  const noKeyPayload = await body(noKeyResponse);
  assert.equal(noKeyResponse.status, 503);
  assert.equal(noKeyPayload.error.code, "RESEARCH_ACCESS_NOT_CONFIGURED");

  const wrongKeyResponse = await worker.fetch(new Request("https://worker.example/api/v1/competitor-keyword-runs", {
    headers: { Origin: ALLOWED_ORIGIN, Authorization: "Bearer wrong" },
  }), { SIF_RESEARCH_ACCESS_KEY: "correct" });
  const wrongKeyPayload = await body(wrongKeyResponse);
  assert.equal(wrongKeyResponse.status, 401);
  assert.equal(wrongKeyPayload.error.code, "UNAUTHORIZED");
});

test("a signed 1122 session can replace the legacy keyword operation key", async () => {
  const loginEnv = {
    WEB_CONSOLE_ACCESS_KEY: "test-access-password",
    WEB_CONSOLE_SESSION_SIGNING_KEY: "test-session-signing-key",
    CORE_DB: createAccessRateLimitDb(),
  };
  const login = await worker.fetch(accessLoginRequest("test-access-password"), loginEnv);
  const token = (await body(login)).session.token;
  const protectedRead = await worker.fetch(new Request("https://worker.example/api/v1/competitor-keyword-runs", {
    headers: { Origin: ALLOWED_ORIGIN, Authorization: `Bearer ${token}` },
  }), { WEB_CONSOLE_SESSION_SIGNING_KEY: "test-session-signing-key" });
  const payload = await body(protectedRead);

  assert.equal(protectedRead.status, 503);
  assert.equal(payload.error.code, "STORAGE_NOT_READY");
});

test("expired signed sessions retain a safe session code for browser logout", async () => {
  const env = { WEB_CONSOLE_SESSION_SIGNING_KEY: "test-session-signing-key" };
  const session = await issueWebConsoleSession(env, {
    nowMs: 0,
    ttlSeconds: 60,
    scope: ["research:execute"],
  });
  const response = await worker.fetch(new Request("https://worker.example/api/v1/competitor-keyword-runs", {
    headers: { Origin: ALLOWED_ORIGIN, Authorization: `Bearer ${session.token}` },
  }), env);
  const payload = await body(response);

  assert.equal(response.status, 401);
  assert.equal(payload.error.code, "SESSION_EXPIRED");
  assert.doesNotMatch(payload.error.message, /test-session-signing-key/);
});

test("allowed preflight returns only the configured origin", async () => {
  const response = await worker.fetch(new Request("https://worker.example/api/v1/competitor-keyword-runs", {
    method: "OPTIONS",
    headers: { Origin: ALLOWED_ORIGIN },
  }), {});

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGIN);
  assert.match(response.headers.get("Access-Control-Allow-Headers"), /Authorization/);
});
