function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function clampLimit(value) {
  const n = Number(value || 30);
  if (!Number.isFinite(n)) return 30;
  return Math.max(1, Math.min(100, Math.floor(n)));
}

export async function searchKnowledge(db, params = {}) {
  if (!db) return { items:[], total:0, source_status:'UNAVAILABLE' };

  const q = String(params.q || '').trim();
  const knowledgeType = String(params.knowledge_type || '').trim();
  const domain = String(params.domain || '').trim();
  const marketplace = String(params.marketplace || '').trim().toUpperCase();
  const truthClass = String(params.truth_class || '').trim();
  const confidence = String(params.confidence || '').trim();
  const status = String(params.status || 'ACTIVE').trim();
  const limit = clampLimit(params.limit);

  const where = ['is_current = 1', 'ui_visibility = 1'];
  const binds = [];

  if (status) { where.push('status = ?'); binds.push(status); }
  if (knowledgeType) { where.push('knowledge_type = ?'); binds.push(knowledgeType); }
  if (domain) { where.push('domain = ?'); binds.push(domain); }
  if (marketplace) { where.push('(marketplace = ? OR marketplace IS NULL)'); binds.push(marketplace); }
  if (truthClass) { where.push('truth_class = ?'); binds.push(truthClass); }
  if (confidence) { where.push('confidence = ?'); binds.push(confidence); }
  if (q) {
    where.push(`(
      knowledge_id LIKE ? OR title LIKE ? OR summary LIKE ? OR content LIKE ? OR keywords_json LIKE ?
    )`);
    const pattern = `%${q}%`;
    binds.push(pattern, pattern, pattern, pattern, pattern);
  }

  const sql = `
    SELECT knowledge_id, record_version, knowledge_type, domain, subdomain,
           marketplace, title, summary, content, keywords_json,
           applicable_conditions_json, not_applicable_conditions_json,
           related_product_refs_json, related_knowledge_refs_json,
           source_refs_json, source_urls_json, truth_class, confidence,
           freshness_status, effective_at, last_verified_at, status,
           created_at, updated_at
    FROM knowledge_items
    WHERE ${where.join(' AND ')}
    ORDER BY
      CASE truth_class
        WHEN 'CONFIRMED' THEN 1
        WHEN 'VALIDATED' THEN 2
        WHEN 'DERIVED' THEN 3
        WHEN 'OBSERVED' THEN 4
        WHEN 'SOURCE_ONLY' THEN 5
        WHEN 'CONFLICTING' THEN 6
        ELSE 7
      END,
      CASE confidence
        WHEN 'HIGH' THEN 1
        WHEN 'MEDIUM' THEN 2
        WHEN 'LOW' THEN 3
        ELSE 4
      END,
      updated_at DESC,
      knowledge_id ASC
    LIMIT ?
  `;

  binds.push(limit);
  const rows = await db.prepare(sql).bind(...binds).all();
  const items = (rows?.results || []).map(r => ({
    knowledge_id:r.knowledge_id,
    version:Number(r.record_version),
    knowledge_type:r.knowledge_type,
    domain:r.domain,
    subdomain:r.subdomain,
    marketplace:r.marketplace,
    title:r.title,
    summary:r.summary,
    content:r.content,
    keywords:parseJson(r.keywords_json, []),
    applicable_conditions:parseJson(r.applicable_conditions_json, []),
    not_applicable_conditions:parseJson(r.not_applicable_conditions_json, []),
    related_product_refs:parseJson(r.related_product_refs_json, []),
    related_knowledge_refs:parseJson(r.related_knowledge_refs_json, []),
    source_refs:parseJson(r.source_refs_json, []),
    source_urls:parseJson(r.source_urls_json, []),
    truth_class:r.truth_class,
    confidence:r.confidence,
    freshness_status:r.freshness_status,
    effective_at:r.effective_at,
    last_verified_at:r.last_verified_at,
    status:r.status,
    created_at:r.created_at,
    updated_at:r.updated_at,
    execution_authorized:false,
    production_write_authorized:false,
  }));

  return {
    items,
    total:items.length,
    query:{ q, knowledge_type:knowledgeType || null, domain:domain || null, marketplace:marketplace || null, truth_class:truthClass || null, confidence:confidence || null, status, limit },
    source_status:'LIVE_D1_READ',
    read_only:true,
    execution_authorized:false,
    production_write_authorized:false,
  };
}

export async function getKnowledgeStats(db) {
  if (!db) return { source_status:'UNAVAILABLE', total:0, by_type:[], by_truth:[] };
  const [totalRow, typeRows, truthRows] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS c FROM knowledge_items WHERE is_current = 1 AND ui_visibility = 1 AND status = 'ACTIVE'`).first(),
    db.prepare(`SELECT knowledge_type AS key, COUNT(*) AS count FROM knowledge_items WHERE is_current = 1 AND ui_visibility = 1 AND status = 'ACTIVE' GROUP BY knowledge_type ORDER BY count DESC, knowledge_type`).all(),
    db.prepare(`SELECT truth_class AS key, COUNT(*) AS count FROM knowledge_items WHERE is_current = 1 AND ui_visibility = 1 AND status = 'ACTIVE' GROUP BY truth_class ORDER BY count DESC, truth_class`).all(),
  ]);
  return {
    total:Number(totalRow?.c || 0),
    by_type:(typeRows?.results || []).map(r=>({key:r.key,count:Number(r.count)})),
    by_truth:(truthRows?.results || []).map(r=>({key:r.key,count:Number(r.count)})),
    source_status:'LIVE_D1_READ',
    read_only:true,
  };
}
