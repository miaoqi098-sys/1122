import { callSifTool, PARSER_VERSION, publicSifError, SifClientError, startSifSession } from "./sif-client.js";
import {
  KEYWORD_CATEGORIES,
  NORMALIZER_VERSION,
  TAXONOMY_VERSION,
  classifyKeyword,
  deriveCoreTokens,
  keywordId,
  normalizeKeyword,
  tokenSignature,
} from "./taxonomy.js";

const SOURCE_TOOL = "ops_get_asin_traffic_trend_detail";
const PROFILE_TOOL = "market_get_asin_profile";
const API_PREFIX = "/api/v1";
const MAX_ASINS = 10;
const PAGE_SIZE = 200;
const MAX_PAGES_PER_ASIN = 20;
const MAX_BODY_CHARS = 12_000;
const MAX_JOBS_PER_HOUR = 20;
const MAX_ASINS_PER_HOUR = 100;
const CLASSIFICATION_PAGE_SIZE = 200;
const TERMINAL_JOB_STATES = new Set(["SUCCEEDED", "PARTIAL", "FAILED"]);
const SUPPORTED_MARKETPLACES = Object.freeze({ US: { language: "en", timezone: "America/Los_Angeles" } });

class ResearchError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "ResearchError";
    this.code = code;
    this.stage = options.stage || "RESEARCH";
    this.retryable = Boolean(options.retryable);
    this.httpStatus = options.httpStatus || 500;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toInteger(value) {
  const number = toNumber(value);
  return number === null ? null : Math.round(number);
}

function bestPositive(...values) {
  const numbers = values.map(toNumber).filter((value) => value !== null && value > 0);
  return numbers.length ? Math.min(...numbers) : null;
}

function highest(...values) {
  const numbers = values.map(toNumber).filter((value) => value !== null);
  return numbers.length ? Math.max(...numbers) : null;
}

function safeText(value, maxLength = 240) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function publicResearchError(error) {
  if (error instanceof SifClientError) return publicSifError(error);
  const code = error instanceof ResearchError ? error.code : "RESEARCH_FAILED";
  const messages = {
    INVALID_INPUT: "请检查 ASIN、市场和分析周期。",
    INVALID_JSON: "请求内容不是有效的 JSON。",
    BODY_TOO_LARGE: "输入内容超过安全上限。",
    STORAGE_NOT_READY: "竞品关键词存储尚未就绪。",
    QUEUE_NOT_READY: "竞品关键词任务队列尚未就绪。",
    SIF_NOT_CONFIGURED: "SIF 连接密钥尚未配置。",
    RESEARCH_ACCESS_NOT_CONFIGURED: "竞品关键词操作密钥尚未配置。",
    UNAUTHORIZED: "操作密钥无效或尚未输入。",
    RESEARCH_RATE_LIMITED: "最近创建的任务较多，请稍后再试。",
    GROUP_NAME_REQUIRED: "请选择已有产品分组，或填写一个新的分组名称。",
    GROUP_NOT_FOUND: "所选产品分组不存在，或不属于当前市场。",
    GROUP_ARCHIVED: "所选产品分组已归档，不能再创建新任务。",
    GROUP_INVALID: "产品分组信息不符合要求。",
    FETCH_PAGE_BUSY: "同一个 ASIN 的该页正在处理，系统会稍后继续。",
    FETCH_PREDECESSOR_PENDING: "前一页尚未完成，系统会稍后继续。",
    JOB_NOT_FOUND: "未找到这次竞品关键词任务。",
    SIF_SCHEMA_INVALID: "SIF 返回的关键词结构不符合契约。",
    STORAGE_ERROR: "保存竞品关键词时发生暂时性错误。",
    CLASSIFICATION_ERROR: "关键词分类未能完成。",
    RESEARCH_FAILED: "竞品关键词任务未能完成。",
  };
  return {
    code,
    stage: error?.stage || "RESEARCH",
    message: messages[code] || messages.RESEARCH_FAILED,
    retryable: Boolean(error?.retryable),
  };
}

// D1 error text can contain SQL implementation detail. Keep the public
// response stable and keep diagnostics deliberately metadata-only: neither
// the operation key nor submitted ASIN values are written to Worker logs.
function storageFailure(operation, error, context = {}) {
  if (error instanceof ResearchError) return error;
  console.error(JSON.stringify({
    event: "competitor_keyword_storage_failure",
    operation,
    stage: "STORAGE",
    job_id: context.jobId || null,
    group_id: context.groupId || null,
    statement_count: Number(context.statementCount || 0) || null,
    error_name: safeText(error?.name || "Error", 80),
  }));
  return new ResearchError("STORAGE_ERROR", "Competitor keyword storage operation failed", {
    stage: "STORAGE", retryable: true, httpStatus: 503,
  });
}

function errorResponse(error, json, origin) {
  const detail = publicResearchError(error);
  const status = error?.httpStatus || (detail.code === "UNAUTHORIZED" ? 401 : 500);
  return json({ success: false, error: detail }, status, origin);
}

async function bearerMatches(request, expected) {
  const header = String(request.headers.get("Authorization") || "");
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!presented || !expected) return false;
  const left = new TextEncoder().encode(presented);
  const right = new TextEncoder().encode(expected);
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) mismatch |= (left[i] || 0) ^ (right[i] || 0);
  return mismatch === 0;
}

async function requireResearchAccess(request, env) {
  const expected = String(env.SIF_RESEARCH_ACCESS_KEY || "").trim();
  if (!expected) {
    throw new ResearchError("RESEARCH_ACCESS_NOT_CONFIGURED", "Research access key is not configured", {
      stage: "AUTH", httpStatus: 503,
    });
  }
  if (!(await bearerMatches(request, expected))) {
    throw new ResearchError("UNAUTHORIZED", "Unauthorized", { stage: "AUTH", httpStatus: 401 });
  }
}

function formatDateInTimezone(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function defaultPeriodStart(marketplace, granularity = "month") {
  const timezone = SUPPORTED_MARKETPLACES[marketplace]?.timezone || "UTC";
  const anchor = new Date(Date.now() - 36 * 60 * 60 * 1000);
  const day = formatDateInTimezone(anchor, timezone);
  const parsed = new Date(`${day}T12:00:00Z`);
  if (granularity === "day") return day;
  if (granularity === "week") {
    parsed.setUTCDate(parsed.getUTCDate() - parsed.getUTCDay());
    return parsed.toISOString().slice(0, 10);
  }
  return `${day.slice(0, 8)}01`;
}

function normalizeAsins(value) {
  const parts = Array.isArray(value)
    ? value
    : String(value || "").split(/[\s,;，；]+/);
  const seen = new Set();
  const valid = [];
  const invalid = [];
  const duplicates = [];
  for (const raw of parts) {
    const asin = String(raw || "").trim().toUpperCase();
    if (!asin) continue;
    if (!/^[A-Z0-9]{10}$/.test(asin)) {
      invalid.push(asin.slice(0, 32));
      continue;
    }
    if (seen.has(asin)) {
      duplicates.push(asin);
      continue;
    }
    seen.add(asin);
    valid.push(asin);
  }
  return { valid, invalid, duplicates };
}

function normalizeBrands(value) {
  const parts = Array.isArray(value) ? value : String(value || "").split(/[,;，；\n]+/);
  return [...new Set(parts.map((item) => safeText(item, 80)).filter(Boolean))].slice(0, 10);
}

function normalizeGroupName(value) {
  return safeText(value, 80).normalize("NFKC").toLocaleLowerCase("en-US");
}

function validGroupId(value) {
  return /^[0-9a-f-]{36}$/i.test(String(value || ""));
}

// Kept deliberately narrow so the request contract can be unit-tested without
// exposing any storage or queue implementation detail to callers.
export const researchInputTestApi = Object.freeze({
  normalizeGroupName,
  validGroupId,
  validateCreatePayload,
});

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

async function readJsonBody(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY_CHARS) {
    throw new ResearchError("BODY_TOO_LARGE", "Request body is too large", { stage: "VALIDATION", httpStatus: 413 });
  }
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) {
    throw new ResearchError("BODY_TOO_LARGE", "Request body is too large", { stage: "VALIDATION", httpStatus: 413 });
  }
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw new ResearchError("INVALID_JSON", "Invalid JSON", { stage: "VALIDATION", httpStatus: 400 });
  }
}

function validateCreatePayload(body) {
  const marketplace = safeText(body.marketplace || "US", 8).toUpperCase();
  if (!SUPPORTED_MARKETPLACES[marketplace]) {
    throw new ResearchError("INVALID_INPUT", "Only the US marketplace is supported in this version", {
      stage: "VALIDATION", httpStatus: 400,
    });
  }
  const parsed = normalizeAsins(body.asins);
  if (parsed.invalid.length || parsed.valid.length < 1 || parsed.valid.length > MAX_ASINS) {
    const error = new ResearchError("INVALID_INPUT", "ASIN validation failed", { stage: "VALIDATION", httpStatus: 400 });
    error.validation = { invalid: parsed.invalid, duplicates: parsed.duplicates, validCount: parsed.valid.length, maxAsins: MAX_ASINS };
    throw error;
  }
  const requestedGranularity = body.granularity === undefined ? "month" : safeText(body.granularity, 12);
  if (!["day", "week", "month"].includes(requestedGranularity)) {
    throw new ResearchError("INVALID_INPUT", "Unsupported granularity", { stage: "VALIDATION", httpStatus: 400 });
  }
  const granularity = requestedGranularity;
  const periodStart = safeText(body.period_start || defaultPeriodStart(marketplace, granularity), 10);
  if (!validDate(periodStart)) {
    throw new ResearchError("INVALID_INPUT", "Invalid period_start", { stage: "VALIDATION", httpStatus: 400 });
  }
  const groupId = safeText(body.group_id, 36);
  const groupName = safeText(body.group_name, 80);
  const groupDescription = safeText(body.group_description, 300) || null;
  if (groupId && !validGroupId(groupId)) {
    throw new ResearchError("GROUP_INVALID", "group_id is invalid", { stage: "VALIDATION", httpStatus: 400 });
  }
  if (groupId && groupName) {
    throw new ResearchError("GROUP_INVALID", "Choose an existing group or provide a new group name, not both", { stage: "VALIDATION", httpStatus: 400 });
  }
  if (!groupId && !groupName) {
    throw new ResearchError("GROUP_NAME_REQUIRED", "A product group is required", { stage: "VALIDATION", httpStatus: 400 });
  }
  if (groupName && !normalizeGroupName(groupName)) {
    throw new ResearchError("GROUP_NAME_REQUIRED", "A product group name is required", { stage: "VALIDATION", httpStatus: 400 });
  }
  return {
    marketplace,
    language: SUPPORTED_MARKETPLACES[marketplace].language,
    asins: parsed.valid,
    duplicateInputs: parsed.duplicates,
    ownBrands: normalizeBrands(body.own_brands),
    jobName: safeText(body.job_name, 80) || null,
    groupId: groupId || null,
    groupName: groupName || null,
    groupDescription,
    granularity,
    periodStart,
  };
}

