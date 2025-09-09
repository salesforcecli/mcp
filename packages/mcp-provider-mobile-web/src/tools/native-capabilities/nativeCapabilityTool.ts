/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import { readFile } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { EmptySchema, TextOutputSchema } from '../../schemas/lwcSchema.js';
import { McpTool, type McpToolConfig } from '@salesforce/mcp-provider-api';
import { ReleaseState, Toolset, TelemetryService } from '@salesforce/mcp-provider-api';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { NativeCapabilityConfig } from './nativeCapabilityConfig.js';
import { TelemetryEventName } from '../../constants.js';
type InputArgsShape = typeof EmptySchema.shape;
type OutputArgsShape = typeof TextOutputSchema.shape;
type InputArgs = z.infer<typeof EmptySchema>;

export class NativeCapabilityTool extends McpTool<InputArgsShape, OutputArgsShape> {
  
  public readonly description: string;
  public readonly title: string;
  protected readonly typeDefinitionPath: string;
  public readonly toolId: string;
  protected readonly serviceDescription: string;
  public readonly serviceName: string;
  private readonly telemetryService: TelemetryService;
  constructor(config: NativeCapabilityConfig, telemetryService: TelemetryService) {
    super();
    this.description = config.description;
    this.title = config.title;
    this.typeDefinitionPath = config.typeDefinitionPath;
    this.toolId = config.toolId;
    this.serviceDescription = config.groundingDescription;
    this.serviceName = config.serviceName;
    this.telemetryService = telemetryService;
  }
  // Extract repeated path as a protected member
  protected readonly resourcesPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    'resources'
  );

  // Simplified - no parameter needed since it always uses this.typeDefinitionPath
  protected async readTypeDefinitionFile(): Promise<string> {
    return readFile(join(this.resourcesPath, this.typeDefinitionPath), 'utf-8');
  }

  protected async readBaseCapability(): Promise<string> {
    return readFile(join(this.resourcesPath, 'BaseCapability.d.ts'), 'utf-8');
  }

  protected async readMobileCapabilities(): Promise<string> {
    return readFile(join(this.resourcesPath, 'mobileCapabilities.d.ts'), 'utf-8');
  }

  protected createServiceGroundingText(
    typeDefinitions: string,
    baseCapability: string,
    mobileCapabilities: string
  ): string {
    return `# ${this.serviceName} Service Grounding Context

${this.serviceDescription}

## Base Capability
\`\`\`typescript
${baseCapability}
\`\`\`

## Mobile Capabilities
\`\`\`typescript
${mobileCapabilities}
\`\`\`

## ${this.serviceName} Service API
\`\`\`typescript
${typeDefinitions}
\`\`\``;
  }

  public getReleaseState(): ReleaseState {
    return ReleaseState.NON_GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.OTHER];
  }

  public getName(): string {
    return this.toolId;
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: this.title,
      description: this.description,
      inputSchema: EmptySchema.shape,
      outputSchema: undefined,
      annotations: {
        readOnlyHint: true,
      },
    };
  }

  public async exec(
    _args: InputArgs,
  ): Promise<CallToolResult> {
    try {
      this.telemetryService.sendEvent(TelemetryEventName, {
        toolId: this.getName(),
      });
      const typeDefinitions = await this.readTypeDefinitionFile();
      const baseCapability = await this.readBaseCapability();
      const mobileCapabilities = await this.readMobileCapabilities();
      const groundingText = this.createServiceGroundingText(
        typeDefinitions,
        baseCapability,
        mobileCapabilities
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: groundingText,
          },
        ],
        structuredContent: {
          content: groundingText,
        }
      };
    } catch {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `Error: Unable to load ${this.toolId} type definitions.`,
          },
        ],
        structuredContent: {
          content: `Error: Unable to load ${this.toolId} type definitions.`,
        }
      };
      
    }
  }

}
