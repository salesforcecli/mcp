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

import { mkdirSync } from "fs";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Connection, SfProject } from "@salesforce/core";
import { ReleaseState, Toolset, Services } from "@salesforce/mcp-provider-api";
import { EnrichmentStatus } from "@salesforce/metadata-enrichment";
import { EnrichmentHandler, FileProcessor } from "@salesforce/metadata-enrichment";
import type { EnrichmentRequestRecord } from "@salesforce/metadata-enrichment";
import { ComponentSetBuilder } from "@salesforce/source-deploy-retrieve";
import { ComponentProcessor } from "../../src/shared/componentProcessor.js";
import { EnrichMetadataMcpTool } from "../../src/tools/enrich_metadata.js";
import { StubServices } from "../test-doubles.js";

vi.mock("@salesforce/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@salesforce/core")>();
  return {
    ...actual,
    SfProject: { resolve: vi.fn().mockResolvedValue({ getPath: () => "/tmp/proj" }) },
  };
});

vi.mock("@salesforce/source-deploy-retrieve", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@salesforce/source-deploy-retrieve")>();
  const lwcComponent = {
    fullName: "myLwc",
    name: "myLwc",
    type: { name: "LightningComponentBundle" },
  };
  return {
    ...actual,
    ComponentSetBuilder: {
      build: vi.fn().mockResolvedValue({
        getSourceComponents: () => ({ toArray: () => [lwcComponent] }),
      }),
    },
  };
});