async function assertRateLimit(db, requestedAsins) {
  const result = await db.prepare(
    `SELECT COUNT(*) AS job_count, COALESCE(SUM(input_asin_count), 0) AS asin_count
     FROM competitor_keyword_research_jobs
     WHERE datetime(created_at) >= datetime('now', '-1 hour')`
  ).first();
  const jobs = Number(result?.job_count || 0);
  const asins = Number(result?.asin_count || 0);
  if (jobs >= MAX_JOBS_PER_HOUR || asins + requestedAsins > MAX_ASINS_PER_HOUR) {
    throw new ResearchError("RESEARCH_RATE_LIMITED", "Hourly research limit reached", {
      stage: "RATE_LIMIT", httpStatus: 429,
    });
  }
}

function serializeGroup(row) {
  if (!row) return null;
  return {
    group_id: row.group_id,
    group_name: row.group_name,
    description: row.description || null,
    marketplace: row.marketplace,
    language: row.language,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at || null,
    job_count: row.job_count === undefined ? undefined : Number(row.job_count || 0),
    keyword_count: row.keyword_count === undefined ? undefined : Number(row.keyword_count || 0),
    asin_count: row.asin_count === undefined ? undefined : Number(row.asin_count || 0),
  };
}

async function resolveGroup(db, input) {
  if (input.groupId) {
    const row = await db.prepare(
      `SELECT * FROM competitor_keyword_groups WHERE group_id=?`
    ).bind(input.groupId).first();
    if (!row || row.marketplace !== input.marketplace || row.language !== input.language) {
      throw new ResearchError("GROUP_NOT_FOUND", "Requested group is missing", { stage: "GROUP", httpStatus: 404 });
    }
    if (row.status !== "ACTIVE") {
      throw new ResearchError("GROUP_ARCHIVED", "Requested group is not active", { stage: "GROUP", httpStatus: 409 });
    }
    return row;
  }

  const normalized = normalizeGroupName(input.groupName);
  const existing = await db.prepare(
    `SELECT * FROM competitor_keyword_groups
     WHERE marketplace=? AND language=? AND normalized_name=?`
  ).bind(input.marketplace, input.language, normalized).first();
  if (existing) {
    if (existing.status !== "ACTIVE") {
      throw new ResearchError("GROUP_ARCHIVED", "A group with this name is archived", { stage: "GROUP", httpStatus: 409 });
    }
    return existing;
  }

  const timestamp = nowIso();
  const groupId = crypto.randomUUID();
  try {
    await db.prepare(
      `INSERT INTO competitor_keyword_groups (
        group_id, marketplace, language, group_name, normalized_name, description,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`
    ).bind(
      groupId, input.marketplace, input.language, input.groupName, normalized,
      input.groupDescription, timestamp, timestamp
    ).run();
  } catch (error) {
    // A concurrent request can create the same normalized name. Re-read it and
    // never manufacture a second business context for the same product line.
    const concurrent = await db.prepare(
      `SELECT * FROM competitor_keyword_groups
       WHERE marketplace=? AND language=? AND normalized_name=?`
    ).bind(input.marketplace, input.language, normalized).first();
    if (concurrent?.status === "ACTIVE") return concurrent;
    throw error;
  }
  return db.prepare(`SELECT * FROM competitor_keyword_groups WHERE group_id=?`).bind(groupId).first();
}

async function listGroups(env, url) {
  const marketplace = safeText(url.searchParams.get("marketplace") || "US", 8).toUpperCase();
  const includeArchived = url.searchParams.get("include_archived") === "1";
  const clauses = ["g.marketplace=?"];
  const binds = [marketplace];
  if (!includeArchived) clauses.push("g.status='ACTIVE'");
  const result = await env.CORE_DB.prepare(
    `SELECT g.*,
            COUNT(DISTINCT j.job_id) AS job_count,
            COUNT(DISTINCT i.keyword_id) AS keyword_count,
            COUNT(DISTINCT ga.asin) AS asin_count
     FROM competitor_keyword_groups g
     LEFT JOIN competitor_keyword_research_jobs j ON j.group_id=g.group_id
     LEFT JOIN competitor_keyword_job_items i ON i.job_id=j.job_id
     LEFT JOIN competitor_keyword_group_asins ga ON ga.group_id=g.group_id
     WHERE ${clauses.join(" AND ")}
     GROUP BY g.group_id
     ORDER BY CASE WHEN g.status='ACTIVE' THEN 0 ELSE 1 END, g.updated_at DESC, g.group_name ASC`
  ).bind(...binds).all();
  return { groups: (result.results || []).map(serializeGroup), marketplace };
}

async function createGroup(request, env) {
  const body = await readJsonBody(request);
  const marketplace = safeText(body.marketplace || "US", 8).toUpperCase();
  if (!SUPPORTED_MARKETPLACES[marketplace]) {
    throw new ResearchError("GROUP_INVALID", "Unsupported group marketplace", { stage: "VALIDATION", httpStatus: 400 });
  }
  const groupName = safeText(body.group_name, 80);
  if (!groupName || !normalizeGroupName(groupName)) {
    throw new ResearchError("GROUP_NAME_REQUIRED", "A product group name is required", { stage: "VALIDATION", httpStatus: 400 });
  }
  const normalized = normalizeGroupName(groupName);
  const before = await env.CORE_DB.prepare(
    `SELECT group_id FROM competitor_keyword_groups
     WHERE marketplace=? AND language=? AND normalized_name=?`
  ).bind(marketplace, SUPPORTED_MARKETPLACES[marketplace].language, normalized).first();
  const group = await resolveGroup(env.CORE_DB, {
    marketplace,
    language: SUPPORTED_MARKETPLACES[marketplace].language,
    groupId: null,
    groupName,
    groupDescription: safeText(body.description, 300) || null,
  });
  return { group: serializeGroup(group), reused_existing_group: Boolean(before) };
}

async function updateGroup(request, env, groupId) {
  if (!validGroupId(groupId)) {
    throw new ResearchError("GROUP_NOT_FOUND", "Group is not found", { stage: "GROUP", httpStatus: 404 });
  }
  const existing = await env.CORE_DB.prepare(
    `SELECT * FROM competitor_keyword_groups WHERE group_id=?`
  ).bind(groupId).first();
  if (!existing) throw new ResearchError("GROUP_NOT_FOUND", "Group is not found", { stage: "GROUP", httpStatus: 404 });
  const body = await readJsonBody(request);
  const requestedStatus = safeText(body.status, 16).toUpperCase();
  const groupName = body.group_name === undefined ? existing.group_name : safeText(body.group_name, 80);
  const description = body.description === undefined ? existing.description : (safeText(body.description, 300) || null);
  const status = requestedStatus || existing.status;
  if (!groupName || !normalizeGroupName(groupName) || !["ACTIVE", "ARCHIVED"].includes(status)) {
    throw new ResearchError("GROUP_INVALID", "Group update is invalid", { stage: "VALIDATION", httpStatus: 400 });
  }
  const timestamp = nowIso();
  try {
    await env.CORE_DB.prepare(
      `UPDATE competitor_keyword_groups
       SET group_name=?, normalized_name=?, description=?, status=?, updated_at=?,
           archived_at=CASE WHEN ?='ARCHIVED' THEN COALESCE(archived_at, ?) ELSE NULL END
       WHERE group_id=?`
    ).bind(groupName, normalizeGroupName(groupName), description, status, timestamp, status, timestamp, groupId).run();
  } catch (error) {
    throw new ResearchError("GROUP_INVALID", "Group name conflicts with an existing group", { stage: "GROUP", httpStatus: 409 });
  }
  const updated = await env.CORE_DB.prepare(`SELECT * FROM competitor_keyword_groups WHERE group_id=?`).bind(groupId).first();
  return { group: serializeGroup(updated) };
}

function serializeJob(row) {
  if (!row) return null;
  return {
    job_id: row.job_id,
    job_name: row.job_name || null,
    group_id: row.group_id || null,
    group: row.group_id ? {
      group_id: row.group_id,
      group_name: row.group_name || "未命名分组",
      description: row.group_description || null,
      status: row.group_status || "UNKNOWN",
    } : null,
    marketplace: row.marketplace,
    language: row.language,
    input_asins: parseJson(row.input_asins_json, []),
    own_brands: parseJson(row.own_brands_json, []),
    input_asin_count: Number(row.input_asin_count || 0),
    period_start: row.period_start,
    granularity: row.granularity,
    page_size: Number(row.requested_page_size || PAGE_SIZE),
    maximum_pages_per_asin: Number(row.maximum_pages_per_asin || MAX_PAGES_PER_ASIN),
    status: row.status,
    source_tool: row.source_tool,
    taxonomy_version: row.taxonomy_version,
    normalizer_version: row.normalizer_version,
    raw_keyword_count: Number(row.raw_keyword_count || 0),
    unique_keyword_count: Number(row.unique_keyword_count || 0),
    duplicate_keyword_count: Number(row.duplicate_keyword_count || 0),
    classified_keyword_count: Number(row.classification_offset || 0),
    successful_asin_count: Number(row.successful_asin_count || 0),
    failed_asin_count: Number(row.failed_asin_count || 0),
    warnings: parseJson(row.warning_json, []),
    error: row.error_code ? { stage: row.error_stage, code: row.error_code, message: row.error_message } : null,
    observed_at: row.observed_at || null,
    created_at: row.created_at,
    completed_at: row.completed_at || null,
  };
}

