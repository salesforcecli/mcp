import { describe, it, expect } from "vitest";
import { directoryParam, usernameOrAliasParam, baseAbsolutePathParam } from "../../src/shared/params.js";
import path from "node:path";
import os from "node:os";

describe("params", () => {
  describe("baseAbsolutePathParam", () => {
    it("should accept valid absolute path", () => {
      const absolutePath = path.join(os.tmpdir(), "project");
      expect(baseAbsolutePathParam.parse(absolutePath)).toBe(absolutePath);
    });

    it("should reject path with traversal", () => {
      expect(() => baseAbsolutePathParam.parse("/foo/../bar")).toThrow("Invalid path");
    });

    it("should reject relative path", () => {
      expect(() => baseAbsolutePathParam.parse("foo/bar")).toThrow("Invalid path");
    });
  });

  describe("directoryParam", () => {
    it("should accept valid absolute directory path", () => {
      const dir = path.join(os.tmpdir(), "workspace");
      expect(directoryParam.parse(dir)).toBe(dir);
    });

    it("should reject invalid path", () => {
      expect(() => directoryParam.parse("../etc")).toThrow("Invalid path");
    });
  });

  describe("usernameOrAliasParam", () => {
    it("should accept optional string", () => {
      expect(usernameOrAliasParam.parse(undefined)).toBeUndefined();
      expect(usernameOrAliasParam.parse("user@example.com")).toBe("user@example.com");
    });
  });
});