describe("EnrichMetadataMcpTool", () => {
  let tool: EnrichMetadataMcpTool;

  beforeEach(() => {
    tool = new EnrichMetadataMcpTool(new StubServices());
  });

  it("getName returns enrich_metadata", () => {
    expect(tool.getName()).toBe("enrich_metadata");
  });

  it("getReleaseState returns NON_GA", () => {
    expect(tool.getReleaseState()).toBe(ReleaseState.NON_GA);
  });

  it("getToolsets returns ENRICHMENT", () => {
    expect(tool.getToolsets()).toEqual([Toolset.ENRICHMENT]);
  });

  it("getConfig returns title and input schema keys", () => {
    const config = tool.getConfig();
    expect(config.title).toBe("Enrich Metadata");
    expect(config.annotations).toEqual({ openWorldHint: true });
    expect(Object.keys(config.inputSchema as object).sort()).toEqual(
      ["directory", "metadataEntries", "usernameOrAlias"].sort()
    );
  });

  it("exec returns error when usernameOrAlias is empty", async () => {
    const result = await tool.exec({
      usernameOrAlias: "",
      directory: "/some/dir",
      metadataEntries: ["LightningComponentBundle:foo"],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    if (result.content[0].type === "text") {
      expect(result.content[0].text).toContain("usernameOrAlias");
      expect(result.content[0].text).toContain("#get_username");
    }
  });

  it("exec returns error when metadataEntries is missing", async () => {
    const result = await tool.exec({
      usernameOrAlias: "user@example.com",
      directory: "/some/dir",
      metadataEntries: undefined as unknown as string[],
    });
    expect(result.isError).toBe(true);
    if (result.content[0].type === "text") {
      expect(result.content[0].text).toContain("did not specify what to enrich");
    }
  });

  describe("happy path", () => {
    const mockConnection = {} as Connection;
    let servicesWithConnection: Services;

    beforeEach(() => {
      mkdirSync("/tmp/proj", { recursive: true });
      const stub = new StubServices();
      servicesWithConnection = {
        ...stub,
        getOrgService: () => ({
          getConnection: () => Promise.resolve(mockConnection),
        }),
      } as unknown as Services;
      vi.spyOn(ComponentProcessor, "getComponentsToSkip").mockReturnValue(new Set());
      vi.spyOn(EnrichmentHandler, "enrich").mockResolvedValue([
        {
          componentName: "myLwc",
          componentType: { name: "LightningComponentBundle" },
          requestBody: { contentBundles: [], metadataType: "Generic", maxTokens: 50 },
          response: {},
          message: null,
          status: EnrichmentStatus.SUCCESS,
        },
      ] as unknown as EnrichmentRequestRecord[]);
      vi.spyOn(FileProcessor, "updateMetadataFiles").mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof FileProcessor.updateMetadataFiles>>
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("exec returns success and completion message when enrichment succeeds", async () => {
      const happyPathTool = new EnrichMetadataMcpTool(servicesWithConnection);
      const result = await happyPathTool.exec({
        usernameOrAlias: "user@example.com",
        directory: "/tmp/proj",
        metadataEntries: ["LightningComponentBundle:myLwc"],
      });

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      if (result.content[0].type === "text") {
        expect(result.content[0].text).toContain("Metadata enrichment completed");
        expect(result.content[0].text).toContain("  • myLwc");
        expect(result.content[0].text).not.toContain("Skipped:");
        expect(result.content[0].text).not.toContain("Failed:");
      }
    });
  });

  describe("summary includes skipped records", () => {
    const mockConnection = {} as Connection;

    beforeEach(() => {
      mkdirSync("/tmp/proj", { recursive: true });
      vi.mocked(SfProject.resolve).mockResolvedValue({ getPath: () => "/tmp/proj" } as never);
      const lwcComponent = {
        fullName: "myLwc",
        name: "myLwc",
        type: { name: "LightningComponentBundle" },
      };
      const skippedComponent = {
        fullName: "otherCmp",
        name: "otherCmp",
        type: { name: "LightningComponentBundle" },
      };
      vi.mocked(ComponentSetBuilder.build).mockResolvedValue({
        getSourceComponents: () => ({
          toArray: () => [lwcComponent, skippedComponent],
        }),
      } as never);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("exec summary lists enriched components and skipped components with reason", async () => {
      const stub = new StubServices();
      const servicesWithConnection = {
        ...stub,
        getOrgService: () => ({
          getConnection: () => Promise.resolve(mockConnection),
        }),
      } as unknown as Services;
      vi.spyOn(ComponentProcessor, "getComponentsToSkip").mockReturnValue(
        new Set([
          { typeName: "LightningComponentBundle", componentName: "otherCmp" },
        ])
      );
      vi.spyOn(EnrichmentHandler, "enrich").mockResolvedValue([
        {
          componentName: "myLwc",
          componentType: { name: "LightningComponentBundle" },
          requestBody: { contentBundles: [], metadataType: "Generic", maxTokens: 50 },
          response: {},
          message: null,
          status: EnrichmentStatus.SUCCESS,
        },
      ] as unknown as EnrichmentRequestRecord[]);
      vi.spyOn(FileProcessor, "updateMetadataFiles").mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof FileProcessor.updateMetadataFiles>>
      );

      const tool = new EnrichMetadataMcpTool(servicesWithConnection);
      const result = await tool.exec({
        usernameOrAlias: "user@example.com",
        directory: "/tmp/proj",
        metadataEntries: ["LightningComponentBundle:myLwc", "LightningComponentBundle:otherCmp"],
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].type === "text" ? result.content[0].text : "";
      expect(text).toContain("Metadata enrichment completed. Components enriched:");
      expect(text).toContain("  • myLwc");
      expect(text).toContain("Skipped:");
      expect(text).toContain("  • otherCmp: Skipped");
    });
  });

  describe("summary includes failed records", () => {
    const mockConnection = {} as Connection;

    beforeEach(() => {
      mkdirSync("/tmp/proj", { recursive: true });
      vi.mocked(SfProject.resolve).mockResolvedValue({ getPath: () => "/tmp/proj" } as never);
      const lwcComponent = {
        fullName: "myLwc",
        name: "myLwc",
        type: { name: "LightningComponentBundle" },
      };
      const failedComponent = {
        fullName: "failedCmp",
        name: "failedCmp",
        type: { name: "LightningComponentBundle" },
      };
      vi.mocked(ComponentSetBuilder.build).mockResolvedValue({
        getSourceComponents: () => ({
          toArray: () => [lwcComponent, failedComponent],
        }),
      } as never);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("exec summary lists enriched components and failed components with message", async () => {
      const stub = new StubServices();
      const servicesWithConnection = {
        ...stub,
        getOrgService: () => ({
          getConnection: () => Promise.resolve(mockConnection),
        }),
      } as unknown as Services;
      vi.spyOn(ComponentProcessor, "getComponentsToSkip").mockReturnValue(new Set());
      vi.spyOn(EnrichmentHandler, "enrich").mockResolvedValue([
        {
          componentName: "myLwc",
          componentType: { name: "LightningComponentBundle" },
          requestBody: { contentBundles: [], metadataType: "Generic", maxTokens: 50 },
          response: {},
          message: null,
          status: EnrichmentStatus.SUCCESS,
        },
        {
          componentName: "failedCmp",
          componentType: { name: "LightningComponentBundle" },
          requestBody: { contentBundles: [], metadataType: "Generic", maxTokens: 50 },
          response: null,
          message: "Enrichment API error",
          status: EnrichmentStatus.FAIL,
        },
      ] as unknown as EnrichmentRequestRecord[]);
      vi.spyOn(FileProcessor, "updateMetadataFiles").mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof FileProcessor.updateMetadataFiles>>
      );

      const tool = new EnrichMetadataMcpTool(servicesWithConnection);
      const result = await tool.exec({
        usernameOrAlias: "user@example.com",
        directory: "/tmp/proj",
        metadataEntries: ["LightningComponentBundle:myLwc", "LightningComponentBundle:failedCmp"],
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].type === "text" ? result.content[0].text : "";
      expect(text).toContain("Metadata enrichment completed. Components enriched:");
      expect(text).toContain("  • myLwc");
      expect(text).toContain("Failed:");
      expect(text).toContain("  • failedCmp: Enrichment API error");
    });
  });
});
