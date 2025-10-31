import { describe, it, expect } from "vitest";
import { GGDRecommender } from "../../src/recommenders/ggd-recommender.js";
import { AntipatternType } from "../../src/models/antipattern-type.js";

describe("GGDRecommender", () => {
  const recommender = new GGDRecommender();

  it("should return GGD as antipattern type", () => {
    expect(recommender.getAntipatternType()).toBe(AntipatternType.GGD);
  });

  it("should return comprehensive fix instruction", () => {
    const instruction = recommender.getFixInstruction();

    // Verify instruction is a string
    expect(typeof instruction).toBe("string");
    expect(instruction.length).toBeGreaterThan(100);

    // Verify key content is present
    expect(instruction).toContain("Schema.getGlobalDescribe()");
    expect(instruction).toContain("Type.forName");
    expect(instruction).toContain("Problem");
    expect(instruction).toContain("Antipattern");
  });

  it("should include solution strategies in instruction", () => {
    const instruction = recommender.getFixInstruction();

    // Check for all three antipattern types
    expect(instruction).toContain("Antipattern 1");
    expect(instruction).toContain("Antipattern 2");
    expect(instruction).toContain("Antipattern 3");
    
    // Verify specific techniques mentioned
    expect(instruction).toContain("Type.forName()");
    expect(instruction).toContain("sObjectType.getDescribe()");
    expect(instruction).toContain("Cache");
  });

  it("should include code examples in instruction", () => {
    const instruction = recommender.getFixInstruction();

    // Should have example and fix sections
    expect(instruction).toContain("Example of Antipattern");
    expect(instruction).toContain("Recommended Fix");
    expect(instruction).toContain("```apex");
  });

  it("should include priority guidelines", () => {
    const instruction = recommender.getFixInstruction();

    expect(instruction).toContain("Best Practices");
    expect(instruction).toContain("HIGH");
    expect(instruction).toContain("MEDIUM");
    expect(instruction).toContain("loop");
  });

  it("should include LLM application guidance", () => {
    const instruction = recommender.getFixInstruction();

    // Should guide the LLM on how to apply fixes
    expect(instruction).toContain("codeBefore");
    expect(instruction).toContain("severity");
    expect(instruction).toContain("How to Apply");
  });

  it("should return same instruction on multiple calls (stateless)", () => {
    const instruction1 = recommender.getFixInstruction();
    const instruction2 = recommender.getFixInstruction();

    expect(instruction1).toBe(instruction2);
  });
});
