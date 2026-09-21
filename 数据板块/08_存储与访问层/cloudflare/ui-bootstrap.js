import { buildDailyOperatingBrief } from './daily-operating-brief.js';

const APR_SOURCE = [
  {
    apr_id: 'APR-01-0001',
    domain_no: '01',
    domain: 'Review',
    pattern_name_cn: '跨商品身份/变体关系的评论聚合模式',
    business_goal: '快速提升主卖商品的可见 Review 数量与社会证明',
    observation_status: 'DISCOVERED',
    policy_relation: 'NONCOMPLIANT',
    business_value_signal: 'POSITIVE',
    confidence: 'LOW',
    observed_effect: '短期可能出现 Review 数量集中、社会证明增强和转化变化；持续性需要重复观测。',
    sustainability: 'UNKNOWN',
    detection_signals: [
      '商品历史与当前身份明显不一致',
      '变体成员核心功能/商品类型不一致',
      'Review 内容与当前商品语义错位',
      '目录属性历史出现异常跨度变化',
    ],
  },
];

const AOM_SOURCE = [
  { method_id:'AOM-01-0001', domain_no:'01', domain:'Review', method_name_cn:'Amazon Vine 新品评价加速', objective:'在合规前提下加速新品获得真实高质量 Review', policy_status:'VERIFIED_ALLOWED', risk_level:'LOW', execution_mode:'AMAZON_PROGRAM', impact:'提高新品期真实 Review 数量与内容深度', measurement:['new_review_count','review_velocity','star_rating','CVR'] },
  { method_id:'AOM-01-0002', domain_no:'01', domain:'Review', method_name_cn:'Seller Central Request a Review 标准邀评', objective:'提高已成交订单的合规邀评覆盖率', policy_status:'VERIFIED_ALLOWED', risk_level:'LOW', execution_mode:'SELLER_CENTRAL_FEATURE', impact:'提高 Review 请求覆盖率与自然 Review 产生概率', measurement:['request_coverage_rate','new_review_count','review_rate'] },
  { method_id:'AOM-01-0003', domain_no:'01', domain:'Review', method_name_cn:'Review 主题驱动的产品体验修复循环', objective:'减少差评根因并提升长期星级稳定性', policy_status:'VERIFIED_ALLOWED', risk_level:'LOW', execution_mode:'SYSTEM_RECOMMENDATION_ONLY', impact:'降低重复差评主题、改善产品体验与转化', measurement:['negative_theme_rate','return_rate','star_rating','CVR'] },
];

const APB_SOURCE = [
  { case_id:'APB-01-PE-0001', domain_no:'01', domain:'Review', result_type:'POLICY_EVIDENCE', status:'SEEDED', title_cn:'评论操纵与激励评价官方政策入口已建立', confidence:'MEDIUM' },
  { case_id:'APB-02-PE-0001', domain_no:'02', domain:'Variation', result_type:'POLICY_EVIDENCE', status:'SEEDED', title_cn:'变体创建与更新官方政策入口已建立', confidence:'MEDIUM' },
  { case_id:'APB-06-PD-0001', domain_no:'06', domain:'Pricing', result_type:'POLICY_DIFF', status:'SEEDED', title_cn:'2026 List Price 验证规则变化已进入政策变化中心', confidence:'MEDIUM' },
  { case_id:'APB-06-PD-0002', domain_no:'06', domain:'Pricing', result_type:'POLICY_DIFF', status:'SEEDED', title_cn:'2026 Typical/Was Price 计算变化已进入政策变化中心', confidence:'MEDIUM' },
  { case_id:'APB-07-PE-0001', domain_no:'07', domain:'Promotion', result_type:'POLICY_EVIDENCE', status:'SEEDED', title_cn:'促销质量与历史价格相互作用入口已建立', confidence:'MEDIUM' },
  { case_id:'APB-08-PE-0001', domain_no:'08', domain:'Advertising', result_type:'POLICY_EVIDENCE', status:'SEEDED', title_cn:'Amazon Ads 全球广告政策与禁限投入口已建立', confidence:'MEDIUM' },
];

const DOMAINS = [
  ['01','Review','评论与评价','SEEDED'],['02','Variation','变体','SEEDED'],['03','Catalog','目录','DISCOVERY'],['04','Offer','报价与 Offer','DISCOVERY'],['05','Featured Offer','Featured Offer','DISCOVERY'],['06','Pricing','定价与参考价','SEEDED'],['07','Promotion','促销与活动','SEEDED'],['08','Advertising','广告政策','SEEDED'],['09','Search','搜索与索引','DISCOVERY'],['10','BSR','BSR 与排名','DISCOVERY'],['11','Brand','品牌','DISCOVERY'],['12','Content','Listing 与内容','DISCOVERY'],['13','Inventory','库存','DISCOVERY'],['14','Logistics','FBA 与物流','DISCOVERY'],['15','Returns','退货与退款','DISCOVERY'],['16','Account','账户健康','DISCOVERY'],['17','Compliance','商品合规','DISCOVERY'],['18','Enforcement','违规处置与申诉','DISCOVERY'],
];

