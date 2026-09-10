import test from "node:test";
import assert from "node:assert/strict";

import { researchInputTestApi } from "../research.js";

const basePayload = Object.freeze({
  asins: ["B0C1234567"],
  marketplace: "US",
  granularity: "month",
  period_start: "2026-09-01",
});

test("a new competitor research run always has one product group", () => {
  assert.throws(
    () => researchInputTestApi.validateCreatePayload(basePayload),
    (error) => error?.code === "GROUP_NAME_REQUIRED"
  );
});

test("custom Chinese group names stay distinct from the ten keyword categories", () => {
  const payload = researchInputTestApi.validateCreatePayload({
    ...basePayload,
    group_name: "毛绒玩具 · 秋冬款",
    group_description: "与厨房用品分开维护的竞品词库",
  });

  assert.equal(payload.groupId, null);
  assert.equal(payload.groupName, "毛绒玩具 · 秋冬款");
  assert.equal(payload.groupDescription, "与厨房用品分开维护的竞品词库");
  assert.equal(researchInputTestApi.normalizeGroupName("毛绒玩具 · 秋冬款"), "毛绒玩具 · 秋冬款");
});

test("a run cannot ambiguously choose both an existing group and a new group", () => {
  assert.throws(
    () => researchInputTestApi.validateCreatePayload({
      ...basePayload,
      group_id: "a0b1c2d3-e4f5-4678-9abc-def012345678",
      group_name: "厨房用品",
    }),
    (error) => error?.code === "GROUP_INVALID"
  );
});

test("an existing product group identifier is validated before the job reaches D1", () => {
  const groupId = "a0b1c2d3-e4f5-4678-9abc-def012345678";
  const payload = researchInputTestApi.validateCreatePayload({ ...basePayload, group_id: groupId });
  assert.equal(payload.groupId, groupId);
  assert.equal(payload.groupName, null);
  assert.equal(researchInputTestApi.validGroupId(groupId), true);
  assert.equal(researchInputTestApi.validGroupId("not-a-group"), false);
});
