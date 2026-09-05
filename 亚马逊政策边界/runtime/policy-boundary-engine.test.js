'use strict';
const assert = require('assert');
const e = require('./policy-boundary-engine');

const policy={evidence_id:'PE-1',domain:'Pricing',marketplace:'US',confidence:'HIGH',policy_state:'ACTIVE',expected_state:{eligible:true,rule:'verified'}};
const observed={domain_no:'06',domain:'Pricing',marketplace:'US',observed_state:{eligible:false,rule:'verified'},evidence_ref:'OBS-1',freshness:'FRESH',read_only:true,amazon_write:false,ads_write:false,execution_authorized:false};

const diff=e.compareExpectedObserved(policy,observed);
assert.equal(diff.ok,true); assert.equal(diff.differs,true); assert.equal(diff.executionAuthorized,false);

assert.equal(e.evaluateBoundarySignal({...diff,materiality:{material:true},persistence:{repeat_count:1,persistent:false},scope_consistent:true,evidence_quality:'HIGH'}).ok,false);
const signal=e.evaluateBoundarySignal({...diff,materiality:{material:true},persistence:{repeat_count:2,persistent:true},scope_consistent:true,evidence_quality:'HIGH'});
assert.equal(signal.stage,'BOUNDARY_SIGNAL');

assert.equal(e.verifyBoundaryCandidate({signal_verified:true,policy_evidence_check:'PASS',repeated_state_check:'PASS',alternative_explanation_review:'INCONCLUSIVE'}).ok,false);
const candidate=e.verifyBoundaryCandidate({signal_verified:true,policy_evidence_check:'PASS',repeated_state_check:'PASS',alternative_explanation_review:'PASS_NO_BETTER_EXPLANATION'});
assert.equal(candidate.stage,'BOUNDARY_CANDIDATE');

const confirmed=e.confirmBoundaryResult({candidate_verified:true,confidence:'HIGH',domain_no:'06',sequence:1,result_name:'Reference price eligibility state differs persistently from verified expected state',policy_allowed:'UNKNOWN',technically_possible:'YES',not_currently_punished:'YES',long_term_sustainable:'UNKNOWN',affected_product_refs:['P1','P1']});
assert.equal(confirmed.caseId,'APB-06-BR-0001');
assert.equal(confirmed.affectedProductRefs.length,1);
assert.equal(confirmed.executionAuthorized,false);
assert.equal(confirmed.amazonWrite,false);

const impacts=e.mapProductImpacts([confirmed]);
assert.equal(impacts.ok,true); assert.equal(impacts.productImpacts.P1.length,1);

const unsafe=e.compareExpectedObserved(policy,{...observed,read_only:false});
assert.equal(unsafe.ok,false);
console.log('policy-boundary-engine.test: PASS');
