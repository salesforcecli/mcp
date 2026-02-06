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
import type { EnrichmentRequestRecord } from "@salesforce/metadata-enrichment";
import { EnrichmentStatus } from "@salesforce/metadata-enrichment";
import { EnrichmentRecords } from "../../src/shared/enrichmentRecords.js";

function createSourceComponent(overrides: {
  fullName?: string;
  name?: string;
  typeName?: string;
}): SourceComponent {
  const name = overrides.fullName ?? overrides.name ?? "TestComponent";
  return {
    fullName: overrides.fullName,
    name: overrides.name ?? name,
    type: { name: overrides.typeName ?? "LightningComponentBundle" },
  } as SourceComponent;
}

describe("EnrichmentRecords", () => {
  describe("constructor", () => {
    it("creates an empty recordSet when given no components", () => {
      const records = new EnrichmentRecords([]);
      expect(records.recordSet.size).toBe(0);
    });

    it("creates a record for each component with name and type", () => {
      const components: SourceComponent[] = [
        createSourceComponent({ fullName: "cmpA", name: "cmpA" }),
        createSourceComponent({ fullName: "cmpB", name: "cmpB" }),
      ];
      const records = new EnrichmentRecords(components);
      expect(records.recordSet.size).toBe(2);
      const arr = Array.from(records.recordSet);
      expect(arr.map((r) => r.componentName).sort()).toEqual(["cmpA", "cmpB"]);
      arr.forEach((r) => {
        expect(r.status).toBe(EnrichmentStatus.NOT_PROCESSED);
        expect(r.requestBody).toEqual({
          contentBundles: [],
          metadataType: "Generic",
          maxTokens: 50,
        });
        expect(r.response).toBeNull();
        expect(r.message).toBeNull();
      });
    });

    it("uses fullName when present, otherwise name", () => {
      const withFullName = createSourceComponent({
        fullName: "MyFullName",
        name: "fallbackName",
      });
      const records = new EnrichmentRecords([withFullName]);
      const record = Array.from(records.recordSet)[0];
      expect(record.componentName).toBe("MyFullName");
    });

    it("skips components without a name (no fullName and no name)", () => {
      const noName = {
        fullName: undefined,
        name: undefined,
        type: { name: "ApexClass" },
      } as unknown as SourceComponent;
      const records = new EnrichmentRecords([noName]);
      expect(records.recordSet.size).toBe(0);
    });

    it("skips components without a type", () => {
      const noType = {
        fullName: "orphan",
        name: "orphan",
        type: undefined,
      } as unknown as SourceComponent;
      const records = new EnrichmentRecords([noType]);
      expect(records.recordSet.size).toBe(0);
    });
  });

  describe("addSkippedComponents", () => {
    it("adds new skipped component records", () => {
      const records = new EnrichmentRecords([
        createSourceComponent({ fullName: "a", name: "a" }),
      ]);
      records.addSkippedComponents(
        new Set([
          { typeName: "LightningComponentBundle", componentName: "skippedCmp" },
        ])
      );
      const arr = Array.from(records.recordSet);
      expect(arr).toHaveLength(2);
      const skipped = arr.find((r) => r.componentName === "skippedCmp");
      expect(skipped).toBeDefined();
      expect(skipped!.status).toBe(EnrichmentStatus.SKIPPED);
    });
  });

  describe("updateWithStatus", () => {
    it("updates status for matching records", () => {
      const components = [
        createSourceComponent({ fullName: "c1", name: "c1" }),
        createSourceComponent({ fullName: "c2", name: "c2" }),
      ];
      const records = new EnrichmentRecords(components);
      records.updateWithStatus(
        new Set([
          { typeName: "LightningComponentBundle", componentName: "c1" },
        ]),
        EnrichmentStatus.SKIPPED
      );
      const arr = Array.from(records.recordSet);
      expect(arr.find((r) => r.componentName === "c1")!.status).toBe(
        EnrichmentStatus.SKIPPED
      );
      expect(arr.find((r) => r.componentName === "c2")!.status).toBe(
        EnrichmentStatus.NOT_PROCESSED
      );
    });
  });

  describe("updateWithResults", () => {
    it("updates records with result data and sets SUCCESS when response is present", () => {
      const components = [
        createSourceComponent({ fullName: "x", name: "x" }),
      ];
      const records = new EnrichmentRecords(components);
      const resultWithResponse = {
        componentName: "x",
        componentType: { name: "LWC" } as SourceComponent["type"],
        requestBody: { contentBundles: [], metadataType: "Generic" as const, maxTokens: 50 },
        response: { some: "response" } as unknown as EnrichmentRequestRecord["response"],
        message: "ok",
        status: EnrichmentStatus.SUCCESS,
      } as EnrichmentRequestRecord;
      records.updateWithResults([resultWithResponse]);
      const record = Array.from(records.recordSet)[0];
      expect(record.status).toBe(EnrichmentStatus.SUCCESS);
      expect(record.response).toEqual({ some: "response" });
      expect(record.message).toBe("ok");
    });

    it("sets FAIL when result has no response", () => {
      const components = [
        createSourceComponent({ fullName: "y", name: "y" }),
      ];
      const records = new EnrichmentRecords(components);
      records.updateWithResults([
        {
          componentName: "y",
          componentType: { name: "LWC" } as SourceComponent["type"],
          requestBody: { contentBundles: [], metadataType: "Generic", maxTokens: 50 },
          response: null,
          message: "error",
          status: EnrichmentStatus.FAIL,
        },
      ]);
      const record = Array.from(records.recordSet)[0];
      expect(record.status).toBe(EnrichmentStatus.FAIL);
      expect(record.response).toBeNull();
      expect(record.message).toBe("error");
    });

    it("updates only matching records when results are partial", () => {
      const components = [
        createSourceComponent({ fullName: "m1", name: "m1" }),
        createSourceComponent({ fullName: "m2", name: "m2" }),
      ];
      const records = new EnrichmentRecords(components);
      records.updateWithResults([
        {
          componentName: "m1",
          componentType: { name: "LWC" } as SourceComponent["type"],
          requestBody: { contentBundles: [], metadataType: "Generic" as const, maxTokens: 50 },
          response: {} as unknown as EnrichmentRequestRecord["response"],
          message: null,
          status: EnrichmentStatus.SUCCESS,
        } as EnrichmentRequestRecord,
      ]);
      const arr = Array.from(records.recordSet);
      expect(arr.find((r) => r.componentName === "m1")!.status).toBe(
        EnrichmentStatus.SUCCESS
      );
      expect(arr.find((r) => r.componentName === "m2")!.status).toBe(
        EnrichmentStatus.NOT_PROCESSED
      );
    });
  });
});
