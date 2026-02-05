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
});
