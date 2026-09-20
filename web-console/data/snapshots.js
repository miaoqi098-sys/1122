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
      {id:'apr',label:'市场玩法探索',route:'#/amazon-boundary/apr'},
      {id:'aom',label:'正向运营方法',route:'#/amazon-boundary/aom'},
      {id:'apb',label:'政策与边界证据',route:'#/amazon-boundary/apb'}
    ]},
    {id:'agents',label:'智能助手',icon:'✦',route:'#/agents'},
    {id:'skills',label:'技能',icon:'⌁',route:'#/skills'},
    {id:'connectors',label:'对外连接',icon:'⇄',route:'#/connectors'},
    {id:'tasks',label:'任务中心',icon:'☑',route:'#/tasks'},
    {id:'knowledge',label:'知识',icon:'◇',route:'#/knowledge'},
    {id:'memory',label:'记忆',icon:'◫',route:'#/memory'},
    {id:'data',label:'数据',icon:'▤',route:'#/data'}
  ],
  apr: [
    {
      apr_id:'APR-01-0001',domain_no:'01',domain:'评论与评价',pattern_name_cn:'跨商品身份/变体关系的评论聚合模式',business_goal:'快速提升主卖商品的可见评价数量与社会证明',observation_status:'DISCOVERED',policy_relation:'NONCOMPLIANT',business_value_signal:'POSITIVE',confidence:'LOW',
      observed_effect:'短期可能出现评价数量集中、社会证明增强和转化变化；持续性需要重复观测。',
      sustainability:'UNKNOWN', detection_signals:['商品历史与当前身份明显不一致','变体成员核心功能/商品类型不一致','评价内容与当前商品语义错位','目录属性历史出现异常跨度变化']
    }
  ],
  aom: [
    {method_id:'AOM-01-0001',domain_no:'01',domain:'评论与评价',method_name_cn:'新品评价计划加速',objective:'在合规前提下加速新品获得真实高质量评价',policy_status:'VERIFIED_ALLOWED',risk_level:'LOW',execution_mode:'AMAZON_PROGRAM',impact:'提高新品期真实评价数量与内容深度',measurement:['新增评价数','评价增长速度','星级评分','转化率']},
    {method_id:'AOM-01-0002',domain_no:'01',domain:'评论与评价',method_name_cn:'标准邀评',objective:'提高已成交订单的合规邀评覆盖率',policy_status:'VERIFIED_ALLOWED',risk_level:'LOW',execution_mode:'SELLER_CENTRAL_FEATURE',impact:'提高评价请求覆盖率与自然评价产生概率',measurement:['邀评覆盖率','新增评价数','评价产生率']},
    {method_id:'AOM-01-0003',domain_no:'01',domain:'评论与评价',method_name_cn:'评价主题驱动的产品体验修复循环',objective:'减少差评根因并提升长期星级稳定性',policy_status:'VERIFIED_ALLOWED',risk_level:'LOW',execution_mode:'SYSTEM_RECOMMENDATION_ONLY',impact:'降低重复差评主题、改善产品体验与转化',measurement:['负面主题占比','退货率','星级评分','转化率']}
  ],
  apb: [
    {case_id:'APB-01-PE-0001',domain_no:'01',domain:'评论与评价',result_type:'POLICY_EVIDENCE',status:'SEEDED',title_cn:'评论操纵与激励评价官方政策入口已建立',confidence:'MEDIUM'},
    {case_id:'APB-02-PE-0001',domain_no:'02',domain:'变体',result_type:'POLICY_EVIDENCE',status:'SEEDED',title_cn:'变体创建与更新官方政策入口已建立',confidence:'MEDIUM'},
    {case_id:'APB-06-PD-0001',domain_no:'06',domain:'定价与参考价',result_type:'POLICY_DIFF',status:'SEEDED',title_cn:'2026 标价验证规则变化已进入政策变化中心',confidence:'MEDIUM'},
    {case_id:'APB-06-PD-0002',domain_no:'06',domain:'定价与参考价',result_type:'POLICY_DIFF',status:'SEEDED',title_cn:'2026 常见价格计算变化已进入政策变化中心',confidence:'MEDIUM'},
    {case_id:'APB-07-PE-0001',domain_no:'07',domain:'促销与活动',result_type:'POLICY_EVIDENCE',status:'SEEDED',title_cn:'促销质量与历史价格相互作用入口已建立',confidence:'MEDIUM'},
    {case_id:'APB-08-PE-0001',domain_no:'08',domain:'广告政策',result_type:'POLICY_EVIDENCE',status:'SEEDED',title_cn:'全球广告政策与禁限投入口已建立',confidence:'MEDIUM'}
  ],
  domains: [
    ['01','评论与评价','评论与评价','SEEDED'],['02','变体','变体','SEEDED'],['03','目录','目录','DISCOVERY'],['04','报价','报价','DISCOVERY'],['05','特色报价','特色报价','DISCOVERY'],['06','定价与参考价','定价与参考价','SEEDED'],['07','促销与活动','促销与活动','SEEDED'],['08','广告政策','广告政策','SEEDED'],['09','搜索与索引','搜索与索引','DISCOVERY'],['10','排名','排名','DISCOVERY'],['11','品牌','品牌','DISCOVERY'],['12','商品详情页与内容','商品详情页与内容','DISCOVERY'],['13','库存','库存','DISCOVERY'],['14','平台仓配与物流','平台仓配与物流','DISCOVERY'],['15','退货与退款','退货与退款','DISCOVERY'],['16','账户健康','账户健康','DISCOVERY'],['17','商品合规','商品合规','DISCOVERY'],['18','违规处置与申诉','违规处置与申诉','DISCOVERY']
  ]
};