function serializeAsin(row) {
  return {
    asin: row.asin,
    status: row.status,
    title: row.title || null,
    brand: row.brand || null,
    image_url: row.image_url || null,
    expected_keyword_count: row.expected_keyword_count === null ? null : Number(row.expected_keyword_count),
    fetched_keyword_count: Number(row.fetched_keyword_count || 0),
    fetched_page_count: Number(row.fetched_page_count || 0),
    is_truncated: Boolean(row.is_truncated),
    data_notice: row.data_notice || null,
    observed_at: row.observed_at || null,
    error: row.error_code ? { code: row.error_code, message: row.error_message } : null,
  };
}

export function researchCapability(env) {
  return {
    api_version: "CompetitorKeywordResearch.v1",
    configured: Boolean(env.CORE_DB && env.KEYWORD_RESEARCH_QUEUE && env.SIF_MCP_SECRET && env.SIF_RESEARCH_ACCESS_KEY),
    d1_bound: Boolean(env.CORE_DB),
    queue_bound: Boolean(env.KEYWORD_RESEARCH_QUEUE),
    sif_configured: Boolean(env.SIF_MCP_SECRET),
    access_key_configured: Boolean(env.SIF_RESEARCH_ACCESS_KEY),
    auth_required: true,
    source_tool: SOURCE_TOOL,
    source_scope: "SIF-visible traffic keywords in the selected period; not all Amazon search queries",
    marketplaces: Object.keys(SUPPORTED_MARKETPLACES),
    limits: {
      max_asins_per_job: MAX_ASINS,
      page_size: PAGE_SIZE,
      max_pages_per_asin: MAX_PAGES_PER_ASIN,
      max_visible_rows_per_asin: PAGE_SIZE * MAX_PAGES_PER_ASIN,
      max_jobs_per_hour: MAX_JOBS_PER_HOUR,
      max_asins_per_hour: MAX_ASINS_PER_HOUR,
    },
    taxonomy_version: TAXONOMY_VERSION,
    normalizer_version: NORMALIZER_VERSION,
  };
}

async function createJob(request, env) {
  if (!env.CORE_DB) {
    throw new ResearchError("STORAGE_NOT_READY", "CORE_DB is not bound", { stage: "CONFIG", httpStatus: 503 });
  }
  if (!env.KEYWORD_RESEARCH_QUEUE) {
    throw new ResearchError("QUEUE_NOT_READY", "Research queue is not bound", { stage: "CONFIG", httpStatus: 503 });
  }
  if (!String(env.SIF_MCP_SECRET || "").trim()) {
    throw new ResearchError("SIF_NOT_CONFIGURED", "SIF_MCP_SECRET is not configured", { stage: "CONFIG", httpStatus: 503 });
  }
  const body = await readJsonBody(request);
  const input = validateCreatePayload(body);
  let group;
  try {
    group = await resolveGroup(env.CORE_DB, input);
    await assertRateLimit(env.CORE_DB, input.asins.length);
  } catch (error) {
    throw storageFailure("resolve_group_or_rate_limit", error);
  }

  const jobId = crypto.randomUUID();
  const createdAt = nowIso();
  const jobWarnings = input.duplicateInputs.length
    ? [{ code: "DUPLICATE_INPUTS_REMOVED", count: input.duplicateInputs.length }]
    : [];
  // The job ledger is the source of truth. It must be written before any
  // secondary group index, and its SQL arity is covered by a worker contract
  // test. Do not let a derivative index failure discard a valid user task.
  try {
    const jobInsert = env.CORE_DB.prepare(
      `INSERT INTO competitor_keyword_research_jobs (
        job_id, job_name, group_id, marketplace, language, input_asins_json, own_brands_json,
        input_asin_count, period_start, granularity, requested_page_size,
        maximum_pages_per_asin, status, source_tool, taxonomy_version,
        normalizer_version, warning_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'QUEUED', ?, ?, ?, ?, ?)`
    ).bind(
      jobId, input.jobName, group.group_id, input.marketplace, input.language, JSON.stringify(input.asins),
      JSON.stringify(input.ownBrands), input.asins.length, input.periodStart, input.granularity,
      PAGE_SIZE, MAX_PAGES_PER_ASIN, SOURCE_TOOL, TAXONOMY_VERSION, NORMALIZER_VERSION,
      JSON.stringify(jobWarnings),
      createdAt
    );
    const asinInserts = input.asins.map((asin) => env.CORE_DB.prepare(
      `INSERT INTO competitor_keyword_research_asins (job_id, asin, status) VALUES (?, ?, 'QUEUED')`
    ).bind(jobId, asin));
    await env.CORE_DB.batch([jobInsert, ...asinInserts]);
  } catch (error) {
    throw storageFailure("prepare_or_persist_job_ledger", error, {
      jobId,
      groupId: group.group_id,
      statementCount: 1 + input.asins.length,
    });
  }

  try {
    const groupAsinUpserts = input.asins.map((asin) => env.CORE_DB.prepare(
      `INSERT INTO competitor_keyword_group_asins (
        group_id, asin, first_job_id, first_seen_at, last_seen_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(group_id, asin) DO UPDATE SET last_seen_at=excluded.last_seen_at`
    ).bind(group.group_id, asin, jobId, createdAt, createdAt));
    await env.CORE_DB.batch(groupAsinUpserts);
  } catch (error) {
    const indexWarning = { code: "GROUP_ASIN_INDEX_DEGRADED", stage: "STORAGE" };
    jobWarnings.push(indexWarning);
    console.error(JSON.stringify({
      event: "competitor_keyword_group_asin_index_degraded",
      stage: "STORAGE",
      job_id: jobId,
      group_id: group.group_id,
      statement_count: input.asins.length,
      error_name: safeText(error?.name || "Error", 80),
    }));
    try {
      await env.CORE_DB.prepare(
        `UPDATE competitor_keyword_research_jobs SET warning_json=? WHERE job_id=?`
      ).bind(JSON.stringify(jobWarnings), jobId).run();
    } catch (warningError) {
      // The task ledger is already durable and can proceed; keep this warning
      // path fail-closed in observability without turning it into a false
      // "task not created" result.
      storageFailure("persist_group_index_warning", warningError, { jobId, groupId: group.group_id });
    }
  }

  // Persist RUNNING before publishing. Once sendBatch resolves, the consumer
  // is allowed to execute immediately, so no later storage failure may turn a
  // legitimately published job into a terminal FAILED state.
  try {
    await env.CORE_DB.prepare(
      `UPDATE competitor_keyword_research_jobs SET status='RUNNING' WHERE job_id=?`
    ).bind(jobId).run();
  } catch (error) {
    throw storageFailure("mark_job_running_before_queue", error, { jobId, groupId: group.group_id });
  }

  try {
    await env.KEYWORD_RESEARCH_QUEUE.sendBatch(input.asins.map((asin) => ({
      body: { schema_version: "CompetitorKeywordQueueMessage.v1", phase: "FETCH", job_id: jobId, asin, page_num: 1 },
    })));
  } catch (error) {
    console.error(JSON.stringify({
      event: "competitor_keyword_queue_publish_failed",
      stage: "QUEUE",
      job_id: jobId,
      group_id: group.group_id,
      error_name: safeText(error?.name || "Error", 80),
    }));
    const completedAt = nowIso();
    try {
      await env.CORE_DB.batch([
        env.CORE_DB.prepare(
          `UPDATE competitor_keyword_research_jobs
           SET status='FAILED', error_stage='QUEUE', error_code='QUEUE_PUBLISH_FAILED',
               error_message='任务未能进入处理队列', completed_at=? WHERE job_id=?`
        ).bind(completedAt, jobId),
        ...input.asins.map((asin) => env.CORE_DB.prepare(
          `UPDATE competitor_keyword_research_asins
           SET status='FAILED', error_code='QUEUE_PUBLISH_FAILED', error_message='任务未能进入处理队列'
           WHERE job_id=? AND asin=?`
        ).bind(jobId, asin)),
      ]);
    } catch (markError) {
      storageFailure("mark_queue_publish_failure", markError, {
        jobId,
        groupId: group.group_id,
        statementCount: 1 + input.asins.length,
      });
    }
    throw new ResearchError("QUEUE_NOT_READY", "Failed to publish research messages", {
      stage: "QUEUE", retryable: true, httpStatus: 503,
    });
  }

  let row;
  try {
    row = await env.CORE_DB.prepare(
      `SELECT j.*, g.group_name, g.description AS group_description, g.status AS group_status
       FROM competitor_keyword_research_jobs j
       LEFT JOIN competitor_keyword_groups g ON g.group_id=j.group_id
       WHERE j.job_id=?`
    ).bind(jobId).first();
  } catch (error) {
    // The durable ledger and queue publication already succeeded. Return a
    // safe, shape-valid provisional view so the UI can continue polling the
    // task instead of falsely telling the user that it was never created.
    console.error(JSON.stringify({
      event: "competitor_keyword_post_publish_read_degraded",
      stage: "READ",
      job_id: jobId,
      group_id: group.group_id,
      error_name: safeText(error?.name || "Error", 80),
    }));
    row = {
      job_id: jobId,
      job_name: input.jobName,
      group_id: group.group_id,
      group_name: group.group_name,
      group_description: group.description || null,
      group_status: group.status,
      marketplace: input.marketplace,
      language: input.language,
      input_asins_json: JSON.stringify(input.asins),
      own_brands_json: JSON.stringify(input.ownBrands),
      input_asin_count: input.asins.length,
      period_start: input.periodStart,
      granularity: input.granularity,
      requested_page_size: PAGE_SIZE,
      maximum_pages_per_asin: MAX_PAGES_PER_ASIN,
      status: "RUNNING",
      source_tool: SOURCE_TOOL,
      taxonomy_version: TAXONOMY_VERSION,
      normalizer_version: NORMALIZER_VERSION,
      raw_keyword_count: 0,
      unique_keyword_count: 0,
      duplicate_keyword_count: 0,
      classification_offset: 0,
      successful_asin_count: 0,
      failed_asin_count: 0,
      warning_json: JSON.stringify(jobWarnings),
      created_at: createdAt,
    };
  }
  return { job: serializeJob(row), group: serializeGroup(group), input: { duplicate_asins_removed: input.duplicateInputs } };
}

