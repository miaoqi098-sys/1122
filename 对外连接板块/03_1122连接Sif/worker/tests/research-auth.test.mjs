import test from "node:test";
import assert from "node:assert/strict";

import worker from "../worker.js";

const ALLOWED_ORIGIN = "https://1122.sorilo-uk.com";

async function body(response) {
  return response.json();
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
  assert.equal(payload.research.auth_required, true);
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

test("allowed preflight returns only the configured origin", async () => {
  const response = await worker.fetch(new Request("https://worker.example/api/v1/competitor-keyword-runs", {
    method: "OPTIONS",
    headers: { Origin: ALLOWED_ORIGIN },
  }), {});

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGIN);
  assert.match(response.headers.get("Access-Control-Allow-Headers"), /Authorization/);
});
