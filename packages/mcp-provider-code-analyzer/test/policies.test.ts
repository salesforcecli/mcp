import { describe, expect, it } from "vitest";
import {
  capArrayIfFullList,
  DEFAULT_TOPN_POLICY_LIMIT,
  enforceTopNLimit
} from "../src/policies.js";

describe("policies", () => {
  it("enforceTopNLimit rejects when default exceeds limit and no opt-in", () => {
    const result = enforceTopNLimit(undefined, false, 5);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.code).toBe("POLICY_TOPN_LIMIT");
      expect(result.message).toContain("Requested topN exceeds 5");
    }
  });

  it("enforceTopNLimit allows when opt-in is provided", () => {
    const result = enforceTopNLimit(DEFAULT_TOPN_POLICY_LIMIT + 1, true, DEFAULT_TOPN_POLICY_LIMIT);
    expect(result.ok).toBe(true);
  });

  it("capArrayIfFullList truncates when selector is full list and no opt-in", () => {
    const items = [1, 2, 3, 4];
    const result = capArrayIfFullList("All", false, items, 2);
    expect(result.items).toEqual([1, 2]);
    expect(result.truncated).toBe(true);
  });

  it("capArrayIfFullList returns full list when opt-in is provided", () => {
    const items = [1, 2, 3];
    const result = capArrayIfFullList("All", true, items, 2);
    expect(result.items).toEqual(items);
    expect(result.truncated).toBe(false);
  });
});
