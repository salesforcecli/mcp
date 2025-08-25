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

import { Mutex } from '@salesforce/core';
import { ToolInfo } from './types.js';

type CacheContents = {
  allowedOrgs: Set<string>;
  tools: ToolInfo[];
};

type ValueOf<T> = T[keyof T];

/**
 * A thread-safe cache providing generic Map operations with mutex protection.
 * Offers atomic read, write, and update operations for concurrent access.
 */
export default class Cache extends Map<keyof CacheContents, ValueOf<CacheContents>> {
  private static instance: Cache;

  // Mutex for thread-safe cache operations
  private static mutex = new Mutex();

  private constructor() {
    super();
    this.initialize();
  }

  /**
   * Get the singleton instance of the Cache
   * Creates a new instance if one doesn't exist
   *
   * @returns The singleton Cache instance
   */
  public static getInstance(): Cache {
    return (Cache.instance ??= new Cache());
  }

  /**
   * Thread-safe atomic update operation
   * Allows safe read-modify-write operations with mutex protection
   */
  public static async safeUpdate<K extends keyof CacheContents>(
    key: K,
    updateFn: (currentValue: CacheContents[K]) => CacheContents[K]
  ): Promise<CacheContents[K]> {
    const cache = Cache.getInstance();

    return Cache.mutex.lock(() => {
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
    const cache = Cache.getInstance();

    return Cache.mutex.lock(() => cache.get(key));
  }

  /**
   * Thread-safe atomic write operation
   */
  public static async safeSet<K extends keyof CacheContents>(key: K, value: CacheContents[K]): Promise<void> {
    const cache = Cache.getInstance();

    return Cache.mutex.lock(() => {
      cache.set(key, value);
    });
  }

  public get<K extends keyof CacheContents>(key: K): CacheContents[K] {
    return super.get(key) as CacheContents[K];
  }

  private initialize(): void {
    this.set('allowedOrgs', new Set<string>());
    this.set('tools', []);
  }
}
