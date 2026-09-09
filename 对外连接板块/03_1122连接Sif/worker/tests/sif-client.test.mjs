import test from "node:test";
import assert from "node:assert/strict";

import { SifClientError, mcpRequest } from "../sif-client.js";

test("retryable HTTP status is honored even when the upstream body is HTML", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response("<html>temporary outage</html>", {
        status: 503,
        headers: { "content-type": "text/html" },
      });
    }
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { ok: true } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await mcpRequest({ jsonrpc: "2.0", id: 1, method: "ping" }, "test-secret", null, { retries: 1 });
    assert.equal(calls, 2);
    assert.equal(result.data.result.ok, true);
  } finally {
    global.fetch = originalFetch;
  }
});

test("non-retryable HTML errors are classified by status without leaking the body", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response("<html>bad request detail</html>", {
    status: 400,
    headers: { "content-type": "text/html" },
  });

  try {
    await assert.rejects(
      () => mcpRequest({ jsonrpc: "2.0", id: 1, method: "ping" }, "test-secret"),
      error => error instanceof SifClientError
        && error.code === "SIF_UPSTREAM_ERROR"
        && !error.message.includes("bad request detail")
    );
  } finally {
    global.fetch = originalFetch;
  }
});
