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

import { McpProvider, McpTool, Services } from '@salesforce/mcp-provider-api';
import { NativeCapabilityTool } from './tools/native-capabilities/sf-mobile-native-capability.js';
import { OfflineAnalysisTool } from './tools/offline-analysis/sf-mobile-web-offline-analysis.js';
import { OfflineGuidanceTool } from './tools/offline-guidance/sf-mobile-web-offline-guidance.js';
import { nativeCapabilityConfigs } from './tools/native-capabilities/nativeCapabilityConfig.js';

export class MobileWebMcpProvider extends McpProvider {
  public getName(): string {
    return 'MobileWebMcpProvider';
  }

  public provideTools(_services: Services): Promise<McpTool[]> {
    const nativeCapabilityTools: NativeCapabilityTool[] = [];
    for (const config of nativeCapabilityConfigs) {
      nativeCapabilityTools.push(new NativeCapabilityTool(config));
    }

    return Promise.resolve([new OfflineAnalysisTool(), new OfflineGuidanceTool(), ...nativeCapabilityTools]);
  }
}
