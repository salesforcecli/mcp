import { describe, it, expect } from "vitest";
import { SOQLNoWhereLimitRecommender } from "../../src/recommenders/soql-no-where-limit-recommender.js";
import { AntipatternType } from "../../src/models/antipattern-type.js";

describe("SOQLNoWhereLimitRecommender", () => {
  const recommender = new SOQLNoWhereLimitRecommender();

  it("should return SOQL_NO_WHERE_LIMIT as antipattern type", () => {
    expect(recommender.getAntipatternType()).toBe(AntipatternType.SOQL_NO_WHERE_LIMIT);
  });

  it("should return comprehensive fix instruction", () => {
    const instruction = recommender.getFixInstruction();

    // Verify instruction is a string
    expect(typeof instruction).toBe("string");
    expect(instruction.length).toBeGreaterThan(100);

    // Verify key content is present
    expect(instruction).toContain("SOQL");
    expect(instruction).toContain("WHERE");
    expect(instruction).toContain("LIMIT");
    expect(instruction).toContain("Problem");
    expect(instruction).toContain("Antipattern");
  });

  it("should include solution strategies in instruction", () => {
    const instruction = recommender.getFixInstruction();

    // Check for all antipattern types
    expect(instruction).toContain("Antipattern 1");
    expect(instruction).toContain("Antipattern 2");
    expect(instruction).toContain("Antipattern 3");
    expect(instruction).toContain("Antipattern 4");
    expect(instruction).toContain("Antipattern 5");
    
    // Verify specific techniques mentioned
    expect(instruction).toContain("WHERE");
    expect(instruction).toContain("LIMIT");
    expect(instruction).toContain("loop");
  });

  it("should include code examples in instruction", () => {
    const instruction = recommender.getFixInstruction();

    // Should have example and fix sections
    expect(instruction).toContain("Example of Antipattern");
    expect(instruction).toContain("Recommended Fix");
    expect(instruction).toContain("```apex");
  });

  it("should include severity levels", () => {
    const instruction = recommender.getFixInstruction();

    expect(instruction).toContain("CRITICAL");
    expect(instruction).toContain("HIGH");
    expect(instruction).toContain("MEDIUM");
  });

  it("should include governor limits context", () => {
    const instruction = recommender.getFixInstruction();

    // Should mention Salesforce-specific concerns
    expect(instruction).toContain("governor");
    expect(instruction).toContain("50,000");
    expect(instruction).toContain("heap");
  });

  it("should include best practices section", () => {
    const instruction = recommender.getFixInstruction();

    expect(instruction).toContain("Best Practices");
    expect(instruction).toContain("batch");
    expect(instruction).toContain("indexed");
  });

  it("should include nested query guidance", () => {
    const instruction = recommender.getFixInstruction();

    expect(instruction).toContain("Nested");
    expect(instruction).toContain("subquer");
    expect(instruction).toContain("outer");
  });

  it("should include metadata query guidance", () => {
    const instruction = recommender.getFixInstruction();

    expect(instruction).toContain("metadata");
    expect(instruction).toContain("DeveloperName");
  });

  it("should include LLM application guidance", () => {
    const instruction = recommender.getFixInstruction();

    // Should guide the LLM on how to apply fixes
    expect(instruction).toContain("codeBefore");
    expect(instruction).toContain("severity");
    expect(instruction).toContain("How to Apply");
  });

  it("should include documentation references", () => {
    const instruction = recommender.getFixInstruction();

    expect(instruction).toContain("Reference");
    expect(instruction).toContain("salesforce");
  });

  it("should return same instruction on multiple calls (stateless)", () => {
    const instruction1 = recommender.getFixInstruction();
    const instruction2 = recommender.getFixInstruction();

    expect(instruction1).toBe(instruction2);
  });

  it("should include all 5 antipattern categories", () => {
    const instruction = recommender.getFixInstruction();

    // Verify all 5 antipatterns are documented
    const antipatternCount = (instruction.match(/Antipattern \d:/g) || []).length;
    expect(antipatternCount).toBe(5);
  });

  it("should include examples for all severity levels", () => {
    const instruction = recommender.getFixInstruction();

    // Should have examples marked with severity
    expect(instruction).toMatch(/Severity.*CRITICAL/i);
    expect(instruction).toMatch(/Severity.*HIGH/i);
    expect(instruction).toMatch(/Severity.*MEDIUM/i);
  });

  it("should include both good and bad code examples", () => {
    const instruction = recommender.getFixInstruction();

    // Should have markers for antipatterns and fixes
    expect(instruction).toContain("❌");
    expect(instruction).toContain("✅");
  });

  it("should include guidance for loops", () => {
    const instruction = recommender.getFixInstruction();

    expect(instruction).toContain("loop");
    expect(instruction).toContain("SOQL in loop");
    expect(instruction).toContain("refactor");
  });

  it("should include batch processing guidance", () => {
    const instruction = recommender.getFixInstruction();

    expect(instruction).toContain("batch");
    expect(instruction).toContain("Database.Batchable");
    expect(instruction).toContain("QueryLocator");
  });

  it("should include single-record query optimization", () => {
    const instruction = recommender.getFixInstruction();

    expect(instruction).toContain("first record");
    expect(instruction).toContain("LIMIT 1");
  });
});


