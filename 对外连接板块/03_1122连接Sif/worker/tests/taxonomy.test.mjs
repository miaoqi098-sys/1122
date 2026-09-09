import assert from "node:assert/strict";
import test from "node:test";
import {
  KEYWORD_CATEGORIES,
  classifyKeyword,
  deriveCoreTokens,
  keywordId,
  normalizeKeyword,
  tokenSignature,
} from "../taxonomy.js";

test("taxonomy exposes ten unique primary categories", () => {
  assert.equal(KEYWORD_CATEGORIES.length, 10);
  assert.equal(new Set(KEYWORD_CATEGORIES.map((item) => item.code)).size, 10);
});

test("normalizer performs strict deterministic exact-key normalization", () => {
  assert.equal(normalizeKeyword("  Ｍahjong—Set!!!  "), "mahjong set");
  assert.notEqual(normalizeKeyword("travel bag"), normalizeKeyword("bag travel"));
  assert.equal(tokenSignature("travel bag"), tokenSignature("bag travel"));
});

test("keyword identifiers are stable and marketplace scoped", () => {
  assert.equal(keywordId("US", "en", "mahjong set"), keywordId("US", "en", "mahjong set"));
  assert.notEqual(keywordId("US", "en", "mahjong set"), keywordId("UK", "en", "mahjong set"));
});

test("explicit own and competitor brands take precedence", () => {
  const own = classifyKeyword({ normalizedKeyword: "sorilo travel set", ownBrands: ["Sorilo"] });
  assert.equal(own.primaryCategory, "own_brand");
  const competitor = classifyKeyword({
    normalizedKeyword: "acme vs sorilo",
    ownBrands: ["Sorilo"],
    competitorBrands: ["Acme"],
  });
  assert.equal(competitor.primaryCategory, "own_brand");
  assert.ok(competitor.matchedFacets.includes("competitor_alternative"));
});

test("intent categories and priority are auditable", () => {
  const promotion = classifyKeyword({ normalizedKeyword: "sale camping chair" });
  assert.equal(promotion.primaryCategory, "promotion_transaction");
  assert.ok(promotion.matchedFacets.includes("scenario_use_case"));
  const scenario = classifyKeyword({ normalizedKeyword: "chair for camping" });
  assert.equal(scenario.primaryCategory, "scenario_use_case");
});

test("successful-ASIN coverage can identify category core terms", () => {
  const coreTokens = deriveCoreTokens([
    { title: "Portable Mahjong Table Set", brand: "Alpha" },
    { title: "Mahjong Table with Cover", brand: "Beta" },
  ]);
  assert.ok(coreTokens.includes("mahjong"));
  const result = classifyKeyword({
    normalizedKeyword: "mahjong table",
    inputAsinCount: 2,
    sourceAsinCount: 2,
    coreTokens,
  });
  assert.equal(result.primaryCategory, "category_core");
  assert.equal(result.strategicTier, "CORE");
});

test("long tail and ambiguous fallback remain independent dimensions", () => {
  const result = classifyKeyword({ normalizedKeyword: "unmapped phrase without known semantic intent" });
  assert.equal(result.primaryCategory, "related_general");
  assert.equal(result.queryShape, "LONG_TAIL");
  assert.equal(result.relevanceStatus, "AMBIGUOUS");
  assert.equal(result.needsReview, true);
});
