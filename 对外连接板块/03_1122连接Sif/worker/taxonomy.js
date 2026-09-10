export const TAXONOMY_VERSION = "KeywordTaxonomy.v1.0";
export const NORMALIZER_VERSION = "KeywordNormalizer.v1.0";

export const KEYWORD_CATEGORIES = Object.freeze([
  { code: "own_brand", label: "自有品牌词", description: "用户明确提供的我方品牌及受控别名。" },
  { code: "competitor_alternative", label: "竞品 / 替代词", description: "竞品品牌、ASIN、对比或替代表达。" },
  { code: "promotion_transaction", label: "促销 / 交易词", description: "价格、优惠、购买和促销意图。" },
  { code: "occasion_seasonal", label: "节日 / 季节 / 礼赠词", description: "节庆、季节、纪念日和礼赠意图。" },
  { code: "audience", label: "人群词", description: "年龄、性别、职业、熟练度或使用者。" },
  { code: "scenario_use_case", label: "场景 / 用途词", description: "使用地点、活动、环境或任务场景。" },
  { code: "problem_benefit", label: "痛点 / 功能利益词", description: "待解决问题、期望结果和功能收益。" },
  { code: "feature_attribute", label: "属性 / 材质 / 规格词", description: "材质、颜色、尺寸、数量、兼容性和客观规格。" },
  { code: "category_core", label: "核心 / 类目词", description: "多竞品共同覆盖或标题上下文支持的产品核心词。" },
  { code: "related_general", label: "相关泛词", description: "来源相关但暂未命中更明确规则的探索词。" },
]);

const TERM_RULES = Object.freeze({
  promotion_transaction: [
    "sale", "deal", "deals", "coupon", "discount", "discounted", "clearance", "cheap",
    "lowest price", "best price", "price drop", "on offer", "buy now", "prime day", "black friday",
    "cyber monday", "under dollar", "under dollars", "budget",
  ],
  occasion_seasonal: [
    "christmas", "xmas", "halloween", "thanksgiving", "easter", "valentine", "valentines",
    "mothers day", "fathers day", "birthday", "anniversary", "wedding", "graduation", "holiday",
    "gift", "gifts", "stocking stuffer", "summer", "winter", "spring", "fall", "autumn",
    "back to school", "new year",
  ],
  audience: [
    "for kids", "for children", "for child", "for toddler", "for toddlers", "for baby", "for babies",
    "for teen", "for teens", "for adults", "for seniors", "for elderly", "for women", "for woman",
    "for men", "for man", "for girls", "for girl", "for boys", "for boy", "for beginners",
    "for professional", "for professionals", "for students", "for teachers", "for parents", "for mom",
    "for moms", "for dad", "for dads", "unisex",
  ],
  scenario_use_case: [
    "travel", "travelling", "traveling", "outdoor", "outdoors", "indoor", "indoors", "home", "office",
    "school", "classroom", "college", "camping", "hiking", "party", "garden", "kitchen", "bathroom",
    "bedroom", "living room", "garage", "car", "vehicle", "work", "workout", "gym", "sports", "beach",
    "pool", "restaurant", "hotel", "apartment", "small space", "on the go", "daily use",
  ],
  problem_benefit: [
    "pain relief", "relief", "space saving", "save space", "easy setup", "easy to use", "easy clean",
    "easy to clean", "quick", "fast", "portable", "lightweight", "comfortable", "comfort", "ergonomic",
    "protect", "protection", "prevent", "reduce", "improve", "support", "organize", "storage solution",
    "anti slip", "non slip", "waterproof", "leakproof", "leak proof", "odor control", "quiet", "silent",
    "durable", "heavy duty", "reusable", "convenient", "secure", "safety",
  ],
  feature_attribute: [
    "black", "white", "blue", "red", "green", "pink", "purple", "grey", "gray", "brown", "beige",
    "wood", "wooden", "metal", "steel", "stainless steel", "aluminum", "plastic", "silicone", "cotton",
    "leather", "glass", "ceramic", "bamboo", "rubber", "foam", "fabric", "wireless", "corded",
    "electric", "manual", "rechargeable", "foldable", "adjustable", "replacement", "refill", "kit", "set",
    "pack", "piece", "pieces", "small", "medium", "large", "extra large", "mini", "compact", "round",
    "square", "rectangular", "compatible with", "fits", "inch", "inches", "cm", "mm", "oz", "lb", "lbs",
  ],
});

