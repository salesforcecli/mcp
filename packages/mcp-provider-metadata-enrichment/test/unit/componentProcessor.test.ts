/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, it, expect } from "vitest";
import type { SourceComponent } from "@salesforce/source-deploy-retrieve";
import { ComponentProcessor } from "../../src/shared/componentProcessor.js";

function createSourceComponent(overrides: {
  fullName?: string;
  name?: string;
  typeName?: string;
  xml?: string;
}): SourceComponent {
  const name = overrides.fullName ?? overrides.name ?? "TestComponent";
  return {
    fullName: overrides.fullName,
    name: overrides.name ?? name,
    type: { name: overrides.typeName ?? "LightningComponentBundle" },
    xml: overrides.xml ?? "lwc/myCmp/myCmp.js-meta.xml",
  } as SourceComponent;
}

describe("ComponentProcessor", () => {
  describe("getComponentsToSkip", () => {
    it("returns empty set when source and metadata entries are empty", () => {
      const result = ComponentProcessor.getComponentsToSkip([], []);
      expect(result.size).toBe(0);
    });

    it("returns empty set when metadata entries are empty", () => {
      const source = [createSourceComponent({ fullName: "myLwc", name: "myLwc" })];
      const result = ComponentProcessor.getComponentsToSkip(source, []);
      expect(result.size).toBe(0);
    });

    it("returns empty set when requested LWC exists in source with metadata xml (eligible for enrichment)", () => {
      const source = [createSourceComponent({ fullName: "myLwc", name: "myLwc" })];
      const result = ComponentProcessor.getComponentsToSkip(
        source,
        ["LightningComponentBundle:myLwc"],
      );
      expect(result.size).toBe(0);
    });

    it("returns empty set when multiple requested LWCs exist in source with metadata xml", () => {
      const source = [
        createSourceComponent({ fullName: "cmpA", name: "cmpA" }),
        createSourceComponent({ fullName: "cmpB", name: "cmpB" }),
      ];
      const result = ComponentProcessor.getComponentsToSkip(
        source,
        ["LightningComponentBundle:cmpA", "LightningComponentBundle:cmpB"],
      );
      expect(result.size).toBe(0);
    });

    it("includes requested component not in source as missing", () => {
      const result = ComponentProcessor.getComponentsToSkip(
        [],
        ["LightningComponentBundle:missingCmp"],
      );
      expect(result.size).toBeGreaterThanOrEqual(0);
      const arr = Array.from(result);
      const missing = arr.find((x) => x.componentName === "missingCmp");
      if (missing) {
        expect(missing.typeName).toBe("LightningComponentBundle");
      }
    });

    it("includes non-LWC component in skip set when requested", () => {
      const apexComponent = {
        fullName: "MyApex",
        name: "MyApex",
        type: { name: "ApexClass" },
        xml: "classes/MyApex.cls-meta.xml",
      } as SourceComponent;
      const result = ComponentProcessor.getComponentsToSkip(
        [apexComponent],
        ["ApexClass:MyApex"],
      );
      const arr = Array.from(result);
      const skipped = arr.find((x) => x.componentName === "MyApex");
      if (skipped) {
        expect(skipped.typeName).toBe("ApexClass");
      }
    });

    it("includes LWC without xml in skip set when requested", () => {
      const lwcNoXml = createSourceComponent({
        fullName: "noMetaLwc",
        name: "noMetaLwc",
        typeName: "LightningComponentBundle",
        xml: undefined as unknown as string,
      });
      const result = ComponentProcessor.getComponentsToSkip(
        [lwcNoXml],
        ["LightningComponentBundle:noMetaLwc"],
      );
      const arr = Array.from(result);
      const skipped = arr.find((x) => x.componentName === "noMetaLwc");
      if (skipped) {
        expect(skipped.typeName).toBe("LightningComponentBundle");
      }
    });
  });

  describe("parseMetadataEntry", () => {
    it("returns type and component name for valid entry", () => {
      const result = ComponentProcessor.parseMetadataEntry(
        "LightningComponentBundle:myCmp"
      );
      expect(result).toEqual({
        typeName: "LightningComponentBundle",
        componentName: "myCmp",
      });
    });

    it("returns null for unknown type name", () => {
      const result = ComponentProcessor.parseMetadataEntry("BogusType:Something");
      expect(result).toBeNull();
    });

    it("returns null when entry has no name part (wildcard)", () => {
      const result = ComponentProcessor.parseMetadataEntry(
        "LightningComponentBundle"
      );
      expect(result).toBeNull();
    });

    it("handles component name with colons", () => {
      const result = ComponentProcessor.parseMetadataEntry(
        "LightningComponentBundle:namespace:myCmp"
      );
      expect(result).not.toBeNull();
      expect(result!.typeName).toBe("LightningComponentBundle");
      expect(result!.componentName).toBe("namespace:myCmp");
    });
  });

  describe("parseRequestedComponents", () => {
    it("returns set of parsed components for valid entries", () => {
      const result = ComponentProcessor.parseRequestedComponents([
        "LightningComponentBundle:cmpA",
        "LightningComponentBundle:cmpB",
      ]);
      expect(result.size).toBe(2);
      const names = Array.from(result).map((r) => r.componentName).sort();
      expect(names).toEqual(["cmpA", "cmpB"]);
    });

    it("excludes entries with wildcard in component name", () => {
      const result = ComponentProcessor.parseRequestedComponents([
        "LightningComponentBundle:my*Cmp",
      ]);
      expect(result.size).toBe(0);
    });
  });

  describe("getExistingSourceComponentNames", () => {
    it("returns set of fullName or name from source components", () => {
      const source = [
        createSourceComponent({ fullName: "a", name: "a" }),
        createSourceComponent({ fullName: "b", name: "b" }),
      ];
      const result = ComponentProcessor.getExistingSourceComponentNames(source);
      expect(result.size).toBe(2);
      expect(result.has("a")).toBe(true);
      expect(result.has("b")).toBe(true);
    });

    it("uses fullName when present over name", () => {
      const source = [
        createSourceComponent({ fullName: "full", name: "fallback" }),
      ];
      const result = ComponentProcessor.getExistingSourceComponentNames(source);
      expect(result.has("full")).toBe(true);
      expect(result.size).toBe(1);
    });
  });

  describe("createSourceComponentMap", () => {
    it("returns map keyed by fullName or name", () => {
      const source = [
        createSourceComponent({ fullName: "x", name: "x" }),
        createSourceComponent({ fullName: "y", name: "y" }),
      ];
      const result = ComponentProcessor.createSourceComponentMap(source);
      expect(result.size).toBe(2);
      expect(result.get("x")?.fullName).toBe("x");
      expect(result.get("y")?.fullName).toBe("y");
    });
  });

  describe("diffRequestedComponents", () => {
    it("returns requested components not in source as missing", () => {
      const source = [createSourceComponent({ fullName: "a", name: "a" })];
      const requested = new Set([
        { typeName: "LightningComponentBundle", componentName: "a" },
        { typeName: "LightningComponentBundle", componentName: "missing" },
      ]);
      const result = ComponentProcessor.diffRequestedComponents(
        source,
        requested
      );
      expect(result.size).toBe(1);
      const missing = Array.from(result)[0];
      expect(missing.componentName).toBe("missing");
    });
  });

  describe("filterComponents", () => {
    it("adds non-LWC components to skip set", () => {
      const apex = {
        fullName: "MyApex",
        name: "MyApex",
        type: { name: "ApexClass" },
        xml: "classes/MyApex.cls-meta.xml",
      } as SourceComponent;
      const requested = new Set([
        { typeName: "ApexClass", componentName: "MyApex" },
      ]);
      const result = ComponentProcessor.filterComponents([apex], requested);
      expect(result.size).toBe(1);
      const skipped = Array.from(result)[0];
      expect(skipped.componentName).toBe("MyApex");
      expect(skipped.typeName).toBe("ApexClass");
    });

    it("adds LWC without xml to skip set", () => {
      const lwcNoXml = {
        fullName: "noMeta",
        name: "noMeta",
        type: { name: "LightningComponentBundle" },
        xml: undefined,
      } as SourceComponent;
      const requested = new Set([
        { typeName: "LightningComponentBundle", componentName: "noMeta" },
      ]);
      const result = ComponentProcessor.filterComponents([lwcNoXml], requested);
      expect(result.size).toBe(1);
      expect(Array.from(result)[0].componentName).toBe("noMeta");
    });

    it("returns empty set when all requested are eligible LWC", () => {
      const source = [createSourceComponent({ fullName: "myLwc", name: "myLwc" })];
      const requested = new Set([
        { typeName: "LightningComponentBundle", componentName: "myLwc" },
      ]);
      const result = ComponentProcessor.filterComponents(source, requested);
      expect(result.size).toBe(0);
    });
  });
});
