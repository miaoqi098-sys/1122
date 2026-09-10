import assert from "node:assert/strict";
import test from "node:test";

import { researchCsvTestApi, researchInputTestApi } from "../research.js";
import { classifyKeyword } from "../taxonomy.js";

test("manual import normalization removes only exact normalized duplicates", () => {
  const result = researchInputTestApi.normalizeImportedKeywords(" Plush Toy\nplush   toy\nKitchen Gift\n");
  assert.equal(result.inputKeywordCount, 3);
  assert.equal(result.valid.length, 2);
  assert.equal(result.duplicateCount, 1);
  assert.deepEqual(result.valid.map((item) => item.normalizedKeyword), ["plush toy", "kitchen gift"]);
});

test("manual import requires a real group boundary and rejects an empty input", () => {
  assert.throws(
    () => researchInputTestApi.validateImportPayload({ marketplace: "US", group_name: "玩具", keyword_text: " , ; \n" }),
    (error) => error?.code === "IMPORT_INPUT_REQUIRED",
  );
  const valid = researchInputTestApi.validateImportPayload({
    marketplace: "US", group_name: "玩具", keyword_text: "sale plush toy\nplush toy for kids",
  });
  assert.equal(valid.groupName, "玩具");
  assert.equal(valid.keywords.length, 2);
});

test("manual imports do not fabricate multi-ASIN coverage or SIF provenance", () => {
  const result = classifyKeyword({
    normalizedKeyword: "sale plush toy",
    inputAsinCount: 0,
    sourceAsinCount: 0,
  });
  assert.equal(result.primaryCategory, "promotion_transaction");
  assert.equal(result.secondaryTags.includes("MULTI_ASIN"), false);
  assert.equal(result.secondaryTags.includes("HIGH_COVERAGE"), false);
});

test("CSV export neutralizes formula-shaped manually imported text", () => {
  assert.equal(researchCsvTestApi.csvCell("=HYPERLINK(\"https://example.invalid\")"), "\"'=HYPERLINK(\"\"https://example.invalid\"\")\"");
  const line = researchCsvTestApi.keywordCsvLine({
    keyword: "+not-a-formula",
    normalized_keyword: "not a formula",
    primary_category: "related_general",
    source_kind: "MANUAL_IMPORT",
    source_asin_count: 0,
    source_asins: [],
    needs_review: true,
  }, "group");
  assert.match(line, /'\+not-a-formula/);
  assert.match(line, /手工导入/);
});