function numberOrNull(value) {
  return value === null || value === undefined ? null : Number(value);
}

async function queryProducts(db, marketplace) {
  const result = await db.prepare(`
    SELECT
      p.product_id, p.marketplace, p.parent_asin, p.asin, p.sku, p.title, p.brand,
      p.product_type, p.main_image, p.listing_price, p.regular_price, p.currency,
      p.fulfillment_channel, p.source_observed_at, p.updated_at,
      s.business_date, s.stage, s.price, s.sales, s.units, s.orders_count,
      s.sessions, s.page_views, s.conversion_rate, s.ad_spend, s.ad_sales,
      s.acos, s.tacos, s.fulfillable_inventory, s.inbound_inventory,
      s.coverage_days, s.rating, s.review_count, s.contribution_profit,
      s.profit_margin, s.primary_goal, s.observed_at AS state_observed_at
    FROM products p
    LEFT JOIN product_daily_state s
      ON s.product_daily_state_id = (
        SELECT s2.product_daily_state_id
        FROM product_daily_state s2
        WHERE s2.product_id = p.product_id
        ORDER BY s2.business_date DESC, s2.observed_at DESC
        LIMIT 1
      )
    WHERE p.marketplace = ?
    ORDER BY COALESCE(s.business_date, p.updated_at) DESC
    LIMIT 100
  `).bind(marketplace).all();
  return (result?.results || []).map((r) => ({
    product_id:r.product_id, marketplace:r.marketplace, parent_asin:r.parent_asin, asin:r.asin,
    sku:r.sku, title:r.title, brand:r.brand, product_type:r.product_type, main_image:r.main_image,
    listing_price:numberOrNull(r.listing_price), regular_price:numberOrNull(r.regular_price), currency:r.currency,
    fulfillment_channel:r.fulfillment_channel, business_date:r.business_date, stage:r.stage,
    price:numberOrNull(r.price), sales:numberOrNull(r.sales), units:numberOrNull(r.units), orders_count:numberOrNull(r.orders_count),
    sessions:numberOrNull(r.sessions), page_views:numberOrNull(r.page_views), conversion_rate:numberOrNull(r.conversion_rate),
    ad_spend:numberOrNull(r.ad_spend), ad_sales:numberOrNull(r.ad_sales), acos:numberOrNull(r.acos), tacos:numberOrNull(r.tacos),
    fulfillable_inventory:numberOrNull(r.fulfillable_inventory), inbound_inventory:numberOrNull(r.inbound_inventory),
    coverage_days:numberOrNull(r.coverage_days), rating:numberOrNull(r.rating), review_count:numberOrNull(r.review_count),
    contribution_profit:numberOrNull(r.contribution_profit), profit_margin:numberOrNull(r.profit_margin), primary_goal:r.primary_goal,
    source_observed_at:r.source_observed_at, state_observed_at:r.state_observed_at,
  }));
}

async function queryTasks(db, marketplace) {
  const result = await db.prepare(`
    SELECT task_id, decision_id, product_id, marketplace, task_type, task_status,
           approval_status, created_at, updated_at
    FROM tasks
    WHERE marketplace = ? OR marketplace IS NULL
    ORDER BY updated_at DESC
    LIMIT 100
  `).bind(marketplace).all();
  return result?.results || [];
}

async function queryAgentState(db) {
  const rows = await db.prepare(`
    SELECT source_key, status, last_success_at, freshness_status, parser_version, updated_at
    FROM data_source_state
    WHERE source_key LIKE 'a1_%'
    ORDER BY source_key
  `).all();
  return (rows?.results || []).map((r) => ({
    agent_id:'Agent-1', component:r.source_key, status:r.status, last_success_at:r.last_success_at,
    freshness_status:r.freshness_status, runtime_version:r.parser_version, updated_at:r.updated_at,
  }));
}

async function querySourceStatus(db) {
  const rows = await db.prepare(`
    SELECT source_key, source_name, dataset, status, last_success_at, last_attempt_at,
           freshness_status, parser_version, updated_at
    FROM data_source_state
    ORDER BY source_key
  `).all();
  return rows?.results || [];
}

