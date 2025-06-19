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

import { Toolset } from './types.js';
import { TOOLSET_REGISTRY } from './toolset-registry.js';

type CacheContents = {
  allowedOrgs: Set<string>;
  toolsets: Map<string, Toolset>;
};

type ValueOf<T> = T[keyof T];

/**
 * Simple mutex implementation using promises for Node.js
 */
class Mutex {
  private mutex = Promise.resolve();

  public async lock<T>(fn: () => Promise<T> | T): Promise<T> {
    const unlock = await this.acquire();
    try {
      return await fn();
    } finally {
      unlock();
    }
  }

  private async acquire(): Promise<() => void> {
    let release: () => void;
    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });

    const currentMutex = this.mutex;
    this.mutex = this.mutex.then(() => promise);

    await currentMutex;
    return release!;
  }
}

/**
 * A thread-safe cache providing generic Map operations with mutex protection.
 * Offers atomic read, write, and update operations for concurrent access.
 */
export default class Cache extends Map<keyof CacheContents, ValueOf<CacheContents>> {
  private static instance: Cache;
  private static initializationMutex = new Mutex();

  // Operational mutex for thread-safe cache operations
  private static operationalMutex = new Mutex();

  private constructor() {
    super();
    this.initialize();
  }

  /**
   * Thread-safe singleton getter
   */
  public static async getInstance(): Promise<Cache> {
    if (!Cache.instance) {
      return Cache.initializationMutex.lock(() => {
        if (!Cache.instance) {
          Cache.instance = new Cache();
        }
        return Cache.instance;
      });
    }
    return Cache.instance;
  }

  /**
   * Thread-safe atomic update operation
   * Allows safe read-modify-write operations with mutex protection
   */
  public static async safeUpdate<K extends keyof CacheContents>(
    key: K,
    updateFn: (currentValue: CacheContents[K]) => CacheContents[K]
  ): Promise<CacheContents[K]> {
    const cache = await Cache.getInstance();

    return Cache.operationalMutex.lock(() => {
      const currentValue = cache.get(key);
      const newValue = updateFn(currentValue);
      cache.set(key, newValue);
      return newValue;
    });
  }

  /**
   * Thread-safe atomic read operation
   */
  public static async safeGet<K extends keyof CacheContents>(key: K): Promise<CacheContents[K]> {
    const cache = await Cache.getInstance();

    return Cache.operationalMutex.lock(() => cache.get(key));
  }

  /**
   * Thread-safe atomic write operation
   */
  public static async safeSet<K extends keyof CacheContents>(key: K, value: CacheContents[K]): Promise<void> {
    const cache = await Cache.getInstance();

    return Cache.operationalMutex.lock(() => {
      cache.set(key, value);
    });
  }

  /**
   * Thread-safe conditional operation
   * Execute function only if condition is met, all within mutex protection
   */
  public static async safeConditional<T>(conditionAndAction: () => T): Promise<T> {
    await Cache.getInstance(); // Ensure cache is initialized

    return Cache.operationalMutex.lock(() => conditionAndAction());
  }

  public get<K extends keyof CacheContents>(key: K): CacheContents[K] {
    return super.get(key) as CacheContents[K];
  }

  private initialize(): void {
    this.set('allowedOrgs', new Set<string>());
    this.set('toolsets', new Map<string, Toolset>());

    // Initialize toolsets from TOOLSET_REGISTRY
    const toolsetsMap = this.get('toolsets');
    for (const toolsetName of Object.keys(TOOLSET_REGISTRY)) {
      toolsetsMap.set(toolsetName, { enabled: false, tools: [] });
    }
  }
}
