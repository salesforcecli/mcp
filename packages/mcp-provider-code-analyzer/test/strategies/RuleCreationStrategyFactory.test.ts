import { describe, expect, it, beforeEach } from "vitest";
import { RuleCreationStrategyFactory } from "../../src/strategies/RuleCreationStrategyFactory.js";
import { IRuleCreationStrategy } from "../../src/strategies/IRuleCreationStrategy.js";
import { XPathRuleStrategy } from "../../src/strategies/XPathRuleStrategy.js";
import { RegexRuleStrategy } from "../../src/strategies/RegexRuleStrategy.js";

describe("RuleCreationStrategyFactory tests", () => {
  let factory: RuleCreationStrategyFactory;

  beforeEach(() => {
    factory = new RuleCreationStrategyFactory();
  });

  describe("constructor", () => {
    it("should register default strategies on construction", () => {
      expect(factory.getSupportedEngines()).toContain("pmd");
      expect(factory.getSupportedEngines()).toContain("regex");
    });

    it("should return exactly 2 default strategies", () => {
      expect(factory.getSupportedEngines()).toHaveLength(2);
    });
  });

  describe("createStrategy", () => {
    it("should return XPathRuleStrategy for 'pmd' engine", () => {
      const strategy = factory.createStrategy("pmd");

      expect(strategy).toBeInstanceOf(XPathRuleStrategy);
      expect(strategy.getSupportedEngine()).toBe("pmd");
    });

    it("should return RegexRuleStrategy for 'regex' engine", () => {
      const strategy = factory.createStrategy("regex");

      expect(strategy).toBeInstanceOf(RegexRuleStrategy);
      expect(strategy.getSupportedEngine()).toBe("regex");
    });

    it("should be case-insensitive for engine names", () => {
      const strategy1 = factory.createStrategy("PMD");
      const strategy2 = factory.createStrategy("Pmd");
      const strategy3 = factory.createStrategy("REGEX");
      const strategy4 = factory.createStrategy("Regex");

      expect(strategy1).toBeInstanceOf(XPathRuleStrategy);
      expect(strategy2).toBeInstanceOf(XPathRuleStrategy);
      expect(strategy3).toBeInstanceOf(RegexRuleStrategy);
      expect(strategy4).toBeInstanceOf(RegexRuleStrategy);
    });

    it("should trim whitespace from engine names", () => {
      const strategy1 = factory.createStrategy("  pmd  ");
      const strategy2 = factory.createStrategy("  regex  ");

      expect(strategy1).toBeInstanceOf(XPathRuleStrategy);
      expect(strategy2).toBeInstanceOf(RegexRuleStrategy);
    });

    it("should throw error for unsupported engine", () => {
      expect(() => factory.createStrategy("eslint")).toThrow();
    });

    it("should include supported engines list in error message", () => {
      try {
        factory.createStrategy("eslint");
        expect.fail("Should have thrown error");
      } catch (error) {
        expect((error as Error).message).toContain("eslint");
        expect((error as Error).message).toContain("Unsupported engine");
        expect((error as Error).message).toContain("pmd");
        expect((error as Error).message).toContain("regex");
      }
    });

    it("should throw error for empty string engine", () => {
      expect(() => factory.createStrategy("")).toThrow();
    });

    it("should throw error for whitespace-only engine", () => {
      expect(() => factory.createStrategy("   ")).toThrow();
    });
  });

  describe("getSupportedEngines", () => {
    it("should return array of supported engine names", () => {
      const engines = factory.getSupportedEngines();

      expect(Array.isArray(engines)).toBe(true);
      expect(engines).toContain("pmd");
      expect(engines).toContain("regex");
    });

    it("should return engine names in lowercase", () => {
      const engines = factory.getSupportedEngines();

      engines.forEach(engine => {
        expect(engine).toBe(engine.toLowerCase());
      });
    });
  });

  describe("isEngineSupported", () => {
    it("should return true for 'pmd' engine", () => {
      expect(factory.isEngineSupported("pmd")).toBe(true);
    });

    it("should return true for 'regex' engine", () => {
      expect(factory.isEngineSupported("regex")).toBe(true);
    });

    it("should return false for unsupported engine", () => {
      expect(factory.isEngineSupported("eslint")).toBe(false);
    });

    it("should be case-insensitive", () => {
      expect(factory.isEngineSupported("PMD")).toBe(true);
      expect(factory.isEngineSupported("REGEX")).toBe(true);
      expect(factory.isEngineSupported("Pmd")).toBe(true);
      expect(factory.isEngineSupported("Regex")).toBe(true);
    });

    it("should trim whitespace", () => {
      expect(factory.isEngineSupported("  pmd  ")).toBe(true);
      expect(factory.isEngineSupported("  regex  ")).toBe(true);
    });

    it("should return false for empty string", () => {
      expect(factory.isEngineSupported("")).toBe(false);
    });

    it("should return false for whitespace-only string", () => {
      expect(factory.isEngineSupported("   ")).toBe(false);
    });
  });

  describe("registerStrategy", () => {
    it("should allow registering a new strategy", () => {
      class MockStrategy implements IRuleCreationStrategy {
        getSupportedEngine(): string {
          return "eslint";
        }
        validate() {
          return { isValid: true, errors: [] };
        }
        async execute() {
          return { status: "success" };
        }
      }

      const mockStrategy = new MockStrategy();
      factory.registerStrategy(mockStrategy);

      expect(factory.getSupportedEngines()).toContain("eslint");
      expect(factory.isEngineSupported("eslint")).toBe(true);

      const strategy = factory.createStrategy("eslint");
      expect(strategy).toBe(mockStrategy);
    });

    it("should allow overriding an existing strategy", () => {
      class CustomPmdStrategy implements IRuleCreationStrategy {
        getSupportedEngine(): string {
          return "pmd";
        }
        validate() {
          return { isValid: true, errors: [] };
        }
        async execute() {
          return { status: "custom-success" };
        }
      }

      const customStrategy = new CustomPmdStrategy();
      factory.registerStrategy(customStrategy);

      const strategy = factory.createStrategy("pmd");
      expect(strategy).toBe(customStrategy);
    });

    it("should normalize engine name to lowercase when registering", () => {
      class UpperCaseStrategy implements IRuleCreationStrategy {
        getSupportedEngine(): string {
          return "UPPERCASE";
        }
        validate() {
          return { isValid: true, errors: [] };
        }
        async execute() {
          return { status: "success" };
        }
      }

      factory.registerStrategy(new UpperCaseStrategy());

      // Should be able to access with lowercase
      expect(factory.isEngineSupported("uppercase")).toBe(true);
      expect(factory.getSupportedEngines()).toContain("uppercase");
    });
  });
});
