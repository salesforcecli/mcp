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

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Connection } from "@salesforce/core";
import { ReleaseState, Toolset, Services } from "@salesforce/mcp-provider-api";
import type { EnrichmentRequestRecord } from "@salesforce/metadata-enrichment";
import { EnrichmentStatus } from "@salesforce/metadata-enrichment";
import { EnrichmentHandler, FileProcessor } from "@salesforce/metadata-enrichment";
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
    expect(config.annotations).toEqual({ readOnlyHint: true });
    expect(Object.keys(config.inputSchema as object).sort()).toEqual(
      ["directory", "metadataEntries", "sourceDir", "usernameOrAlias"].sort()
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

  describe("successful enrichment", () => {
    const mockConnection = {} as Connection;
    let servicesWithConnection: Services;

    beforeEach(() => {
      const stub = new StubServices();
      servicesWithConnection = {
        ...stub,
        getOrgService: () => ({
          getConnection: () => Promise.resolve(mockConnection),
        }),
      } as unknown as Services;
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
        expect(result.content[0].text).toContain("myLwc");
      }
    });
  });
});
