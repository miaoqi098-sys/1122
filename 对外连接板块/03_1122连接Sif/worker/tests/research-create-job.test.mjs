import test from "node:test";
import assert from "node:assert/strict";

import worker from "../worker.js";

const ORIGIN = "https://1122.sorilo-uk.com";
const GROUP_ID = "a0b1c2d3-e4f5-4678-9abc-def012345678";
const ASIN = "B0C1234567";

function placeholderCount(sql) {
  return (String(sql).match(/\?/g) || []).length;
}

function createResearchHarness({ failGroupIndex = false, failJobBind = false, failQueuePublish = false, failFinalRead = false } = {}) {
  const calls = { batches: [], queueMessages: [], operationOrder: [] };
  const group = {
    group_id: GROUP_ID,
    marketplace: "US",
    language: "en",
    group_name: "玩具",
    normalized_name: "玩具",
    description: null,
    status: "ACTIVE",
    created_at: "2026-09-10T00:00:00.000Z",
    updated_at: "2026-09-10T00:00:00.000Z",
    archived_at: null,
  };
  let job = null;

  const db = {
    prepare(sql) {
      const statement = (params = []) => ({
        sql,
        params,
        async first() {
          if (sql.includes("FROM competitor_keyword_groups WHERE group_id=?")) return group;
          if (sql.includes("COUNT(*) AS job_count")) return { job_count: 0, asin_count: 0 };
          if (sql.includes("SELECT j.*, g.group_name")) {
            if (failFinalRead) throw new Error("forced post-publish read error");
            return job ? {
              ...job,
              group_name: group.group_name,
              group_description: group.description,
              group_status: group.status,
            } : null;
          }
          throw new Error(`Unexpected D1 first() query: ${sql.slice(0, 80)}`);
        },
        async run() {
          if (sql.includes("SET status='RUNNING'")) {
            calls.operationOrder.push("mark-running");
            job.status = "RUNNING";
          }
          if (sql.includes("SET warning_json=?")) job.warning_json = params[0];
          return { success: true, meta: { changes: 1 } };
        },
        async all() {
          return { success: true, results: [] };
        },
      });
      return {
        ...statement(),
        bind(...params) {
          if (failJobBind && sql.includes("INSERT INTO competitor_keyword_research_jobs")) {
            throw new Error("forced job ledger bind error");
          }
          return statement(params);
        },
      };
    },
    async batch(statements) {
      calls.batches.push(statements);
      for (const statement of statements) {
        if (placeholderCount(statement.sql) !== statement.params.length) {
          throw new Error("D1 parameter arity mismatch in research ledger");
        }
      }
      if (statements.some((statement) => statement.sql.includes("competitor_keyword_group_asins"))) {
        if (failGroupIndex) throw new Error("forced group index storage error");
        return statements.map(() => ({ success: true, meta: { changes: 1 } }));
      }
      const jobInsert = statements.find((statement) => statement.sql.includes("INSERT INTO competitor_keyword_research_jobs"));
      if (jobInsert) {
        const values = jobInsert.params;
        job = {
          job_id: values[0], job_name: values[1], group_id: values[2], marketplace: values[3], language: values[4],
          input_asins_json: values[5], own_brands_json: values[6], input_asin_count: values[7], period_start: values[8],
          granularity: values[9], requested_page_size: values[10], maximum_pages_per_asin: values[11], status: "QUEUED",
          source_tool: values[12], taxonomy_version: values[13], normalizer_version: values[14], warning_json: values[15],
          created_at: values[16], raw_keyword_count: 0, unique_keyword_count: 0, duplicate_keyword_count: 0,
          classification_offset: 0, successful_asin_count: 0, failed_asin_count: 0,
        };
      }
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    },
  };

  return {
    calls,
    env: {
      CORE_DB: db,
      KEYWORD_RESEARCH_QUEUE: {
        async sendBatch(messages) {
          calls.operationOrder.push("publish-queue");
          if (failQueuePublish) throw new Error("forced queue publication error");
          calls.queueMessages.push(...messages);
        },
      },
      SIF_MCP_SECRET: "server-only-test-secret",
      SIF_RESEARCH_ACCESS_KEY: "test-operation-key",
    },
  };
}

function createRequest() {
  return new Request("https://worker.example/api/v1/competitor-keyword-runs", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      Authorization: "Bearer test-operation-key",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      asins: [ASIN], marketplace: "US", group_id: GROUP_ID,
      granularity: "month", period_start: "2026-09-01",
    }),
  });
}

test("a research task persists an arity-correct D1 ledger before it enters the queue", async () => {
  const { env, calls } = createResearchHarness();
  const response = await worker.fetch(createRequest(), env);
  const payload = await response.json();

  assert.equal(response.status, 202);
  assert.equal(payload.success, true);
  assert.equal(payload.job.status, "RUNNING");
  assert.equal(calls.batches[0].length, 2, "the essential ledger contains the job and its one ASIN");
  assert.equal(calls.queueMessages.length, 1);
  assert.equal(calls.queueMessages[0].body.asin, ASIN);
  assert.deepEqual(calls.operationOrder, ["mark-running", "publish-queue"]);
});

test("a group index write failure is observable but cannot discard an already durable task", async () => {
  const { env, calls } = createResearchHarness({ failGroupIndex: true });
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const response = await worker.fetch(createRequest(), env);
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(payload.success, true);
    assert.equal(payload.job.status, "RUNNING");
    assert.deepEqual(payload.job.warnings, [{ code: "GROUP_ASIN_INDEX_DEGRADED", stage: "STORAGE" }]);
    assert.equal(calls.queueMessages.length, 1);
  } finally {
    console.error = originalConsoleError;
  }
});

test("a D1 bind-time ledger failure has a retryable storage response instead of a generic task failure", async () => {
  const { env, calls } = createResearchHarness({ failJobBind: true });
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const response = await worker.fetch(createRequest(), env);
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "STORAGE_ERROR");
    assert.equal(payload.error.stage, "STORAGE");
    assert.equal(payload.error.retryable, true);
    assert.equal(calls.queueMessages.length, 0);
  } finally {
    console.error = originalConsoleError;
  }
});

test("a queue publication failure is marked only after RUNNING was persisted and returns a queue-specific retryable error", async () => {
  const { env, calls } = createResearchHarness({ failQueuePublish: true });
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const response = await worker.fetch(createRequest(), env);
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "QUEUE_NOT_READY");
    assert.equal(payload.error.stage, "QUEUE");
    assert.equal(payload.error.retryable, true);
    assert.deepEqual(calls.operationOrder, ["mark-running", "publish-queue"]);
    assert.equal(calls.queueMessages.length, 0);
  } finally {
    console.error = originalConsoleError;
  }
});

test("a post-publication read failure returns a provisional running task instead of a false creation failure", async () => {
  const { env, calls } = createResearchHarness({ failFinalRead: true });
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const response = await worker.fetch(createRequest(), env);
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(payload.success, true);
    assert.equal(payload.job.status, "RUNNING");
    assert.equal(payload.job.input_asins[0], ASIN);
    assert.equal(calls.queueMessages.length, 1);
  } finally {
    console.error = originalConsoleError;
  }
});
