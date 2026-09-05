function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

export async function loadOperatingIntelligence(db, marketplace = 'US') {
  if (!db) return null;
  const market = String(marketplace || 'US').toUpperCase();
  try {
    const [aprRows, aomRows, apbRows] = await Promise.all([
      db.prepare(`
        SELECT apr_id, domain_no, domain, pattern_name_cn, business_goal,
               observation_status, policy_relation, business_value_signal,
               confidence, observed_structure, observed_effect,
               observed_duration_json, detection_signals_json,
               evidence_refs_json, source_refs_json, source_version,
               created_at
        FROM amazon_adversarial_pattern_ref
        WHERE marketplace = ? AND is_current = 1 AND ui_visibility = 1
        ORDER BY domain_no, apr_id
      `).bind(market).all(),
      db.prepare(`
        SELECT method_id, domain_no, domain, method_name_cn, method_name_en,
               objective, policy_status, risk_level, execution_mode,
               applicable_conditions_json, not_applicable_conditions_json,
               steps_json, cost_model_json, expected_impact_json,
               measurement_json, evidence_refs_json, source_urls_json,
               affected_product_refs_json, last_verified_at, source_version,
               created_at
        FROM amazon_operating_method
        WHERE marketplace = ? AND is_current = 1
        ORDER BY domain_no, method_id
      `).bind(market).all(),
      db.prepare(`
        SELECT case_id, domain_no, domain, result_type, status, title_cn,
               confidence, last_verified_at, created_at, updated_at
        FROM amazon_boundary_result_case
        WHERE marketplace = ?
        ORDER BY domain_no, case_id
      `).bind(market).all(),
    ]);

    const apr = (aprRows?.results || []).map(r => ({
      apr_id:r.apr_id, domain_no:r.domain_no, domain:r.domain,
      pattern_name_cn:r.pattern_name_cn, business_goal:r.business_goal,
      observation_status:r.observation_status, policy_relation:r.policy_relation,
      business_value_signal:r.business_value_signal, confidence:r.confidence,
      observed_structure:r.observed_structure, observed_effect:r.observed_effect,
      observed_duration:parseJson(r.observed_duration_json, {}),
      detection_signals:parseJson(r.detection_signals_json, []),
      evidence_refs:parseJson(r.evidence_refs_json, []),
      source_refs:parseJson(r.source_refs_json, []),
      source_version:r.source_version, persisted_at:r.created_at,
      operationalization_mode:'NON_EXECUTABLE_REFERENCE',
      execution_authorized:false, production_write_authorized:false,
    }));

    const aom = (aomRows?.results || []).map(r => ({
      method_id:r.method_id, domain_no:r.domain_no, domain:r.domain,
      method_name_cn:r.method_name_cn, method_name_en:r.method_name_en,
      objective:r.objective, policy_status:r.policy_status, risk_level:r.risk_level,
      execution_mode:r.execution_mode,
      applicable_conditions:parseJson(r.applicable_conditions_json, []),
      not_applicable_conditions:parseJson(r.not_applicable_conditions_json, []),
      steps:parseJson(r.steps_json, []), cost_model:parseJson(r.cost_model_json, {}),
      expected_impact:parseJson(r.expected_impact_json, {}),
      impact:parseJson(r.expected_impact_json, {}).primary || null,
      measurement:parseJson(r.measurement_json, []),
      evidence_refs:parseJson(r.evidence_refs_json, []),
      source_urls:parseJson(r.source_urls_json, []),
      affected_product_refs:parseJson(r.affected_product_refs_json, []),
      last_verified_at:r.last_verified_at, source_version:r.source_version,
      persisted_at:r.created_at, execution_authorized:false,
    }));

    const apb = (apbRows?.results || []).map(r => ({
      case_id:r.case_id, domain_no:r.domain_no, domain:r.domain,
      result_type:r.result_type, status:r.status, title_cn:r.title_cn,
      confidence:r.confidence, last_verified_at:r.last_verified_at,
      persisted_at:r.created_at, updated_at:r.updated_at,
      execution_authorized:false,
    }));

    return { apr, aom, apb };
  } catch (error) {
    return { error:String(error?.message || error) };
  }
}
