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
    .optional()
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
      `Enrich metadata components in your DX project by adding AI-generated descriptions.

      AGENT INSTRUCTIONS:
      The org must be eligible for metadata enrichment. The Salesforce admin can help enable it.

      If the user doesn't specify what exactly to enrich ("enrich my metadata"), ask the user to provide specific component names from their local project.
      Wildcards are supported for component names can match to components in the local project.

      This tool currently supports enriching only Lightning Web Components (LWC) which are represented by the LightningComponentBundle (case sensitive) metadata type.
      LightningComponentBundle is the type used for the enrichment requests for LWC.
      
      If any non-LWC is specified by the user for enrichment, the tool will skip those components, but will proceed with enriching any other specified LWC.
      
      If the user specifies multiple components, batch the enrichment requests together as the tool can handle multiple component enrichment at a time.

      Enrichment responses include components that were enriched successfully, failed, or were skipped.
      Do not use previous conversation context or previous successful enrichment responses to determine this status.
      The sole source of truth is the enrichment response each time enrichment is requested.

      This is a different action from retrieving metadata (#retrieve_metadata) or deploying metadata (#deploy_metadata).
      These other tools should be used instead if the user is intending to retrieve or deploy metadata rather than enrich.
      If it is unclear what the user intends to do, ask them to clarify.

      Enrichment updates the metadata files in the local project, but does not deploy them to the org.
      The user will need to deploy metadata to the org in order to save it.

      EXAMPLE USAGE:
      - Enrich this component in my org
      - Enrich X in my org
      - Enrich X metadata in my org
      - Enrich X, Y, Z in my org
      - Enrich X, Y, Z metadata in my org`,
      inputSchema: enrichMetadataSchema.shape,
      outputSchema: undefined,
      annotations: {
        openWorldHint: true,
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

    process.chdir(input.directory);
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
            text: `No eligible LWC was found for enrichment.`,
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
    const skippedRecords = Array.from(enrichmentRecords.recordSet).filter(
      (record) => record.status === EnrichmentStatus.SKIPPED
    );
    const failedRecords = Array.from(enrichmentRecords.recordSet).filter(
      (record) => record.status === EnrichmentStatus.FAIL
    );

    const summaryParts: string[] = [];
    if (successfulRecords.length === 0) {
      summaryParts.push('No components were enriched.');
    } else {
      summaryParts.push('Metadata enrichment completed. Components enriched:');
      summaryParts.push(...successfulRecords.map((r) => `  • ${r.componentName}`));
    }
    if (skippedRecords.length > 0) {
      summaryParts.push('Skipped:');
      summaryParts.push(
        ...skippedRecords.map((r) => `  • ${r.componentName}: ${r.message ?? 'Skipped'}`)
      );
    }
    if (failedRecords.length > 0) {
      summaryParts.push('Failed:');
      summaryParts.push(
        ...failedRecords.map((r) => `  • ${r.componentName}: ${r.message ?? 'Failed'}`)
      );
    }
    const summary = summaryParts.join('\n');

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
