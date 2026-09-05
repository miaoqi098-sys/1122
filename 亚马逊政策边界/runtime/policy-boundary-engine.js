'use strict';

const DOMAIN_NUMBERS = new Set(Array.from({length:18}, (_,i)=>String(i+1).padStart(2,'0')));
const TYPES = {PE:'POLICY_EVIDENCE',PD:'POLICY_DIFF',BS:'BOUNDARY_SIGNAL',BC:'BOUNDARY_CANDIDATE',BR:'CONFIRMED_BOUNDARY_RESULT',PI:'PRODUCT_IMPACT'};

function fail(reason){ return {ok:false, reason, readOnly:true, executionAuthorized:false, productionWriteAuthorized:false}; }
function stable(v){ return JSON.stringify(v, Object.keys(v||{}).sort()); }
function same(a,b){ return stable(a) === stable(b); }

function validateCommon(policy, observed){
  if(!policy || !observed) return fail('missing_policy_or_observed_evidence');
  if(!DOMAIN_NUMBERS.has(String(observed.domain_no||''))) return fail('unsupported_domain');
  if(policy.marketplace !== observed.marketplace) return fail('marketplace_mismatch');
  if(String(policy.domain||'') !== String(observed.domain||'')) return fail('domain_mismatch');
  if(observed.read_only !== true) return fail('observed_state_not_read_only');
  if(observed.amazon_write === true || observed.ads_write === true || observed.execution_authorized === true) return fail('mutation_authority_rejected');
  if(!['HIGH','MEDIUM'].includes(policy.confidence)) return fail('policy_evidence_not_verified_enough');
  if(['CONFLICTING_EVIDENCE','UNKNOWN'].includes(policy.policy_state)) return fail('policy_evidence_conflicted_or_unknown');
  if(['STALE','UNKNOWN'].includes(observed.freshness)) return fail('observed_state_not_fresh_enough');
  return null;
}

function compareExpectedObserved(policy, observed){
  const bad = validateCommon(policy, observed); if(bad) return bad;
  const differs = !same(policy.expected_state, observed.observed_state);
  return {
    ok:true,
    differs,
    stage: differs ? 'DIFFERENCE' : 'MATCH',
    expectedState:policy.expected_state,
    observedState:observed.observed_state,
    policyEvidenceRef:policy.evidence_id,
    observedEvidenceRef:observed.evidence_ref,
    readOnly:true,
    executionAuthorized:false,
    productionWriteAuthorized:false
  };
}

function evaluateBoundarySignal(input){
  if(!input || input.differs !== true) return fail('no_material_difference');
  const m = input.materiality || {};
  const p = input.persistence || {};
  if(m.material !== true) return fail('materiality_threshold_not_met');
  if(p.repeat_count < 2 || p.persistent !== true) return fail('persistence_threshold_not_met');
  if(input.scope_consistent !== true) return fail('scope_consistency_not_met');
  if(!['HIGH','MEDIUM'].includes(input.evidence_quality)) return fail('evidence_quality_not_met');
  return {ok:true, stage:'BOUNDARY_SIGNAL', reasonCodes:['material_difference','persistent_difference','scope_consistent'], readOnly:true, executionAuthorized:false, productionWriteAuthorized:false};
}

function verifyBoundaryCandidate(input){
  if(!input || input.signal_verified !== true) return fail('verified_boundary_signal_required');
  if(input.policy_evidence_check !== 'PASS') return fail('policy_evidence_check_failed');
  if(input.repeated_state_check !== 'PASS') return fail('repeated_state_check_failed');
  if(input.alternative_explanation_review !== 'PASS_NO_BETTER_EXPLANATION') return fail('alternative_explanation_not_cleared');
  return {ok:true, stage:'BOUNDARY_CANDIDATE', readOnly:true, executionAuthorized:false, productionWriteAuthorized:false};
}

function confirmBoundaryResult(input){
  if(!input || input.candidate_verified !== true) return fail('verified_boundary_candidate_required');
  if(!['HIGH','MEDIUM'].includes(input.confidence)) return fail('confidence_insufficient');
  if(input.policy_allowed === undefined || input.technically_possible === undefined || input.not_currently_punished === undefined || input.long_term_sustainable === undefined) return fail('four_way_boundary_required');
  const no = String(input.domain_no||'');
  if(!DOMAIN_NUMBERS.has(no)) return fail('unsupported_domain');
  const sequence = String(input.sequence||1).padStart(4,'0');
  return {
    ok:true,
    stage:'CONFIRMED_BOUNDARY_RESULT',
    caseId:`APB-${no}-BR-${sequence}`,
    resultName:input.result_name || null,
    policyAllowed:input.policy_allowed,
    technicallyPossible:input.technically_possible,
    notCurrentlyPunished:input.not_currently_punished,
    longTermSustainable:input.long_term_sustainable,
    affectedProductRefs:Array.isArray(input.affected_product_refs)?[...new Set(input.affected_product_refs)]:[],
    readOnly:true,
    actionRequestAuthorized:false,
    executionAuthorized:false,
    amazonWrite:false,
    adsWrite:false,
    financialMutation:false,
    permissionMutation:false,
    productionWriteAuthorized:false
  };
}

function mapProductImpacts(cases){
  if(!Array.isArray(cases)) return fail('cases_array_required');
  const byProduct = {};
  for(const c of cases){
    if(!c || c.stage !== 'CONFIRMED_BOUNDARY_RESULT') continue;
    for(const productRef of (c.affectedProductRefs||[])){
      if(!byProduct[productRef]) byProduct[productRef]=[];
      byProduct[productRef].push({case_id:c.caseId, domain_no:c.caseId.slice(4,6), status:'CONFIRMED', confidence:c.confidence||'MEDIUM', result_name:c.resultName||null});
    }
  }
  return {ok:true, productImpacts:byProduct, readOnly:true, executionAuthorized:false, productionWriteAuthorized:false};
}

module.exports={compareExpectedObserved,evaluateBoundarySignal,verifyBoundaryCandidate,confirmBoundaryResult,mapProductImpacts,TYPES};