const CORE_STOP_WORDS = new Set([
  "the", "and", "with", "for", "from", "that", "this", "your", "our", "you", "a", "an", "of", "to",
  "in", "on", "at", "by", "or", "as", "is", "are", "be", "new", "best", "set", "pack", "piece",
  "pieces", "amazon", "premium", "professional", "portable", "small", "large", "black", "white",
]);

export function normalizeKeyword(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeKeyword(value) {
  const normalized = normalizeKeyword(value);
  return normalized ? normalized.split(" ").filter(Boolean) : [];
}

export function tokenSignature(value) {
  return tokenizeKeyword(value).slice().sort().join(" ");
}

export function keywordId(marketplace, language, normalizedKeyword) {
  const bytes = new TextEncoder().encode(`${marketplace}\u0000${language}\u0000${normalizedKeyword}`);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  const encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `kw_${encoded}`;
}

function containsTerm(normalized, term) {
  const value = ` ${normalized} `;
  return value.includes(` ${normalizeKeyword(term)} `);
}

function matchingTerms(normalized, terms) {
  return terms.filter((term) => containsTerm(normalized, term));
}

function normalizedTerms(values) {
  return [...new Set((values || []).map(normalizeKeyword).filter(Boolean))];
}

export function deriveCoreTokens(profiles = []) {
  const rows = (profiles || []).filter((item) => item && item.title);
  if (!rows.length) return [];
  const brandTokens = new Set(rows.flatMap((item) => tokenizeKeyword(item.brand || "")));
  const counts = new Map();
  for (const row of rows) {
    const tokens = new Set(tokenizeKeyword(row.title).filter((token) => (
      token.length >= 3 && !/^\d+(?:\.\d+)?$/.test(token) && !CORE_STOP_WORDS.has(token) && !brandTokens.has(token)
    )));
    for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  }
  const threshold = rows.length === 1 ? 1 : Math.max(2, Math.ceil(rows.length / 2));
  return [...counts.entries()]
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 24)
    .map(([token]) => token);
}

