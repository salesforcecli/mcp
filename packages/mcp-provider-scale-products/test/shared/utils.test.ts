import { describe, it, expect } from "vitest";
import { sanitizePath } from "../../src/shared/utils.js";
import path from "node:path";
import os from "node:os";

describe("sanitizePath", () => {
  it("should return true for valid absolute path on Unix", () => {
    const absolutePath = path.join(os.tmpdir(), "project", "src");
    expect(sanitizePath(absolutePath)).toBe(true);
  });

  it("should return false for path with .. traversal", () => {
    expect(sanitizePath("/foo/../bar")).toBe(false);
    expect(sanitizePath("/foo/bar/../../etc/passwd")).toBe(false);
  });

  it("should return false for path with Unicode horizontal ellipsis", () => {
    const withEllipsis = `/foo\u2025bar`;
    expect(sanitizePath(withEllipsis)).toBe(false);
  });

  it("should return false for path with Unicode vertical ellipsis", () => {
    const withEllipsis = `/foo\u2026bar`;
    expect(sanitizePath(withEllipsis)).toBe(false);
  });

  it("should return false for relative path", () => {
    expect(sanitizePath("foo/bar")).toBe(false);
    expect(sanitizePath("./foo")).toBe(false);
  });

  it("should return false when decoded path contains traversal", () => {
    const encodedTraversal = encodeURIComponent("/foo/../bar");
    expect(sanitizePath(encodedTraversal)).toBe(false);
  });
});