async function queryDailySopReadModel(db, marketplace, products) {
  if (!products.length) return [];
  const [plansResult, metricsResult, eventsResult, validationsResult] = await Promise.all([
    db.prepare(`
      SELECT plan_id, product_id, marketplace, stage, primary_goal, strategy, constraints_json, status, updated_at
      FROM product_operating_plans
      WHERE marketplace = ? AND status IN ('ACTIVE', 'APPROVED', 'PAUSED')
      ORDER BY updated_at DESC
      LIMIT 200
    `).bind(marketplace).all(),
    db.prepare(`
      SELECT product_id, business_date, metric_key, metric_value, prior_value, baseline_7d,
             delta_pct, signal, computed_at
      FROM product_daily_metrics
      WHERE marketplace = ?
      ORDER BY business_date DESC, computed_at DESC
      LIMIT 2000
    `).bind(marketplace).all(),
    db.prepare(`
      SELECT event_id, product_id, event_type, severity, evidence_json, occurred_at
      FROM events
      WHERE marketplace = ?
      ORDER BY occurred_at DESC
      LIMIT 500
    `).bind(marketplace).all(),
    db.prepare(`
      SELECT v.validation_id, v.task_id, v.product_id, v.result_status, v.expected_json,
             v.observed_json, v.validated_at, t.updated_at AS task_updated_at
      FROM validation_results v
      INNER JOIN tasks t ON t.task_id = v.task_id
      WHERE t.marketplace = ?
      ORDER BY v.validated_at DESC
      LIMIT 300
    `).bind(marketplace).all(),
  ]);

  const plansByProduct = new Map();
  for (const plan of plansResult?.results || []) {
    if (!plansByProduct.has(plan.product_id)) plansByProduct.set(plan.product_id, plan);
  }
  const currentDateByProduct = new Map(products.map((product) => [product.product_id, product.business_date]));
  const metricsByProduct = new Map();
  for (const metric of metricsResult?.results || []) {
    if (currentDateByProduct.get(metric.product_id) !== metric.business_date) continue;
    const rows = metricsByProduct.get(metric.product_id) || [];
    rows.push(metric);
    metricsByProduct.set(metric.product_id, rows);
  }
  const eventsByProduct = new Map();
  for (const event of eventsResult?.results || []) {
    const businessDate = String(event.occurred_at || '').slice(0, 10);
    if (currentDateByProduct.get(event.product_id) !== businessDate) continue;
    const rows = eventsByProduct.get(event.product_id) || [];
    rows.push(event);
    eventsByProduct.set(event.product_id, rows);
  }
  const validationsByProduct = new Map();
  for (const validation of validationsResult?.results || []) {
    const rows = validationsByProduct.get(validation.product_id) || [];
    rows.push(validation);
    validationsByProduct.set(validation.product_id, rows);
  }

  return products
    .filter((product) => product.business_date)
    .map((product) => buildDailyOperatingBrief({
      product,
      plan: plansByProduct.get(product.product_id) || null,
      metrics: metricsByProduct.get(product.product_id) || [],
      events: eventsByProduct.get(product.product_id) || [],
      validations: validationsByProduct.get(product.product_id) || [],
    }));
}

export async function buildUiBootstrap(env, { marketplace = 'US' } = {}) {
  const market = String(marketplace || 'US').toUpperCase();
  const base = {
    generated_at:new Date().toISOString(), marketplace:market,
    apr:APR_SOURCE, aom:AOM_SOURCE, apb:APB_SOURCE, domains:DOMAINS,
    products:[], agents:[], tasks:[], sandbox_runs:[], daily_operating_briefs:[], source_status:{},
    live_data_verified:false, read_only:true, execution_authorized:false,
    production_write_authorized:false,
  };

  if (!env.CORE_DB) {
    return {
      ...base,
      source_status:{
        d1:'UNAVAILABLE', products:'UNAVAILABLE', agents:'UNAVAILABLE', tasks:'UNAVAILABLE', daily_operating_briefs:'UNAVAILABLE',
        apr:'SOURCE_SNAPSHOT', aom:'SOURCE_SNAPSHOT', apb:'SOURCE_SNAPSHOT',
      },
    };
  }

  try {
    const [products, agents, tasks, sources] = await Promise.all([
      queryProducts(env.CORE_DB, market), queryAgentState(env.CORE_DB), queryTasks(env.CORE_DB, market), querySourceStatus(env.CORE_DB),
    ]);
    const dailyOperatingBriefs = await queryDailySopReadModel(env.CORE_DB, market, products);
    return {
      ...base,
      products, agents, tasks, daily_operating_briefs:dailyOperatingBriefs,
      source_status:{
        d1:'LIVE_D1_READ', products:'LIVE_D1_READ', agents:'LIVE_D1_READ', tasks:'LIVE_D1_READ', daily_operating_briefs:'LIVE_D1_READ',
        apr:'SOURCE_SNAPSHOT', aom:'SOURCE_SNAPSHOT', apb:'SOURCE_SNAPSHOT',
        sources,
      },
      // Entire response is intentionally not marked fully live while APR/AOM/APB are source snapshots.
      live_data_verified:false,
    };
  } catch (error) {
    return {
      ...base,
      source_status:{
        d1:'READ_ERROR', products:'UNAVAILABLE', agents:'UNAVAILABLE', tasks:'UNAVAILABLE', daily_operating_briefs:'UNAVAILABLE',
        apr:'SOURCE_SNAPSHOT', aom:'SOURCE_SNAPSHOT', apb:'SOURCE_SNAPSHOT',
        error:String(error?.message || error),
      },
    };
  }
}
