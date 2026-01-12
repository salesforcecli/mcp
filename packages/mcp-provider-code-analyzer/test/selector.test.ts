import { describe, it, expect } from "vitest";
import { validateSelectorForQuery, parseSelectorToFilters } from "../src/selector.js";

describe("selector.ts", () => {
  describe("validateSelectorForQuery", () => {
    it("accepts standard engines, tags, and severities (name and number)", () => {
      const valid1 = validateSelectorForQuery("pmd:(Security,Performance):1");
      expect(valid1).toEqual({ valid: true });

      const valid2 = validateSelectorForQuery("eslint:High");
      expect(valid2).toEqual({ valid: true });
    });

    it("accepts custom rule/file tokens and ignores them for validation", () => {
      const valid = validateSelectorForQuery("(rule=my.rule,file=src/app,fileEndsWith=Foo.ts):pmd:2");
      expect(valid).toEqual({ valid: true });
    });

    it("flags empty OR-group as invalid", () => {
      const invalid = validateSelectorForQuery("pmd:()");
      expect(invalid.valid).toBe(false);
      if (invalid.valid === false) {
        expect(invalid.invalidTokens).toContain("()");
      }
    });

    it("flags invalid token inside OR-group", () => {
      const invalid = validateSelectorForQuery("(NotATag):pmd");
      expect(invalid.valid).toBe(false);
      if (invalid.valid === false) {
        expect(invalid.invalidTokens).toContain("NotATag");
      }
    });

    it("accepts top-level file/fileEndsWith/rule tokens", () => {
      expect(validateSelectorForQuery("file=src/app")).toEqual({ valid: true });
      expect(validateSelectorForQuery("fileEndsWith=Foo.ts")).toEqual({ valid: true });
      expect(validateSelectorForQuery("rule=some.rule")).toEqual({ valid: true });
    });

    it("flags invalid tokens", () => {
      const invalid = validateSelectorForQuery("NotATag:9999");
      expect(invalid.valid).toBe(false);
      if (invalid.valid === false) {
        // Order is not guaranteed, so we only ensure the tokens are present
        expect(new Set(invalid.invalidTokens)).toEqual(new Set(["NotATag", "9999"]));
      }
    });
  });

  describe("parseSelectorToFilters", () => {
    it("parses engine, tags (case-insensitive), and numeric severities", () => {
      const f = parseSelectorToFilters("pmd:(Security,Performance):1");
      expect(f.engines).toEqual(["pmd"]);
      expect(new Set(f.tags)).toEqual(new Set(["security", "performance"]));
      expect(f.severities).toEqual([1]);
    });

    it("parses severity names to numbers", () => {
      const f = parseSelectorToFilters("High:Moderate");
      // High -> 2, Moderate -> 3
      expect(new Set(f.severities)).toEqual(new Set([2, 3]));
    });

    it("parses rule, file, and fileEndsWith custom tokens", () => {
      const f = parseSelectorToFilters("(rule=my.Rule,file=src/App/,fileEndsWith=Foo.ts):eslint");
      expect(f.rules).toEqual(["my.rule"]);               // lowercased
      expect(f.fileContains).toEqual(["src/app/"]);       // lowercased
      expect(f.fileEndsWith).toEqual(["foo.ts"]);         // lowercased
      expect(f.engines).toEqual(["eslint"]);
    });

    it("parses languages and categories as tags", () => {
      const f = parseSelectorToFilters("JavaScript:Performance");
      expect(new Set(f.tags)).toEqual(new Set(["javascript", "performance"]));
    });

    it("deduplicates repeated tokens", () => {
      const f = parseSelectorToFilters("pmd:(Security,security,Security):1:1");
      expect(f.engines).toEqual(["pmd"]);
      expect(f.severities).toEqual([1]);
      expect(f.tags).toEqual(["security"]);
    });
  });
});


