'use strict';

const DOMAIN_NAMES={
 '01':'评论与评价','02':'变体','03':'目录','04':'报价与Offer','05':'Featured Offer','06':'定价与参考价','07':'促销与活动','08':'广告政策','09':'搜索与索引','10':'BSR与排名','11':'品牌','12':'Listing与内容','13':'库存','14':'FBA与物流','15':'退货与退款','16':'账户健康','17':'商品合规','18':'违规处置与申诉'
};
const COVERAGE=new Set(['DISCOVERY','SEEDED','VERIFIED','CONFLICT','UNKNOWN']);

function aggregate({marketplace='US', coverage=[], results=[], generated_at=new Date().toISOString()}={}){
  if(!Array.isArray(coverage)||!Array.isArray(results)) throw new Error('coverage_and_results_arrays_required');
  const map=new Map();
  for(const d of coverage){
    if(!d || !DOMAIN_NAMES[d.domain_no] || !COVERAGE.has(d.coverage_status)) throw new Error('invalid_domain_coverage');
    if(map.has(d.domain_no)) throw new Error('duplicate_domain_no');
    map.set(d.domain_no,d.coverage_status);
  }
  for(const no of Object.keys(DOMAIN_NAMES)) if(!map.has(no)) map.set(no,'UNKNOWN');
  const domainCards=Object.keys(DOMAIN_NAMES).map(no=>{
    const rows=results.filter(r=>r.domain_no===no);
    return {
      domain_no:no,
      domain_code:(rows[0]&&rows[0].domain)||'UNKNOWN',
      name_cn:DOMAIN_NAMES[no],
      coverage_status:map.get(no),
      policy_evidence_count:rows.filter(r=>r.result_type==='POLICY_EVIDENCE').length,
      policy_diff_count:rows.filter(r=>r.result_type==='POLICY_DIFF').length,
      signal_count:rows.filter(r=>r.result_type==='BOUNDARY_SIGNAL').length,
      candidate_count:rows.filter(r=>r.result_type==='BOUNDARY_CANDIDATE').length,
      confirmed_count:rows.filter(r=>r.result_type==='CONFIRMED_BOUNDARY_RESULT').length,
      last_verified_at:null
    };
  });
  const resultRows=[...results].sort((a,b)=>String(a.domain_no).localeCompare(String(b.domain_no)) || String(b.updated_at||'').localeCompare(String(a.updated_at||''))).map(r=>({
    case_id:r.case_id,domain_no:r.domain_no,domain_name_cn:DOMAIN_NAMES[r.domain_no]||'未知',marketplace:r.marketplace||marketplace,result_type:r.result_type,status:r.status,title_cn:r.title_cn||null,summary_cn:r.summary_cn||null,confidence:r.confidence||'UNVERIFIED',affected_product_count:Array.isArray(r.affected_product_refs)?r.affected_product_refs.length:0,last_verified_at:r.last_verified_at||null,updated_at:r.updated_at||generated_at,evidence_count:(r.policy_evidence_refs||[]).length+(r.observed_evidence_refs||[]).length
  }));
  return {
    generated_at, marketplace,
    summary:{domain_total:18,verified_count:domainCards.filter(x=>x.coverage_status==='VERIFIED').length,seeded_count:domainCards.filter(x=>x.coverage_status==='SEEDED').length,discovery_count:domainCards.filter(x=>x.coverage_status==='DISCOVERY').length,conflict_count:domainCards.filter(x=>x.coverage_status==='CONFLICT').length,policy_diff_count:resultRows.filter(x=>x.result_type==='POLICY_DIFF').length,boundary_signal_count:resultRows.filter(x=>x.result_type==='BOUNDARY_SIGNAL').length,confirmed_result_count:resultRows.filter(x=>x.result_type==='CONFIRMED_BOUNDARY_RESULT').length},
    domain_cards:domainCards,
    result_rows:resultRows,
    policy_change_feed:resultRows.filter(x=>x.result_type==='POLICY_DIFF'),
    product_impacts:resultRows.filter(x=>x.result_type==='PRODUCT_IMPACT'),
    section_status:{coverage:'fresh',results:'fresh'},
    view_status:'complete',
    execution_authorized:false
  };
}
module.exports={aggregate};
