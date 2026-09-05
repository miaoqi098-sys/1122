window.__1122_DATA__ = {
  navigation: [
    {id:'command-center',label:'经营指挥中心',icon:'◈',route:'#/command-center'},
    {id:'selection',label:'选品',icon:'◉',route:'#/selection'},
    {id:'operations',label:'运营',icon:'▦',route:'#/operations',children:[
      {id:'products',label:'产品',route:'#/operations/products'},
      {id:'inventory-logistics',label:'库存物流',route:'#/operations/inventory-logistics'},
      {id:'offsite',label:'站外推广',route:'#/operations/offsite'},
      {id:'competitors',label:'竞品',route:'#/operations/competitors'},
      {id:'ads',label:'广告',route:'#/operations/ads'}
    ]},
    {id:'sandbox',label:'沙盘演练',icon:'◇',route:'#/sandbox'},
    {id:'governance',label:'系统政策边界',icon:'⌘',route:'#/governance'},
    {id:'amazon-boundary',label:'亚马逊经营边界探索',icon:'◎',route:'#/amazon-boundary',badge:'重点',children:[
      {id:'apr',label:'APR 市场玩法探索',route:'#/amazon-boundary/apr'},
      {id:'aom',label:'AOM 正向运营方法',route:'#/amazon-boundary/aom'},
      {id:'apb',label:'APB 政策与边界证据',route:'#/amazon-boundary/apb'}
    ]},
    {id:'agents',label:'Agent',icon:'✦',route:'#/agents'},
    {id:'skills',label:'技能',icon:'⌁',route:'#/skills'},
    {id:'connectors',label:'对外连接',icon:'⇄',route:'#/connectors'},
    {id:'tasks',label:'任务中心',icon:'☑',route:'#/tasks'},
    {id:'knowledge',label:'知识',icon:'◇',route:'#/knowledge'},
    {id:'memory',label:'记忆',icon:'◫',route:'#/memory'},
    {id:'data',label:'数据',icon:'▤',route:'#/data'}
  ],
  apr: [
    {
      apr_id:'APR-01-0001',domain_no:'01',domain:'Review',pattern_name_cn:'跨商品身份/变体关系的评论聚合模式',business_goal:'快速提升主卖商品的可见 Review 数量与社会证明',observation_status:'DISCOVERED',policy_relation:'NONCOMPLIANT',business_value_signal:'POSITIVE',confidence:'LOW',
      observed_effect:'短期可能出现 Review 数量集中、社会证明增强和转化变化；持续性需要重复观测。',
      sustainability:'UNKNOWN', detection_signals:['商品历史与当前身份明显不一致','变体成员核心功能/商品类型不一致','Review 内容与当前商品语义错位','目录属性历史出现异常跨度变化']
    }
  ],
  aom: [
    {method_id:'AOM-01-0001',domain_no:'01',domain:'Review',method_name_cn:'Amazon Vine 新品评价加速',objective:'在合规前提下加速新品获得真实高质量 Review',policy_status:'VERIFIED_ALLOWED',risk_level:'LOW',execution_mode:'AMAZON_PROGRAM',impact:'提高新品期真实 Review 数量与内容深度',measurement:['new_review_count','review_velocity','star_rating','CVR']},
    {method_id:'AOM-01-0002',domain_no:'01',domain:'Review',method_name_cn:'Seller Central Request a Review 标准邀评',objective:'提高已成交订单的合规邀评覆盖率',policy_status:'VERIFIED_ALLOWED',risk_level:'LOW',execution_mode:'SELLER_CENTRAL_FEATURE',impact:'提高 Review 请求覆盖率与自然 Review 产生概率',measurement:['request_coverage_rate','new_review_count','review_rate']},
    {method_id:'AOM-01-0003',domain_no:'01',domain:'Review',method_name_cn:'Review 主题驱动的产品体验修复循环',objective:'减少差评根因并提升长期星级稳定性',policy_status:'VERIFIED_ALLOWED',risk_level:'LOW',execution_mode:'SYSTEM_RECOMMENDATION_ONLY',impact:'降低重复差评主题、改善产品体验与转化',measurement:['negative_theme_rate','return_rate','star_rating','CVR']}
  ],
  apb: [
    {case_id:'APB-01-PE-0001',domain_no:'01',domain:'Review',result_type:'POLICY_EVIDENCE',status:'SEEDED',title_cn:'评论操纵与激励评价官方政策入口已建立',confidence:'MEDIUM'},
    {case_id:'APB-02-PE-0001',domain_no:'02',domain:'Variation',result_type:'POLICY_EVIDENCE',status:'SEEDED',title_cn:'变体创建与更新官方政策入口已建立',confidence:'MEDIUM'},
    {case_id:'APB-06-PD-0001',domain_no:'06',domain:'Pricing',result_type:'POLICY_DIFF',status:'SEEDED',title_cn:'2026 List Price 验证规则变化已进入政策变化中心',confidence:'MEDIUM'},
    {case_id:'APB-06-PD-0002',domain_no:'06',domain:'Pricing',result_type:'POLICY_DIFF',status:'SEEDED',title_cn:'2026 Typical/Was Price 计算变化已进入政策变化中心',confidence:'MEDIUM'},
    {case_id:'APB-07-PE-0001',domain_no:'07',domain:'Promotion',result_type:'POLICY_EVIDENCE',status:'SEEDED',title_cn:'促销质量与历史价格相互作用入口已建立',confidence:'MEDIUM'},
    {case_id:'APB-08-PE-0001',domain_no:'08',domain:'Advertising',result_type:'POLICY_EVIDENCE',status:'SEEDED',title_cn:'Amazon Ads 全球广告政策与禁限投入口已建立',confidence:'MEDIUM'}
  ],
  domains: [
    ['01','Review','评论与评价','SEEDED'],['02','Variation','变体','SEEDED'],['03','Catalog','目录','DISCOVERY'],['04','Offer','报价与 Offer','DISCOVERY'],['05','Featured Offer','Featured Offer','DISCOVERY'],['06','Pricing','定价与参考价','SEEDED'],['07','Promotion','促销与活动','SEEDED'],['08','Advertising','广告政策','SEEDED'],['09','Search','搜索与索引','DISCOVERY'],['10','BSR','BSR 与排名','DISCOVERY'],['11','Brand','品牌','DISCOVERY'],['12','Content','Listing 与内容','DISCOVERY'],['13','Inventory','库存','DISCOVERY'],['14','Logistics','FBA 与物流','DISCOVERY'],['15','Returns','退货与退款','DISCOVERY'],['16','Account','账户健康','DISCOVERY'],['17','Compliance','商品合规','DISCOVERY'],['18','Enforcement','违规处置与申诉','DISCOVERY']
  ]
};