export function classifyKeyword(input) {
  const normalized = normalizeKeyword(input.normalizedKeyword);
  const tokens = tokenizeKeyword(normalized);
  const tokenCount = tokens.length;
  const ownBrands = normalizedTerms(input.ownBrands);
  const competitorBrands = normalizedTerms(input.competitorBrands).filter((brand) => !ownBrands.includes(brand));
  const coreTokens = new Set(normalizedTerms(input.coreTokens));
  // A manual import has no fabricated ASIN provenance. Keep its coverage at
  // zero instead of silently treating it as a one-ASIN SIF observation.
  const inputAsinCount = Math.max(0, Number(input.inputAsinCount) || 0);
  const sourceAsinCount = Math.max(0, Number(input.sourceAsinCount) || 0);
  const coverage = inputAsinCount > 0 ? sourceAsinCount / inputAsinCount : 0;
  const matches = new Map();
  const ruleIds = [];

  const addMatch = (code, matched, ruleId) => {
    if (!matched || (Array.isArray(matched) && !matched.length)) return;
    matches.set(code, [...new Set([
      ...(matches.get(code) || []),
      ...(Array.isArray(matched) ? matched : [String(matched)]),
    ])]);
    ruleIds.push(ruleId);
  };

  addMatch("own_brand", ownBrands.filter((term) => containsTerm(normalized, term)), "own_brand.dictionary");
  addMatch("competitor_alternative", competitorBrands.filter((term) => containsTerm(normalized, term)), "competitor.brand_dictionary");
  addMatch("competitor_alternative", matchingTerms(normalized, ["vs", "versus", "alternative to", "similar to"]), "competitor.comparison_phrase");
  for (const [code, terms] of Object.entries(TERM_RULES)) {
    addMatch(code, matchingTerms(normalized, terms), `${code}.lexicon`);
  }

  const numericAttribute = /(^|\s)\d+(?:\.\d+)?\s*(?:inch|inches|cm|mm|oz|lb|lbs|pack|piece|pieces|count|ct)(?:\s|$)/.test(normalized);
  addMatch("feature_attribute", numericAttribute ? ["numeric_spec"] : [], "feature_attribute.numeric_spec");

  const matchedCoreTokens = tokens.filter((token) => coreTokens.has(token));
  const commonAcrossCompetitors = inputAsinCount > 1 && sourceAsinCount >= 2 && coverage >= 0.5;
  addMatch("category_core", matchedCoreTokens, "category_core.profile_title_token");
  addMatch("category_core", commonAcrossCompetitors ? ["multi_asin_coverage"] : [], "category_core.multi_asin_coverage");

  const priority = KEYWORD_CATEGORIES.map((item) => item.code);
  const primaryCategory = priority.find((code) => matches.has(code)) || "related_general";
  if (primaryCategory === "related_general") ruleIds.push("related_general.fallback");

  let confidence = 0.88;
  let reason = "命中可审计的确定性词典规则";
  if (primaryCategory === "category_core") {
    confidence = commonAcrossCompetitors ? 0.84 : 0.72;
    reason = commonAcrossCompetitors
      ? `覆盖 ${sourceAsinCount}/${inputAsinCount} 个竞品，达到核心覆盖规则`
      : "命中多个竞品标题共同出现的类目词根";
  } else if (primaryCategory === "related_general") {
    confidence = 0.46;
    reason = "来自竞品流量词，但未命中更明确的语义规则";
  }

  const queryShape = tokenCount <= 2 ? "HEAD" : tokenCount === 3 ? "MID_TAIL" : "LONG_TAIL";
  const strategicTier = commonAcrossCompetitors
    ? "CORE"
    : sourceAsinCount >= 2
      ? "SUPPORT"
      : queryShape === "LONG_TAIL" ? "LONG_TAIL" : "NICHE";
  const secondaryTags = [queryShape];
  if (sourceAsinCount >= 2) secondaryTags.push("MULTI_ASIN");
  if (coverage >= 0.5 && inputAsinCount > 1) secondaryTags.push("HIGH_COVERAGE");
  if (Number(input.searchVolume) > 0) secondaryTags.push("SEARCH_VOLUME_PRESENT");
  if (input.organicRank !== null && input.organicRank !== undefined && Number.isFinite(Number(input.organicRank))) secondaryTags.push("NATURAL_VISIBLE");
  if (input.spRank !== null && input.spRank !== undefined && Number.isFinite(Number(input.spRank))) secondaryTags.push("SP_VISIBLE");
  if (Number(input.nearDuplicateCount) > 0) secondaryTags.push("NEAR_DUPLICATE_REVIEW");

  const needsReview = confidence < 0.7 || Number(input.nearDuplicateCount) > 0;
  if (needsReview) secondaryTags.push("NEEDS_REVIEW");

  return {
    primaryCategory,
    matchedFacets: [...matches.keys()],
    matchedRuleIds: [...new Set(ruleIds)],
    secondaryTags: [...new Set(secondaryTags)],
    classificationReason: reason,
    classificationConfidence: confidence,
    queryShape,
    strategicTier,
    relevanceStatus: primaryCategory === "related_general" ? "AMBIGUOUS" : "RELEVANT",
    needsReview,
  };
}
