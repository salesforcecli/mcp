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

type CacheContents = {
  allowedOrgs: Set<string>;
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
  }

  public static getInstance(): Cache {
    if (!Cache.instance) {
      Cache.instance = new Cache();
    }
    return Cache.instance;
  }

  public get(_key: 'allowedOrgs'): Set<string>;
  public get(key: keyof CacheContents): ValueOf<CacheContents> {
    return super.get(key) as ValueOf<CacheContents>;
  }
}
