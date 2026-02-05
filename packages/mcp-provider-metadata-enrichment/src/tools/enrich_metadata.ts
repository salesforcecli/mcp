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

import { z } from "zod";
import { SfProject } from '@salesforce/core';
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  baseAbsolutePathParam,
  directoryParam,
  usernameOrAliasParam,
} from "@salesforce/mcp-provider-dx-core";
import {
  McpTool,
  McpToolConfig,
  ReleaseState,
  Services,
  Toolset,
} from "@salesforce/mcp-provider-api";
import { ComponentSetBuilder } from "@salesforce/source-deploy-retrieve";
import { EnrichmentRecords } from "../shared/enrichmentRecords.js";
import { EnrichmentHandler, EnrichmentStatus, FileProcessor } from "@salesforce/metadata-enrichment";

/*
 * Enrich metadata in a Salesforce org.
 *
 * Parameters:
 * - sourceDir: Path to the local source files to deploy.
 * - usernameOrAlias: The username or alias for the Salesforce org to run this tool against.
 * - directory: The directory to run the tool from.
 * - metadataEntries: The metadata entries to enrich in format <componentType>:<componentName>
 *
 * Returns:
 * - Metadata enrichment result.
 */
export const enrichMetadataSchema = z.object({

  sourceDir: z
    .array(baseAbsolutePathParam)
    .describe(
      `Path to the local source files for metadata enrichment. Leave this unset if the user is vague about what to enrich.`
    )
    .optional(),

  usernameOrAlias: usernameOrAliasParam,

  directory: directoryParam,

  metadataEntries: z.array(z.string())
    .describe(
      `The metadata entries to enrich. Leave this unset if the user is vague about what to enrich. 
      Format: <componentType>:<componentName>`
    ),

});

type InputArgs = z.infer<typeof enrichMetadataSchema>;
type InputArgsShape = typeof enrichMetadataSchema.shape;

// Define output schema here:
// (In this case, choosing to not describe an output schema and just let the LLM figure things out)
type OutputArgsShape = z.ZodRawShape;

export class EnrichMetadataMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
  public constructor(private readonly services: Services) {
    super();
  }

  public getReleaseState(): ReleaseState {
    return ReleaseState.NON_GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.ENRICHMENT];
  }

  public getName(): string {
    return "enrich_metadata";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Enrich Metadata",
      description: 
      `Enrich the metadata for components in your Salesforce org.

      AGENT INSTRUCTIONS:
      If the user doesn't specify what to enrich exactly ("enrich my metadata"), 
      leave the "sourceDir" param empty and ask the user to provide component names to enrich based on their local source project.

      This tool only supports enriching Lightning Web Components (LWC).
      For LWCs, the corresponding type is "LightningComponentBundle" (case sensitive) when making enrichment requests.
      
      If the user specifies multiple components, try to batch the enrichment requests together as the tool can handle multiple components at a time.

      This is a different action from retrieving metadata (#retrieve_metadata) or deploying metadata (#deploy_metadata).
      This tool (#enrich_metadata) is for enrichment only and other tools should be used based on user's intended action.

      EXAMPLE USAGE:
      - Enrich this file in my org
      - Enrich this component in my org
      - Enrich X in my org
      - Enrich X metadata in my org
      - Enrich X, Y, Z in my org`,
      inputSchema: enrichMetadataSchema.shape,
      outputSchema: undefined,
      annotations: {
        readOnlyHint: true,
      },
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {

    if (!input.usernameOrAlias) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `The usernameOrAlias parameter is required, if the user did not specify one use the #get_username tool`,
          },
        ],
      };
    }

    if (!input.metadataEntries) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `User did not specify what to enrich. Please specify the specific file or component names for enrichment.`,
          },
        ],
      };
    }

    const connection = await this.services.getOrgService().getConnection(input.usernameOrAlias);
    const project = await SfProject.resolve(input.directory);

    const projectComponentSet = await ComponentSetBuilder.build({
      metadata: {
        metadataEntries: input.metadataEntries,
        directoryPaths: [project.getPath()],
      },
    });
    const projectSourceComponents = projectComponentSet.getSourceComponents().toArray();
    const enrichmentRecords = new EnrichmentRecords(projectSourceComponents);

    const componentsEligibleToProcess = projectSourceComponents.filter((component) => {
      const componentName = component.fullName ?? component.name;
      if (!componentName) return false;
      if (component.type?.name !== 'LightningComponentBundle') return false;
      return true;
    });

    if (componentsEligibleToProcess.length === 0) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `No eligible Lightning Component Bundle (LWC) components were found for enrichment.`,
          },
        ],
      }
    }

    const enrichmentResults = await EnrichmentHandler.enrich(connection, componentsEligibleToProcess);
    enrichmentRecords.updateWithResults(enrichmentResults);

    const fileUpdatedRecords = await FileProcessor.updateMetadataFiles(
      componentsEligibleToProcess,
      enrichmentRecords.recordSet
    );
    enrichmentRecords.updateWithResults(Array.from(fileUpdatedRecords));

    const componentList =
      Array.from(enrichmentRecords.recordSet)
        .filter((record) => record.status === EnrichmentStatus.SUCCESS)
        .map((record) => record.componentName)
        .join(', ') || 'none';
    return {
      isError: false,
      content: [
        {
          type: 'text',
          text: `Metadata enrichment completed. Components enriched: ${componentList}.`,
        },
      ],
    };
  }
}
