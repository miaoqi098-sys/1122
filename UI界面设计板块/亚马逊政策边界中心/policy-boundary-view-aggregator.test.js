'use strict';
const assert=require('assert');
const {aggregate}=require('./policy-boundary-view-aggregator');
const coverage=[
 {domain_no:'01',coverage_status:'SEEDED'},
 {domain_no:'06',coverage_status:'VERIFIED'},
 {domain_no:'08',coverage_status:'SEEDED'}
];
const results=[
 {case_id:'APB-06-PD-0001',domain_no:'06',domain:'Pricing',result_type:'POLICY_DIFF',status:'VERIFIED',title_cn:'价格规则变化',confidence:'HIGH',updated_at:'2026-09-05T00:00:00Z',policy_evidence_refs:['PE1'],observed_evidence_refs:[]},
 {case_id:'APB-06-BR-0001',domain_no:'06',domain:'Pricing',result_type:'CONFIRMED_BOUNDARY_RESULT',status:'CONFIRMED',title_cn:'已确认结果',confidence:'HIGH',updated_at:'2026-09-05T01:00:00Z',affected_product_refs:['P1'],policy_evidence_refs:['PE1'],observed_evidence_refs:['OBS1']}
];
const v=aggregate({marketplace:'US',coverage,results,generated_at:'2026-09-05T02:00:00Z'});
assert.equal(v.domain_cards.length,18);
assert.equal(v.summary.domain_total,18);
assert.equal(v.summary.verified_count,1);
assert.equal(v.summary.confirmed_result_count,1);
assert.equal(v.result_rows[0].case_id,'APB-06-BR-0001');
assert.equal(v.execution_authorized,false);
assert.equal(v.domain_cards.find(x=>x.domain_no==='18').coverage_status,'UNKNOWN');
console.log('policy-boundary-view-aggregator.test: PASS');