async function listJobs(env, url) {
  const requested = Number(url.searchParams.get("limit") || 20);
  const limit = Math.min(50, Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : 20));
  const groupId = safeText(url.searchParams.get("group_id"), 36);
  if (groupId && !validGroupId(groupId)) {
    throw new ResearchError("GROUP_INVALID", "group_id is invalid", { stage: "VALIDATION", httpStatus: 400 });
  }
  const where = groupId ? "WHERE j.group_id=?" : "";
  const result = await env.CORE_DB.prepare(
    `SELECT j.*, g.group_name, g.description AS group_description, g.status AS group_status
     FROM competitor_keyword_research_jobs j
     LEFT JOIN competitor_keyword_groups g ON g.group_id=j.group_id
     ${where}
     ORDER BY j.created_at DESC LIMIT ?`
  ).bind(...(groupId ? [groupId, limit] : [limit])).all();
  return { jobs: (result.results || []).map(serializeJob), limit, group_id: groupId || null };
}

async function getJob(env, jobId) {
  const job = await env.CORE_DB.prepare(
    `SELECT j.*, g.group_name, g.description AS group_description, g.status AS group_status
     FROM competitor_keyword_research_jobs j
     LEFT JOIN competitor_keyword_groups g ON g.group_id=j.group_id
     WHERE j.job_id=?`
  ).bind(jobId).first();
  if (!job) throw new ResearchError("JOB_NOT_FOUND", "Job not found", { stage: "READ", httpStatus: 404 });
  const [asinsResult, categoriesResult] = await Promise.all([
    env.CORE_DB.prepare(
      `SELECT * FROM competitor_keyword_research_asins WHERE job_id=? ORDER BY asin`
    ).bind(jobId).all(),
    env.CORE_DB.prepare(
      `SELECT primary_category, COUNT(*) AS keyword_count,
              SUM(CASE WHEN needs_review=1 THEN 1 ELSE 0 END) AS review_count
       FROM competitor_keyword_job_items WHERE job_id=?
       GROUP BY primary_category ORDER BY keyword_count DESC`
    ).bind(jobId).all(),
  ]);
  return {
    job: serializeJob(job),
    asins: (asinsResult.results || []).map(serializeAsin),
    category_counts: (categoriesResult.results || []).map((row) => ({
      category: row.primary_category,
      keyword_count: Number(row.keyword_count || 0),
      review_count: Number(row.review_count || 0),
    })),
  };
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function decodeCursor(value) {
  if (!value) return 0;
  try {
    const decoded = Number(atob(value.replace(/-/g, "+").replace(/_/g, "/")));
    return Number.isFinite(decoded) ? Math.max(0, Math.floor(decoded)) : 0;
  } catch {
    return 0;
  }
}

function encodeCursor(value) {
  return btoa(String(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function boundedLikeTerm(value, maxBytes = 40) {
  let result = "";
  for (const char of normalizeKeyword(value)) {
    const candidate = result + char;
    if (new TextEncoder().encode(candidate).byteLength > maxBytes) break;
    result = candidate;
  }
  return result;
}

async function listKeywords(env, jobId, url) {
  const job = await env.CORE_DB.prepare(
    `SELECT job_id FROM competitor_keyword_research_jobs WHERE job_id=?`
  ).bind(jobId).first();
  if (!job) throw new ResearchError("JOB_NOT_FOUND", "Job not found", { stage: "READ", httpStatus: 404 });
  const requested = Number(url.searchParams.get("limit") || 100);
  const limit = Math.min(200, Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : 100));
  const offset = decodeCursor(url.searchParams.get("cursor"));
  const category = safeText(url.searchParams.get("category"), 64);
  const tier = safeText(url.searchParams.get("tier"), 32);
  const sourceAsin = safeText(url.searchParams.get("asin"), 10).toUpperCase();
  const query = boundedLikeTerm(url.searchParams.get("q"));
  const review = url.searchParams.get("review");
  const sort = url.searchParams.get("sort");
  const orderBy = sort === "source_count"
    ? "i.source_asin_count DESC, i.search_volume DESC, k.normalized_keyword ASC"
    : sort === "keyword"
      ? "k.normalized_keyword ASC"
      : "i.search_volume DESC, i.source_asin_count DESC, k.normalized_keyword ASC";
  const clauses = ["i.job_id=?"];
  const binds = [jobId];
  if (category) { clauses.push("i.primary_category=?"); binds.push(category); }
  if (tier) { clauses.push("i.strategic_tier=?"); binds.push(tier); }
  if (query) { clauses.push("k.normalized_keyword LIKE ? ESCAPE '\\'"); binds.push(`%${escapeLike(query)}%`); }
  if (review === "1") clauses.push("i.needs_review=1");
  if (review === "0") clauses.push("i.needs_review=0");
  if (sourceAsin) {
    clauses.push(`EXISTS (
      SELECT 1 FROM competitor_keyword_sources s
      WHERE s.job_id=i.job_id AND s.keyword_id=i.keyword_id AND s.asin=?
    )`);
    binds.push(sourceAsin);
  }
  const where = clauses.join(" AND ");
  const [rowsResult, countRow] = await Promise.all([
    env.CORE_DB.prepare(
      `SELECT k.keyword_id, k.display_keyword AS keyword, k.normalized_keyword,
              i.primary_category, i.secondary_tags_json, i.matched_facets_json,
              i.classification_reason, i.classification_confidence, i.query_shape,
              i.strategic_tier, i.relevance_status, i.needs_review,
              i.source_asin_count, i.source_asins_json, i.search_volume,
              i.best_aba_rank, i.max_traffic_score, i.max_traffic_share,
              i.best_organic_rank, i.best_sp_rank, i.near_duplicate_count,
              i.taxonomy_version, i.normalizer_version
       FROM competitor_keyword_job_items i
       JOIN competitor_keywords k ON k.keyword_id=i.keyword_id
       WHERE ${where}
       ORDER BY ${orderBy} LIMIT ? OFFSET ?`
    ).bind(...binds, limit + 1, offset).all(),
    env.CORE_DB.prepare(
      `SELECT COUNT(*) AS total FROM competitor_keyword_job_items i
       JOIN competitor_keywords k ON k.keyword_id=i.keyword_id
       WHERE ${where}`
    ).bind(...binds).first(),
  ]);
  const rows = rowsResult.results || [];
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((row) => ({
    keyword_id: row.keyword_id,
    keyword: row.keyword,
    normalized_keyword: row.normalized_keyword,
    primary_category: row.primary_category,
    secondary_tags: parseJson(row.secondary_tags_json, []),
    matched_facets: parseJson(row.matched_facets_json, []),
    classification_reason: row.classification_reason,
    classification_confidence: Number(row.classification_confidence || 0),
    query_shape: row.query_shape,
    strategic_tier: row.strategic_tier,
    relevance_status: row.relevance_status,
    needs_review: Boolean(row.needs_review),
    source_asin_count: Number(row.source_asin_count || 0),
    source_asins: parseJson(row.source_asins_json, []),
    search_volume: toNumber(row.search_volume),
    best_aba_rank: toInteger(row.best_aba_rank),
    max_traffic_score: toNumber(row.max_traffic_score),
    max_traffic_share: toNumber(row.max_traffic_share),
    best_organic_rank: toNumber(row.best_organic_rank),
    best_sp_rank: toNumber(row.best_sp_rank),
    near_duplicate_count: Number(row.near_duplicate_count || 0),
    taxonomy_version: row.taxonomy_version,
    normalizer_version: row.normalizer_version,
  }));
  return {
    items,
    total: Number(countRow?.total || 0),
    limit,
    next_cursor: hasMore ? encodeCursor(offset + limit) : null,
  };
}

async function listGroupKeywords(env, groupId, url) {
  if (!validGroupId(groupId)) {
    throw new ResearchError("GROUP_NOT_FOUND", "Group is not found", { stage: "GROUP", httpStatus: 404 });
  }
  const group = await env.CORE_DB.prepare(
    `SELECT * FROM competitor_keyword_groups WHERE group_id=?`
  ).bind(groupId).first();
  if (!group) throw new ResearchError("GROUP_NOT_FOUND", "Group is not found", { stage: "GROUP", httpStatus: 404 });

  const requested = Number(url.searchParams.get("limit") || 100);
  const limit = Math.min(200, Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : 100));
  const offset = decodeCursor(url.searchParams.get("cursor"));
  const category = safeText(url.searchParams.get("category"), 64);
  const query = boundedLikeTerm(url.searchParams.get("q"));
  const sort = url.searchParams.get("sort");
  const orderBy = sort === "source_count"
    ? "source_asin_count DESC, search_volume DESC, normalized_keyword ASC"
    : sort === "keyword"
      ? "normalized_keyword ASC"
      : "search_volume DESC, source_asin_count DESC, normalized_keyword ASC";
  const where = ["j.group_id=?"];
  const binds = [groupId];
  if (query) { where.push("k.normalized_keyword LIKE ? ESCAPE '\\'"); binds.push(`%${escapeLike(query)}%`); }
  const having = category ? "HAVING SUM(CASE WHEN i.primary_category=? THEN 1 ELSE 0 END) > 0" : "";
  const groupedFrom = `
    FROM competitor_keyword_research_jobs j
    JOIN competitor_keyword_job_items i ON i.job_id=j.job_id
    JOIN competitor_keywords k ON k.keyword_id=i.keyword_id
    LEFT JOIN competitor_keyword_sources s ON s.job_id=i.job_id AND s.keyword_id=i.keyword_id
    WHERE ${where.join(" AND ")}
    GROUP BY k.keyword_id, k.display_keyword, k.normalized_keyword`;
  const select = `
    SELECT k.keyword_id, k.display_keyword AS keyword, k.normalized_keyword,
           GROUP_CONCAT(DISTINCT i.primary_category) AS primary_categories,
           COUNT(DISTINCT i.primary_category) AS category_variant_count,
           MAX(i.needs_review) AS needs_review,
           COUNT(DISTINCT j.job_id) AS source_job_count,
           COUNT(DISTINCT s.asin) AS source_asin_count,
           GROUP_CONCAT(DISTINCT s.asin) AS source_asins_csv,
           MAX(s.search_volume) AS search_volume,
           MIN(CASE WHEN s.aba_rank > 0 THEN s.aba_rank END) AS best_aba_rank,
           MAX(s.traffic_score) AS max_traffic_score,
           MAX(s.traffic_share) AS max_traffic_share,
           MIN(CASE WHEN s.organic_rank > 0 THEN s.organic_rank END) AS best_organic_rank,
           MIN(CASE WHEN s.sp_rank > 0 THEN s.sp_rank END) AS best_sp_rank,
           MAX(s.observed_at) AS observed_at`;
  const allBinds = category ? [...binds, category] : binds;
  const [rowsResult, countRow] = await Promise.all([
    env.CORE_DB.prepare(`${select} ${groupedFrom} ${having} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
      .bind(...allBinds, limit + 1, offset).all(),
    env.CORE_DB.prepare(`SELECT COUNT(*) AS total FROM (SELECT k.keyword_id ${groupedFrom} ${having})`)
      .bind(...allBinds).first(),
  ]);
  const rows = rowsResult.results || [];
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((row) => {
    const categories = String(row.primary_categories || "").split(",").filter(Boolean);
    const classificationConflict = Number(row.category_variant_count || 0) > 1;
    return {
      keyword_id: row.keyword_id,
      keyword: row.keyword,
      normalized_keyword: row.normalized_keyword,
      primary_category: categories[0] || "related_general",
      primary_categories: categories,
      classification_conflict: classificationConflict,
      needs_review: Boolean(row.needs_review) || classificationConflict,
      source_job_count: Number(row.source_job_count || 0),
      source_asin_count: Number(row.source_asin_count || 0),
      source_asins: String(row.source_asins_csv || "").split(",").filter(Boolean),
      search_volume: toNumber(row.search_volume),
      best_aba_rank: toInteger(row.best_aba_rank),
      max_traffic_score: toNumber(row.max_traffic_score),
      max_traffic_share: toNumber(row.max_traffic_share),
      best_organic_rank: toNumber(row.best_organic_rank),
      best_sp_rank: toNumber(row.best_sp_rank),
      observed_at: row.observed_at || null,
    };
  });
  return {
    group: serializeGroup(group),
    items,
    total: Number(countRow?.total || 0),
    limit,
    next_cursor: hasMore ? encodeCursor(offset + limit) : null,
  };
}

export async function handleResearchRequest(request, env, context) {
  const url = new URL(request.url);
  const { json, origin } = context;
  if (request.method === "GET" && url.pathname === "/research-status") {
    return json({ success: true, research: researchCapability(env) }, 200, origin);
  }
  if (request.method === "GET" && url.pathname === `${API_PREFIX}/keyword-taxonomy`) {
    return json({
      success: true,
      taxonomy_version: TAXONOMY_VERSION,
      normalizer_version: NORMALIZER_VERSION,
      categories: KEYWORD_CATEGORIES,
      dimensions: {
        query_shape: ["HEAD", "MID_TAIL", "LONG_TAIL"],
        strategic_tier: ["CORE", "SUPPORT", "LONG_TAIL", "NICHE"],
        relevance_status: ["RELEVANT", "AMBIGUOUS", "IRRELEVANT"],
      },
      deduplication: {
        automatic: "Unicode NFKC + lowercase + punctuation and whitespace normalization",
        near_duplicate: "Token-order signature is review-only; variants are never silently merged",
      },
    }, 200, origin);
  }
  if (!url.pathname.startsWith(`${API_PREFIX}/competitor-keyword`)) return null;

  try {
    await requireResearchAccess(request, env);
    if (!env.CORE_DB) {
      throw new ResearchError("STORAGE_NOT_READY", "CORE_DB is not bound", { stage: "CONFIG", httpStatus: 503 });
    }
    if (request.method === "GET" && url.pathname === `${API_PREFIX}/competitor-keyword-groups`) {
      return json({ success: true, ...(await listGroups(env, url)) }, 200, origin);
    }
    if (request.method === "POST" && url.pathname === `${API_PREFIX}/competitor-keyword-groups`) {
      return json({ success: true, ...(await createGroup(request, env)) }, 201, origin);
    }
    const groupMatch = url.pathname.match(/^\/api\/v1\/competitor-keyword-groups\/([0-9a-f-]+)(?:\/(keywords))?$/i);
    if (groupMatch) {
      const groupId = groupMatch[1];
      if (request.method === "GET" && groupMatch[2] === "keywords") {
        return json({ success: true, ...(await listGroupKeywords(env, groupId, url)) }, 200, origin);
      }
      if (request.method === "PATCH" && !groupMatch[2]) {
        return json({ success: true, ...(await updateGroup(request, env, groupId)) }, 200, origin);
      }
    }
    if (request.method === "POST" && url.pathname === `${API_PREFIX}/competitor-keyword-runs`) {
      const result = await createJob(request, env);
      return json({ success: true, ...result }, 202, origin);
    }
    if (request.method === "GET" && url.pathname === `${API_PREFIX}/competitor-keyword-runs`) {
      return json({ success: true, ...(await listJobs(env, url)) }, 200, origin);
    }
    const match = url.pathname.match(/^\/api\/v1\/competitor-keyword-runs\/([0-9a-f-]+)(?:\/(keywords|asins))?$/i);
    if (request.method === "GET" && match) {
      const jobId = match[1];
      if (match[2] === "keywords") return json({ success: true, ...(await listKeywords(env, jobId, url)) }, 200, origin);
      const detail = await getJob(env, jobId);
      if (match[2] === "asins") return json({ success: true, job_id: jobId, asins: detail.asins }, 200, origin);
      return json({ success: true, ...detail }, 200, origin);
    }
    return json({ success: false, error: { code: "ENDPOINT_NOT_FOUND", message: "接口不存在。" } }, 404, origin);
  } catch (error) {
    if (error?.validation) {
      const detail = publicResearchError(error);
      return json({ success: false, error: detail, validation: error.validation }, error.httpStatus || 400, origin);
    }
    return errorResponse(error, json, origin);
  }
}

async function writeObservation(db, input) {
  const observationId = input.observationId || crypto.randomUUID();
  let payloadJson = JSON.stringify(input.payload ?? null);
  if (new TextEncoder().encode(payloadJson).byteLength > 1_800_000) {
    payloadJson = JSON.stringify({
      storage_notice: "RAW_PAYLOAD_OMITTED_OVER_D1_ROW_LIMIT",
      total: toInteger(input.payload?.total),
      detail_count: Array.isArray(input.payload?.details) ? input.payload.details.length : null,
      data_notice: safeText(input.payload?.data_notice, 320) || null,
    });
  }
  await db.prepare(
    `INSERT OR IGNORE INTO external_tool_observations (
      observation_id, provider, tool_name, dataset, subject_type, subject_key,
      product_id, marketplace, observed_at, payload_json, schema_version, parser_version
    ) VALUES (?, 'sif', ?, ?, 'competitor_asin', ?, NULL, ?, ?, ?, 'ExternalToolObservation.v1', ?)`
  ).bind(
    observationId, input.toolName, input.dataset, input.asin, input.marketplace,
    input.observedAt, payloadJson, PARSER_VERSION
  ).run();
  return observationId;
}

function parseTrafficPage(payload) {
  if (payload && typeof payload === "object" && Array.isArray(payload.details)) {
    const total = toInteger(payload.total);
    const detailsValid = payload.details.length <= PAGE_SIZE
      && payload.details.every((item) => item && typeof item === "object" && typeof item.keyword === "string");
    if (total === null || total < 0 || !detailsValid) {
      throw new ResearchError("SIF_SCHEMA_INVALID", "SIF traffic keyword page is invalid", { stage: "SIF_PARSE", retryable: false });
    }
    return { total, details: payload.details, dataNotice: safeText(payload.data_notice, 320) || null };
  }
  if (payload && typeof payload === "object" && /no data/i.test(String(payload.message || ""))) {
    return { total: 0, details: [], dataNotice: safeText(payload.data_notice || payload.message, 320) || null };
  }
  throw new ResearchError("SIF_SCHEMA_INVALID", "SIF details array is missing", { stage: "SIF_PARSE", retryable: false });
}

function sourceFromRow(row, observationId) {
  const rawKeyword = safeText(row?.keyword, 240);
  const normalized = normalizeKeyword(rawKeyword);
  if (!normalized || normalized.length > 240) return null;
  return {
    keywordId: null,
    rawKeyword,
    normalized,
    tokenSignature: tokenSignature(normalized),
    translatedKeyword: safeText(row?.translateKeyword, 240) || null,
    searchVolume: toNumber(row?.estSearchesNum ?? row?.search_volume),
    abaRank: toInteger(row?.searchesRank ?? row?.aba_rank),
    trafficScore: toNumber(row?.score),
    trafficShare: toNumber(row?.scoreRatio ?? row?.traffic_share),
    organicRank: toNumber(row?.pchangeReason?.nfInfo?.rankAvg ?? row?.organic_rank),
    spRank: toNumber(row?.pchangeReason?.spInfo?.rankAvg ?? row?.sp_rank),
    observationId,
  };
}

function mergeSource(left, right) {
  if (!left) return right;
  const preferRight = (right.searchVolume ?? -Infinity) > (left.searchVolume ?? -Infinity)
    || ((right.searchVolume ?? -Infinity) === (left.searchVolume ?? -Infinity)
      && (right.trafficScore ?? -Infinity) > (left.trafficScore ?? -Infinity));
  const preferred = preferRight ? right : left;
  return {
    ...preferred,
    searchVolume: highest(left.searchVolume, right.searchVolume),
    abaRank: bestPositive(left.abaRank, right.abaRank),
    trafficScore: highest(left.trafficScore, right.trafficScore),
    trafficShare: highest(left.trafficShare, right.trafficShare),
    organicRank: bestPositive(left.organicRank, right.organicRank),
    spRank: bestPositive(left.spRank, right.spRank),
  };
}

async function persistSources(db, job, asin, sources, observedAt) {
  const rows = [...sources.values()];
  if (!rows.length) return;
  const canonicalRows = rows.map((row) => ({
    keyword_id: keywordId(job.marketplace, job.language, row.normalized),
    marketplace: job.marketplace,
    language: job.language,
    normalized_keyword: row.normalized,
    display_keyword: row.rawKeyword,
    token_signature: row.tokenSignature,
    observed_at: observedAt,
  }));
  const sourceRows = rows.map((row, index) => ({
    job_id: job.job_id,
    keyword_id: canonicalRows[index].keyword_id,
    asin,
    raw_keyword: row.rawKeyword,
    translated_keyword: row.translatedKeyword,
    search_volume: row.searchVolume,
    aba_rank: row.abaRank,
    traffic_score: row.trafficScore,
    traffic_share: row.trafficShare,
    organic_rank: row.organicRank,
    sp_rank: row.spRank,
    source_tool: SOURCE_TOOL,
    source_observation_id: row.observationId,
    observed_at: observedAt,
  }));
  await db.batch([
    db.prepare(
      `INSERT INTO competitor_keywords (
         keyword_id, marketplace, language, normalized_keyword, display_keyword,
         token_signature, first_seen_at, last_seen_at
       )
       SELECT
         json_extract(value, '$.keyword_id'), json_extract(value, '$.marketplace'),
         json_extract(value, '$.language'), json_extract(value, '$.normalized_keyword'),
         json_extract(value, '$.display_keyword'), json_extract(value, '$.token_signature'),
         json_extract(value, '$.observed_at'), json_extract(value, '$.observed_at')
       FROM json_each(?) WHERE true
       ON CONFLICT(keyword_id) DO UPDATE SET
         display_keyword=CASE
           WHEN length(excluded.display_keyword) < length(competitor_keywords.display_keyword)
             THEN excluded.display_keyword ELSE competitor_keywords.display_keyword END,
         token_signature=excluded.token_signature,
         last_seen_at=excluded.last_seen_at`
    ).bind(JSON.stringify(canonicalRows)),
    db.prepare(
      `INSERT INTO competitor_keyword_sources (
         job_id, keyword_id, asin, raw_keyword, translated_keyword, search_volume,
         aba_rank, traffic_score, traffic_share, organic_rank, sp_rank,
         source_tool, source_observation_id, observed_at
       )
       SELECT
         json_extract(value, '$.job_id'), json_extract(value, '$.keyword_id'),
         json_extract(value, '$.asin'), json_extract(value, '$.raw_keyword'),
         json_extract(value, '$.translated_keyword'), json_extract(value, '$.search_volume'),
         json_extract(value, '$.aba_rank'), json_extract(value, '$.traffic_score'),
         json_extract(value, '$.traffic_share'), json_extract(value, '$.organic_rank'),
         json_extract(value, '$.sp_rank'), json_extract(value, '$.source_tool'),
         json_extract(value, '$.source_observation_id'), json_extract(value, '$.observed_at')
       FROM json_each(?) WHERE true
       ON CONFLICT(job_id, keyword_id, asin) DO UPDATE SET
         raw_keyword=excluded.raw_keyword,
         translated_keyword=excluded.translated_keyword,
         search_volume=excluded.search_volume,
         aba_rank=excluded.aba_rank,
         traffic_score=excluded.traffic_score,
         traffic_share=excluded.traffic_share,
         organic_rank=excluded.organic_rank,
         sp_rank=excluded.sp_rank,
         source_observation_id=excluded.source_observation_id,
         observed_at=excluded.observed_at`
    ).bind(JSON.stringify(sourceRows)),
  ]);
}

async function loadJob(db, jobId) {
  const row = await db.prepare(
    `SELECT * FROM competitor_keyword_research_jobs WHERE job_id=?`
  ).bind(jobId).first();
  return row ? { ...row, inputAsins: parseJson(row.input_asins_json, []), ownBrands: parseJson(row.own_brands_json, []) } : null;
}

async function markAsinError(db, jobId, asin, detail, status, claimToken = null) {
  await db.prepare(
    `UPDATE competitor_keyword_research_asins
     SET status=?, error_code=?, error_message=?, observed_at=?,
         processing_page_num=NULL, processing_started_at=NULL, processing_token=NULL
     WHERE job_id=? AND asin=? AND status NOT IN ('SUCCEEDED','FAILED')
       AND ((? IS NOT NULL AND processing_token=?)
         OR (? IS NULL AND processing_page_num IS NULL))`
  ).bind(status, detail.code, detail.message, nowIso(), jobId, asin, claimToken, claimToken, claimToken).run();
}

async function enqueueFetchPage(env, jobId, asin, pageNum) {
  if (!env.KEYWORD_RESEARCH_QUEUE) {
    throw new ResearchError("QUEUE_NOT_READY", "Research queue is not bound", {
      stage: "QUEUE", retryable: true,
    });
  }
  try {
    await env.KEYWORD_RESEARCH_QUEUE.send({
      schema_version: "CompetitorKeywordQueueMessage.v1",
      phase: "FETCH",
      job_id: jobId,
      asin,
      page_num: pageNum,
    });
  } catch {
    throw new ResearchError("QUEUE_NOT_READY", "Failed to publish the next SIF page", {
      stage: "QUEUE", retryable: true,
    });
  }
}

async function claimFetchPage(db, jobId, asin, pageNum) {
  const claimedAt = nowIso();
  const claimToken = crypto.randomUUID();
  const claim = await db.prepare(
    `UPDATE competitor_keyword_research_asins
     SET status='FETCHING', processing_page_num=?, processing_started_at=?, processing_token=?,
         error_code=NULL, error_message=NULL
     WHERE job_id=? AND asin=? AND next_page_num=?
       AND status NOT IN ('SUCCEEDED','FAILED')
       AND (
         processing_page_num IS NULL
         OR datetime(processing_started_at) <= datetime('now', '-3 minutes')
       )`
  ).bind(pageNum, claimedAt, claimToken, jobId, asin, pageNum).run();
  return Number(claim?.meta?.changes || 0) > 0 ? claimToken : null;
}

function mergeDataNotice(...values) {
  return [...new Set(values.map((value) => safeText(value, 320)).filter(Boolean))].join(" · ").slice(0, 1000) || null;
}

async function processOneAsinPage(env, body) {
  if (!env.CORE_DB) throw new ResearchError("STORAGE_NOT_READY", "CORE_DB is not bound", { stage: "CONFIG" });
  const secret = String(env.SIF_MCP_SECRET || "").trim();
  if (!secret) throw new ResearchError("SIF_NOT_CONFIGURED", "SIF_MCP_SECRET is not configured", { stage: "CONFIG" });
  const job = await loadJob(env.CORE_DB, body.job_id);
  if (!job) return;
  const asinState = await env.CORE_DB.prepare(
    `SELECT * FROM competitor_keyword_research_asins WHERE job_id=? AND asin=?`
  ).bind(job.job_id, body.asin).first();
  if (!asinState) return;
  if (asinState.status === "SUCCEEDED" || asinState.status === "FAILED") {
    await finalizeJobIfReady(env, job.job_id);
    return;
  }
  if (TERMINAL_JOB_STATES.has(job.status)
    || job.status === "CLASSIFICATION_PENDING" || job.status === "CLASSIFYING") return;
  const pageNum = Math.max(1, Number(body.page_num || 1));
  const nextPageNum = Math.max(1, Number(asinState.next_page_num || 1));

  if (pageNum < nextPageNum) {
    // The durable page cursor advanced before a previous delivery was acknowledged.
    // Re-publishing the durable next page is safe because that page is CAS-claimed.
    await enqueueFetchPage(env, job.job_id, body.asin, nextPageNum);
    return;
  }
  if (pageNum > nextPageNum) {
    throw new ResearchError("FETCH_PREDECESSOR_PENDING", "A predecessor page is not committed", {
      stage: "FETCH_CLAIM", retryable: true,
    });
  }
  const claimToken = await claimFetchPage(env.CORE_DB, job.job_id, body.asin, pageNum);
  if (!claimToken) {
    throw new ResearchError("FETCH_PAGE_BUSY", "This page already has an active lease", {
      stage: "FETCH_CLAIM", retryable: true,
    });
  }

  try {
  await env.CORE_DB.prepare(
    `UPDATE competitor_keyword_research_jobs
     SET status='RUNNING', error_stage=NULL, error_code=NULL, error_message=NULL
     WHERE job_id=? AND status NOT IN ('CLASSIFICATION_PENDING','CLASSIFYING','SUCCEEDED','PARTIAL','FAILED')`
  ).bind(job.job_id).run();

  const observedAt = nowIso();
  const session = await startSifSession(secret);
  let callId = 10;
  let profile = null;
  let profileWarning = null;
  if (pageNum === 1 && !asinState.title && !asinState.brand) {
    try {
      const profilePayload = await callSifTool(secret, session.sessionId, callId++, PROFILE_TOOL, {
        asins: [body.asin], country: job.marketplace,
      });
      await writeObservation(env.CORE_DB, {
        observationId: `ckr:${job.job_id}:${body.asin}:profile`,
        toolName: PROFILE_TOOL, dataset: "competitor_asin_profile", asin: body.asin,
        marketplace: job.marketplace, observedAt, payload: profilePayload,
      });
      profile = (Array.isArray(profilePayload?.list) ? profilePayload.list : [])
        .find((item) => String(item?.asin || "").toUpperCase() === body.asin) || null;
    } catch {
      profileWarning = "产品标题或品牌未能读取，关键词任务继续执行";
    }
  }

  const sources = new Map();
  const payload = await callSifTool(secret, session.sessionId, callId++, SOURCE_TOOL, {
    asin: body.asin,
    country: job.marketplace,
    endDay: job.period_start,
    granularity: job.granularity,
    keywordType: "all",
    desc: true,
    pageNum,
    pageSize: PAGE_SIZE,
    sortBy: "score",
  });
  const page = parseTrafficPage(payload);
  const observationId = await writeObservation(env.CORE_DB, {
    observationId: `ckr:${job.job_id}:${body.asin}:traffic:${pageNum}`,
    toolName: SOURCE_TOOL, dataset: "competitor_traffic_keywords", asin: body.asin,
    marketplace: job.marketplace, observedAt, payload,
  });
  for (const item of page.details) {
    const source = sourceFromRow(item, observationId);
    if (!source) continue;
    sources.set(source.normalized, mergeSource(sources.get(source.normalized), source));
  }

  await persistSources(env.CORE_DB, job, body.asin, sources, observedAt);
  const fetchedRows = (pageNum - 1) * PAGE_SIZE + page.details.length;
  const terminal = page.total === 0
    || fetchedRows >= page.total
    || page.details.length < PAGE_SIZE
    || pageNum >= MAX_PAGES_PER_ASIN;
  const truncated = terminal && fetchedRows < page.total;
  const nextStatus = terminal ? "SUCCEEDED" : "FETCHING";
  const dataNotice = mergeDataNotice(asinState.data_notice, profileWarning, page.dataNotice);
  const pageCommit = await env.CORE_DB.prepare(
    `UPDATE competitor_keyword_research_asins
     SET status=?, title=COALESCE(?, title), brand=COALESCE(?, brand), image_url=COALESCE(?, image_url),
         expected_keyword_count=?, fetched_keyword_count=MAX(fetched_keyword_count, ?),
         fetched_page_count=MAX(fetched_page_count, ?), is_truncated=?, data_notice=?,
         observed_at=?, error_code=NULL, error_message=NULL, next_page_num=?,
         processing_page_num=NULL, processing_started_at=NULL, processing_token=NULL
     WHERE job_id=? AND asin=? AND next_page_num=? AND processing_page_num=? AND processing_token=?`
  ).bind(
    nextStatus, safeText(profile?.title, 500) || null, safeText(profile?.brand, 120) || null,
    safeText(profile?.img, 1000) || null, page.total, fetchedRows, pageNum,
    truncated ? 1 : 0, dataNotice || null, observedAt, pageNum + 1,
    job.job_id, body.asin, pageNum, pageNum, claimToken
  ).run();
  if (!Number(pageCommit?.meta?.changes || 0)) return;
  if (terminal) {
    await finalizeJobIfReady(env, job.job_id);
    return;
  }
  await enqueueFetchPage(env, job.job_id, body.asin, pageNum + 1);
  } catch (error) {
    if (error && typeof error === "object") error.fetchClaimToken = claimToken;
    throw error;
  }
}

async function jobStateCounts(db, jobId) {
  return db.prepare(
    `SELECT
       SUM(CASE WHEN status='SUCCEEDED' THEN 1 ELSE 0 END) AS succeeded,
       SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) AS failed,
       SUM(CASE WHEN status NOT IN ('SUCCEEDED','FAILED') THEN 1 ELSE 0 END) AS pending,
       COALESCE(SUM(fetched_keyword_count), 0) AS raw_count,
       SUM(CASE WHEN is_truncated=1 THEN 1 ELSE 0 END) AS truncated_count
     FROM competitor_keyword_research_asins WHERE job_id=?`
  ).bind(jobId).first();
}

async function classificationContext(db, job) {
  const profileResult = await db.prepare(
    `SELECT title, brand FROM competitor_keyword_research_asins WHERE job_id=? AND status='SUCCEEDED'`
  ).bind(job.job_id).all();
  const profiles = profileResult.results || [];
  return {
    competitorBrands: profiles.map((row) => row.brand).filter(Boolean),
    coreTokens: deriveCoreTokens(profiles),
    effectiveInputAsinCount: Math.max(1, profiles.length),
  };
}

async function loadClassificationPage(db, jobId, offset) {
  const result = await db.prepare(
    `WITH signature_counts AS (
       SELECT k2.token_signature, COUNT(DISTINCT k2.keyword_id) - 1 AS near_duplicate_count
       FROM competitor_keyword_sources s2
       JOIN competitor_keywords k2 ON k2.keyword_id=s2.keyword_id
       WHERE s2.job_id=?
       GROUP BY k2.token_signature
     ), aggregated AS (
       SELECT k.keyword_id, k.normalized_keyword, k.token_signature,
              COUNT(DISTINCT s.asin) AS source_asin_count,
              json_group_array(DISTINCT s.asin) AS source_asins_json,
              MAX(s.search_volume) AS search_volume,
              MIN(CASE WHEN s.aba_rank > 0 THEN s.aba_rank END) AS best_aba_rank,
              MAX(s.traffic_score) AS max_traffic_score,
              MAX(s.traffic_share) AS max_traffic_share,
              MIN(CASE WHEN s.organic_rank > 0 THEN s.organic_rank END) AS best_organic_rank,
              MIN(CASE WHEN s.sp_rank > 0 THEN s.sp_rank END) AS best_sp_rank
       FROM competitor_keyword_sources s
       JOIN competitor_keywords k ON k.keyword_id=s.keyword_id
       WHERE s.job_id=?
       GROUP BY k.keyword_id, k.normalized_keyword, k.token_signature
     )
     SELECT aggregated.*, COALESCE(signature_counts.near_duplicate_count, 0) AS near_duplicate_count
     FROM aggregated
     LEFT JOIN signature_counts USING(token_signature)
     ORDER BY keyword_id LIMIT ? OFFSET ?`
  ).bind(jobId, jobId, CLASSIFICATION_PAGE_SIZE, offset).all();
  return result.results || [];
}

async function persistJobItems(db, job, sourceRows, context) {
  if (!sourceRows.length) return;
  const createdAt = nowIso();
  const rows = sourceRows.map((row) => {
    const sourceAsins = parseJson(row.source_asins_json, []);
    const classification = classifyKeyword({
      normalizedKeyword: row.normalized_keyword,
      sourceAsinCount: Number(row.source_asin_count || 1),
      inputAsinCount: context.effectiveInputAsinCount,
      searchVolume: row.search_volume,
      organicRank: row.best_organic_rank,
      spRank: row.best_sp_rank,
      ownBrands: job.ownBrands,
      competitorBrands: context.competitorBrands,
      coreTokens: context.coreTokens,
      nearDuplicateCount: Number(row.near_duplicate_count || 0),
    });
    return {
      job_id: job.job_id,
      keyword_id: row.keyword_id,
      primary_category: classification.primaryCategory,
      secondary_tags_json: JSON.stringify(classification.secondaryTags),
      matched_facets_json: JSON.stringify(classification.matchedFacets),
      matched_rule_ids_json: JSON.stringify(classification.matchedRuleIds),
      classification_reason: classification.classificationReason,
      classification_confidence: classification.classificationConfidence,
      taxonomy_version: TAXONOMY_VERSION,
      normalizer_version: NORMALIZER_VERSION,
      classifier_method: "deterministic_rules",
      query_shape: classification.queryShape,
      strategic_tier: classification.strategicTier,
      relevance_status: classification.relevanceStatus,
      needs_review: classification.needsReview ? 1 : 0,
      token_signature: row.token_signature,
      source_asin_count: Number(row.source_asin_count || 0),
      source_asins_json: JSON.stringify(sourceAsins),
      search_volume: toNumber(row.search_volume),
      best_aba_rank: toInteger(row.best_aba_rank),
      max_traffic_score: toNumber(row.max_traffic_score),
      max_traffic_share: toNumber(row.max_traffic_share),
      best_organic_rank: toNumber(row.best_organic_rank),
      best_sp_rank: toNumber(row.best_sp_rank),
      near_duplicate_count: Number(row.near_duplicate_count || 0),
      created_at: createdAt,
    };
  });
  await db.prepare(
    `INSERT INTO competitor_keyword_job_items (
       job_id, keyword_id, primary_category, secondary_tags_json, matched_facets_json,
       matched_rule_ids_json, classification_reason, classification_confidence,
       taxonomy_version, normalizer_version, classifier_method, query_shape,
       strategic_tier, relevance_status, needs_review, token_signature,
       source_asin_count, source_asins_json, search_volume, best_aba_rank,
       max_traffic_score, max_traffic_share, best_organic_rank, best_sp_rank,
       near_duplicate_count, created_at
     )
     SELECT
       json_extract(value, '$.job_id'), json_extract(value, '$.keyword_id'),
       json_extract(value, '$.primary_category'), json_extract(value, '$.secondary_tags_json'),
       json_extract(value, '$.matched_facets_json'), json_extract(value, '$.matched_rule_ids_json'),
       json_extract(value, '$.classification_reason'), json_extract(value, '$.classification_confidence'),
       json_extract(value, '$.taxonomy_version'), json_extract(value, '$.normalizer_version'),
       json_extract(value, '$.classifier_method'), json_extract(value, '$.query_shape'),
       json_extract(value, '$.strategic_tier'), json_extract(value, '$.relevance_status'),
       json_extract(value, '$.needs_review'), json_extract(value, '$.token_signature'),
       json_extract(value, '$.source_asin_count'), json_extract(value, '$.source_asins_json'),
       json_extract(value, '$.search_volume'), json_extract(value, '$.best_aba_rank'),
       json_extract(value, '$.max_traffic_score'), json_extract(value, '$.max_traffic_share'),
       json_extract(value, '$.best_organic_rank'), json_extract(value, '$.best_sp_rank'),
       json_extract(value, '$.near_duplicate_count'), json_extract(value, '$.created_at')
     FROM json_each(?) WHERE true
     ON CONFLICT(job_id, keyword_id) DO UPDATE SET
       primary_category=excluded.primary_category,
       secondary_tags_json=excluded.secondary_tags_json,
       matched_facets_json=excluded.matched_facets_json,
       matched_rule_ids_json=excluded.matched_rule_ids_json,
       classification_reason=excluded.classification_reason,
       classification_confidence=excluded.classification_confidence,
       taxonomy_version=excluded.taxonomy_version,
       normalizer_version=excluded.normalizer_version,
       classifier_method=excluded.classifier_method,
       query_shape=excluded.query_shape,
       strategic_tier=excluded.strategic_tier,
       relevance_status=excluded.relevance_status,
       needs_review=excluded.needs_review,
       source_asin_count=excluded.source_asin_count,
       source_asins_json=excluded.source_asins_json,
       search_volume=excluded.search_volume,
       best_aba_rank=excluded.best_aba_rank,
       max_traffic_score=excluded.max_traffic_score,
       max_traffic_share=excluded.max_traffic_share,
       best_organic_rank=excluded.best_organic_rank,
       best_sp_rank=excluded.best_sp_rank,
       near_duplicate_count=excluded.near_duplicate_count,
       created_at=excluded.created_at`
  ).bind(JSON.stringify(rows)).run();
}

async function completeClassifiedJob(db, job, offset, nextOffset) {
  const [counts, keywordCounts] = await Promise.all([
    jobStateCounts(db, job.job_id),
    db.prepare(
      `SELECT COUNT(*) AS unique_count,
              SUM(CASE WHEN needs_review=1 THEN 1 ELSE 0 END) AS review_count
       FROM competitor_keyword_job_items WHERE job_id=?`
    ).bind(job.job_id).first(),
  ]);
  const succeeded = Number(counts?.succeeded || 0);
  const failed = Number(counts?.failed || 0);
  const rawCount = Number(counts?.raw_count || 0);
  const uniqueCount = Number(keywordCounts?.unique_count || 0);
  const reviewCount = Number(keywordCounts?.review_count || 0);
  const warnings = parseJson(job.warning_json, []);
  const truncatedCount = Number(counts?.truncated_count || 0);
  if (truncatedCount > 0 && !warnings.some((item) => item?.code === "SOURCE_TRUNCATED")) {
    warnings.push({ code: "SOURCE_TRUNCATED", asin_count: truncatedCount });
  }
  if (reviewCount > 0 && !warnings.some((item) => item?.code === "CLASSIFICATION_REVIEW_REQUIRED")) {
    warnings.push({ code: "CLASSIFICATION_REVIEW_REQUIRED", keyword_count: reviewCount });
  }
  const status = failed > 0 ? "PARTIAL" : "SUCCEEDED";
  const completedAt = nowIso();
  await db.prepare(
    `UPDATE competitor_keyword_research_jobs
     SET status=?, raw_keyword_count=?, unique_keyword_count=?, duplicate_keyword_count=?,
         classification_offset=?, successful_asin_count=?, failed_asin_count=?,
         warning_json=?, observed_at=?, completed_at=?,
         error_stage=NULL, error_code=NULL, error_message=NULL
     WHERE job_id=? AND status='CLASSIFYING' AND classification_offset=?`
  ).bind(
    status, rawCount, uniqueCount, Math.max(0, rawCount - uniqueCount), nextOffset,
    succeeded, failed, JSON.stringify(warnings), completedAt, completedAt, job.job_id, offset
  ).run();
}

async function processClassificationPage(env, body) {
  if (!env.CORE_DB || !env.KEYWORD_RESEARCH_QUEUE) {
    throw new ResearchError("STORAGE_NOT_READY", "Research bindings are not ready", { stage: "CLASSIFICATION", retryable: true });
  }
  let job = await loadJob(env.CORE_DB, body.job_id);
  if (!job || TERMINAL_JOB_STATES.has(job.status)) return;
  if (job.status === "CLASSIFICATION_PENDING" && Number(body.offset || 0) === 0) {
    await env.CORE_DB.prepare(
      `UPDATE competitor_keyword_research_jobs SET status='CLASSIFYING'
       WHERE job_id=? AND status='CLASSIFICATION_PENDING'`
    ).bind(job.job_id).run();
    job = await loadJob(env.CORE_DB, body.job_id);
  }
  if (job.status !== "CLASSIFYING") {
    throw new ResearchError("CLASSIFICATION_ERROR", "Classification is not ready", { stage: "CLASSIFICATION", retryable: true });
  }
  const offset = Math.max(0, Number(body.offset || 0));
  const currentOffset = Number(job.classification_offset || 0);
  if (offset < currentOffset) {
    if (currentOffset === offset + CLASSIFICATION_PAGE_SIZE) {
      await env.KEYWORD_RESEARCH_QUEUE.send({
        schema_version: "CompetitorKeywordQueueMessage.v1",
        phase: "CLASSIFY",
        job_id: job.job_id,
        offset: currentOffset,
      });
    }
    return;
  }
  if (offset > currentOffset) {
    throw new ResearchError("CLASSIFICATION_ERROR", "Classification predecessor is not committed", { stage: "CLASSIFICATION", retryable: true });
  }
  const [context, sourceRows] = await Promise.all([
    classificationContext(env.CORE_DB, job),
    loadClassificationPage(env.CORE_DB, job.job_id, offset),
  ]);
  await persistJobItems(env.CORE_DB, job, sourceRows, context);
  const nextOffset = offset + sourceRows.length;
  if (sourceRows.length === CLASSIFICATION_PAGE_SIZE) {
    const advance = await env.CORE_DB.prepare(
      `UPDATE competitor_keyword_research_jobs SET classification_offset=?
       WHERE job_id=? AND status='CLASSIFYING' AND classification_offset=?`
    ).bind(nextOffset, job.job_id, offset).run();
    if (!Number(advance?.meta?.changes || 0)) return;
    try {
      await env.KEYWORD_RESEARCH_QUEUE.send({
        schema_version: "CompetitorKeywordQueueMessage.v1",
        phase: "CLASSIFY",
        job_id: job.job_id,
        offset: nextOffset,
      });
    } catch {
      try {
        await env.CORE_DB.prepare(
          `UPDATE competitor_keyword_research_jobs SET classification_offset=?
           WHERE job_id=? AND status='CLASSIFYING' AND classification_offset=?`
        ).bind(offset, job.job_id, nextOffset).run();
      } catch {}
      throw new ResearchError("CLASSIFICATION_ERROR", "Failed to publish the next classification page", {
        stage: "CLASSIFICATION", retryable: true,
      });
    }
    return;
  }
  await completeClassifiedJob(env.CORE_DB, job, offset, nextOffset);
}

async function finalizeJobIfReady(env, jobId) {
  const db = env.CORE_DB;
  const counts = await jobStateCounts(db, jobId);
  const succeeded = Number(counts?.succeeded || 0);
  const failed = Number(counts?.failed || 0);
  const pending = Number(counts?.pending || 0);
  const rawCount = Number(counts?.raw_count || 0);
  await db.prepare(
    `UPDATE competitor_keyword_research_jobs
     SET successful_asin_count=?, failed_asin_count=?, raw_keyword_count=? WHERE job_id=?`
  ).bind(succeeded, failed, rawCount, jobId).run();
  if (pending > 0) return;

  if (succeeded === 0) {
    const completedAt = nowIso();
    await db.prepare(
      `UPDATE competitor_keyword_research_jobs
       SET status='FAILED', failed_asin_count=?, completed_at=?, observed_at=?,
           error_stage='SIF_CALL', error_code='ALL_ASINS_FAILED',
           error_message='所有 ASIN 均未完成关键词查询'
       WHERE job_id=? AND status NOT IN ('SUCCEEDED','PARTIAL','FAILED')`
    ).bind(failed, completedAt, completedAt, jobId).run();
    return;
  }

  const uniqueRow = await db.prepare(
    `SELECT COUNT(DISTINCT keyword_id) AS unique_count
     FROM competitor_keyword_sources WHERE job_id=?`
  ).bind(jobId).first();
  const uniqueCount = Number(uniqueRow?.unique_count || 0);
  await db.prepare(
    `UPDATE competitor_keyword_research_jobs
     SET unique_keyword_count=?, duplicate_keyword_count=? WHERE job_id=?`
  ).bind(uniqueCount, Math.max(0, rawCount - uniqueCount), jobId).run();

  const claim = await db.prepare(
    `UPDATE competitor_keyword_research_jobs
     SET status='CLASSIFICATION_PENDING', classification_offset=0
     WHERE job_id=? AND status NOT IN ('CLASSIFICATION_PENDING','CLASSIFYING','SUCCEEDED','PARTIAL','FAILED')`
  ).bind(jobId).run();
  const current = Number(claim?.meta?.changes || 0) ? { status: "CLASSIFICATION_PENDING" } : await loadJob(db, jobId);
  if (current?.status !== "CLASSIFICATION_PENDING") return;
  try {
    await env.KEYWORD_RESEARCH_QUEUE.send({
      schema_version: "CompetitorKeywordQueueMessage.v1",
      phase: "CLASSIFY",
      job_id: jobId,
      offset: 0,
    });
    await db.prepare(
      `UPDATE competitor_keyword_research_jobs SET status='CLASSIFYING'
       WHERE job_id=? AND status='CLASSIFICATION_PENDING'`
    ).bind(jobId).run();
  } catch {
    throw new ResearchError("CLASSIFICATION_ERROR", "Failed to start classification", {
      stage: "CLASSIFICATION", retryable: true,
    });
  }
}

function validQueueBody(body) {
  if (!body || body.schema_version !== "CompetitorKeywordQueueMessage.v1"
    || !/^[0-9a-f-]{36}$/i.test(String(body.job_id || ""))) return false;
  if (body.phase === "CLASSIFY") return Number.isInteger(body.offset) && body.offset >= 0;
  return body.phase === "FETCH"
    && /^[A-Z0-9]{10}$/.test(String(body.asin || ""))
    && Number.isInteger(body.page_num) && body.page_num >= 1 && body.page_num <= MAX_PAGES_PER_ASIN;
}

export async function processResearchQueue(batch, env) {
  for (const message of batch.messages) {
    const body = message.body;
    if (!validQueueBody(body)) {
      message.ack();
      continue;
    }
    try {
      if (body.phase === "CLASSIFY") await processClassificationPage(env, body);
      else await processOneAsinPage(env, body);
      message.ack();
    } catch (error) {
      const detail = publicResearchError(error);
      const attempts = Number(message.attempts || 1);
      const unknownRuntimeError = !(error instanceof ResearchError) && !(error instanceof SifClientError);
      const retryable = (detail.retryable || unknownRuntimeError) && attempts <= 4;
      if (body.phase === "CLASSIFY" || detail.stage === "CLASSIFICATION") {
        if (!retryable && env.CORE_DB) {
          try {
            const statusGuard = body.phase === "CLASSIFY"
              ? "status IN ('CLASSIFICATION_PENDING','CLASSIFYING')"
              : "status='CLASSIFICATION_PENDING'";
            await env.CORE_DB.prepare(
              `UPDATE competitor_keyword_research_jobs
               SET status='FAILED', error_stage='CLASSIFICATION', error_code='CLASSIFICATION_ERROR',
                   error_message='关键词分类在有限重试后仍未完成', completed_at=?
               WHERE job_id=? AND ${statusGuard}`
            ).bind(nowIso(), body.job_id).run();
          } catch {}
        }
        if (retryable) message.retry({ delaySeconds: Math.min(300, attempts * 30) });
        else message.ack();
        continue;
      }
      if (detail.code === "FETCH_PAGE_BUSY" || detail.code === "FETCH_PREDECESSOR_PENDING") {
        if (retryable) message.retry({ delaySeconds: Math.min(300, Math.max(90, attempts * 60)) });
        else message.ack();
        continue;
      }
      try {
        if (env.CORE_DB) {
          await markAsinError(
            env.CORE_DB, body.job_id, body.asin, detail,
            retryable ? "RETRYING" : "FAILED", error?.fetchClaimToken || null
          );
          if (!retryable) await finalizeJobIfReady(env, body.job_id);
        }
      } catch {}
      if (retryable) message.retry({ delaySeconds: Math.min(300, attempts * 30) });
      else message.ack();
    }
  }
}
