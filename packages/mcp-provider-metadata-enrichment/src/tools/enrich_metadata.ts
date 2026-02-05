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
import { ComponentProcessor } from "../shared/componentProcessor.js";
import { EnrichmentHandler, EnrichmentStatus, FileProcessor } from "@salesforce/metadata-enrichment";

/*
 * Enrich metadata in a Salesforce org.
 *
 * Parameters:
 * - usernameOrAlias: The username or alias for the Salesforce org to run this tool against.
 * - directory: The directory to run the tool from.
 * - metadataEntries: The metadata entries to enrich in format <componentType>:<componentName>
 *
 * Returns:
 * - Metadata enrichment result.
 */
export const enrichMetadataSchema = z.object({

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
      If the user doesn't specify what to enrich exactly ("enrich my metadata"), ask the user to provide specific component names based on their local project.

      This tool only supports enriching Lightning Web Components (LWC). 
      For LWCs, the corresponding type is "LightningComponentBundle" (case sensitive) when making enrichment requests.
      If any non-LWC is specified by the user for enrichment, the tool will skip those components but proceed with enriching any specified LWC.
      
      If the user specifies multiple components, batch the enrichment requests together as the tool can handle enriching multiple components at a time.

      This is a different action from retrieving metadata (#retrieve_metadata) or deploying metadata (#deploy_metadata).
      This tool (#enrich_metadata) is for enrichment only and other tools should be used instead based on the user's intended action.

      EXAMPLE USAGE:
      - Enrich this component in my org
      - Enrich X in my org
      - Enrich X metadata in my org
      - Enrich X, Y, Z in my org
      - Enrich X, Y, Z metadata in my org`,
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

    const componentsToSkip = ComponentProcessor.getComponentsToSkip(
      projectSourceComponents,
      input.metadataEntries,
      project.getPath()
    );
    enrichmentRecords.addSkippedComponents(componentsToSkip);
    enrichmentRecords.updateWithStatus(componentsToSkip, EnrichmentStatus.SKIPPED);

    const componentsEligibleToProcess = projectSourceComponents.filter((component) => {
      const componentName = component.fullName ?? component.name;
      if (!componentName) return false;
      for (const skip of componentsToSkip) {
        if (skip.componentName === componentName) return false;
      }
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

    const successfulRecords = Array.from(enrichmentRecords.recordSet).filter(
      (record) => record.status === EnrichmentStatus.SUCCESS
    );

    let summary: string;
    if (successfulRecords.length === 0) {
      summary = 'No components were enriched.';
    } else {
      const header = 'Metadata enrichment completed. Components enriched:';
      const bullets = successfulRecords.map((r) => `  • ${r.componentName}`);
      summary = [header, ...bullets].join('\n');
    }

    return {
      isError: false,
      content: [
        { 
          type: 'text', 
          text: summary 
        }
      ],
    };
  }
}
