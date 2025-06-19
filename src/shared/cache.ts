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

import { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TOOLSET_REGISTRY } from './toolsets.js';

type Toolset = {
  enabled: boolean;
  tools: Array<{ tool: RegisteredTool; name: string }>;
};

type CacheContents = {
  allowedOrgs: Set<string>;
  toolsets: Map<string, Toolset>;
};

type ValueOf<T> = T[keyof T];

/**
 * A simple cache for storing values that need to be accessed globally.
 */
export default class Cache extends Map<keyof CacheContents, ValueOf<CacheContents>> {
  private static instance: Cache;

  public constructor() {
    super();
    this.set('allowedOrgs', new Set<string>());
    this.set('toolsets', new Map<string, Toolset>());

    // Initialize toolsets from TOOLSET_REGISTRY
    for (const toolsetName of Object.keys(TOOLSET_REGISTRY)) {
      this.get('toolsets').set(toolsetName, { enabled: false, tools: [] });
    }
  }

  public static getInstance(): Cache {
    if (!Cache.instance) {
      Cache.instance = new Cache();
    }
    return Cache.instance;
  }

  public get(_key: 'toolsets'): Map<string, Toolset>;
  public get(_key: 'allowedOrgs'): Set<string>;
  public get(key: keyof CacheContents): ValueOf<CacheContents> {
    return super.get(key) as ValueOf<CacheContents>;
  }
}
