import { describe, expect, it } from "vitest";
import { escapeXml, toSafeFilenameSlug } from "../src/utils.js";

describe("utils", () => {
  describe("escapeXml", () => {
    it("escapes XML special characters", () => {
      expect(escapeXml(`Tom & "Jerry" <tag>'s</tag>`))
        .toBe("Tom &amp; &quot;Jerry&quot; &lt;tag&gt;&apos;s&lt;/tag&gt;");
    });
  });

  describe("toSafeFilenameSlug", () => {
    it("normalizes spaces and invalid characters", () => {
      expect(toSafeFilenameSlug("  My Rule:Name  ")).toBe("my-rule-name");
    });

    it("removes path separators and collapses dashes", () => {
      expect(toSafeFilenameSlug("foo/bar\\baz---qux")).toBe("foo-bar-baz-qux");
    });

    it("falls back to a default when empty", () => {
      expect(toSafeFilenameSlug("   ")).toBe("custom-rule");
    });
  });
});
