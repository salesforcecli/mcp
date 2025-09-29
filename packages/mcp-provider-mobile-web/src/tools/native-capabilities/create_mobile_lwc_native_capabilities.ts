/*
 * Copyright 2025, Salesforce, Inc.
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

import { readFile } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { EmptySchema, TextOutputSchema } from '../../schemas/lwcSchema.js';
import { McpTool, type McpToolConfig } from '@salesforce/mcp-provider-api';
import { ReleaseState, Toolset } from '@salesforce/mcp-provider-api';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { NativeCapabilityConfig } from './nativeCapabilityConfig.js';
type InputArgsShape = typeof EmptySchema.shape;
type OutputArgsShape = typeof TextOutputSchema.shape;
type InputArgs = z.infer<typeof EmptySchema>;

export class NativeCapabilityTool extends McpTool<InputArgsShape, OutputArgsShape> {
  private readonly description: string;
  public readonly title: string;
  private readonly typeDefinitionPath: string;
  private readonly toolId: string;
  private readonly serviceDescription: string;
  private readonly serviceName: string;
  private readonly isCore: boolean;
  constructor(config: NativeCapabilityConfig) {
    super();
    this.description = config.description;
    this.title = config.title;
    this.typeDefinitionPath = config.typeDefinitionPath;
    this.toolId = config.toolId;
    this.serviceDescription = config.groundingDescription;
    this.serviceName = config.serviceName;
    this.isCore = config.isCore;
  }
  // Extract repeated path as a protected member
  private readonly resourcesPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'resources');

  // Simplified - no parameter needed since it always uses this.typeDefinitionPath
  private async readTypeDefinitionFile(): Promise<string> {
    return readFile(join(this.resourcesPath, this.typeDefinitionPath), 'utf-8');
  }

  private async readBaseCapability(): Promise<string> {
    return readFile(join(this.resourcesPath, 'BaseCapability.d.ts'), 'utf-8');
  }

  private async readMobileCapabilities(): Promise<string> {
    return readFile(join(this.resourcesPath, 'mobileCapabilities.d.ts'), 'utf-8');
  }

  private createServiceGroundingText(
    typeDefinitions: string,
    baseCapability: string,
    mobileCapabilities: string,
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
    return ReleaseState.GA;
  }

  public getToolsets(): Toolset[] {
    return this.isCore ? [Toolset.MOBILE, Toolset.MOBILE_CORE] : [Toolset.MOBILE];
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

  public async exec(_args: InputArgs): Promise<CallToolResult> {
    try {
      const typeDefinitions = await this.readTypeDefinitionFile();
      const baseCapability = await this.readBaseCapability();
      const mobileCapabilities = await this.readMobileCapabilities();
      const groundingText = this.createServiceGroundingText(typeDefinitions, baseCapability, mobileCapabilities);
      return {
        content: [
          {
            type: 'text' as const,
            text: groundingText,
          },
        ],
        structuredContent: {
          content: groundingText,
        },
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
        },
      };
    }
  }
}
