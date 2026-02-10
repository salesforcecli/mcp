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

import { describe, it, expect, beforeEach } from "vitest";
import type { McpTool, Services } from "@salesforce/mcp-provider-api";
import { EnrichMetadataMcpProvider } from "../../src/provider.js";
import { EnrichMetadataMcpTool } from "../../src/tools/enrich_metadata.js";
import { StubServices } from "../test-doubles.js";

describe("EnrichMetadataMcpProvider", () => {
  let services: Services;
  let provider: EnrichMetadataMcpProvider;

  beforeEach(() => {
    services = new StubServices();
    provider = new EnrichMetadataMcpProvider();
  });

  it("getName returns EnrichMetadataMcpProvider", () => {
    expect(provider.getName()).toBe("EnrichMetadataMcpProvider");
  });

  it("provideTools returns a promise that resolves to an array containing EnrichMetadataMcpTool", async () => {
    const tools: McpTool[] = await provider.provideTools(services);
    expect(tools).toHaveLength(1);
    expect(tools[0]).toBeInstanceOf(EnrichMetadataMcpTool);
    expect(tools[0].getName()).toBe("enrich_metadata");
  });
});
