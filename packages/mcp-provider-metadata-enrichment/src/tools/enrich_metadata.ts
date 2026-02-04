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
import { sanitizePath } from '../shared/utils.js';
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
    .array(z.string())
    .describe(
      `Path to the local source files for metadata enrichment. Leave this unset if the user is vague about what to deploy.`
    )
    .optional(),

  usernameOrAlias: z.string()
    .describe(
      `The username or alias for the Salesforce org to run this tool against.

      A username follows the <name@domain.com> format.
      If the user refers to an org with a string not following that format, it can be a valid alias.

      IMPORTANT:
      - If it is not clear what the username or alias is, run the #get_username tool to resolve it.
      - NEVER guess or make-up a username or alias.`
    ),

  directory: z.string()
    .refine(sanitizePath, 'Invalid path: Must be an absolute path and cannot contain path traversal sequences')
    .describe(
      `The directory to run the tool from.
      
      AGENT INSTRUCTIONS:
      We need to know where the user wants to run this tool from.
      Look at your current Workspace Context to determine this filepath.
      ALWAYS USE A FULL PATH TO THE DIRECTORY.
      Unless the user explicitly asks for a different directory, or a new directory is created from the action of a tool, use this same directory for future tool calls.`
    ),

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
      If the user doesn't specify what to enrich exactly ("enrich my metadata"), leave the "sourceDir" param empty.
      Ask the user to provide the specific file or component names to enrich.
      
      EXAMPLE USAGES:
      - Enrich this file in my org
      - Enrich the metadata for this file in my org
      - Enrich this component in my org
      - Enrich the metadata for this component in my org
      - Enrich X metadata in my org
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

    // TODO - Not needed?
    // process.chdir(input.directory);

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
