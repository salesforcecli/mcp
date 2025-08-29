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
import {
  Services as IServices,
  TelemetryService,
  TelemetryEvent,
  OrgService,
  SanitizedOrgAuthorization,
  ConfigService,
} from '@salesforce/mcp-provider-api';
import Cache from './utils/cache.js';
import {
  getConnection,
  getDefaultTargetOrg,
  getDefaultTargetDevHub,
  getAllAllowedOrgs,
  findOrgByUsernameOrAlias,
} from './utils/auth.js';

export class Services implements IServices {
  private readonly telemetry: TelemetryService;
  private readonly dataDir: string;

  public constructor(opts: { telemetry: TelemetryService | undefined; dataDir: string }) {
    this.telemetry = opts.telemetry ? opts.telemetry : new NoopTelemetryService();
    this.dataDir = opts.dataDir;
  }

  public getTelemetryService(): TelemetryService {
    return this.telemetry;
  }

  public getConfigService(): ConfigService {
    return {
      getDataDir: () => this.dataDir,
    };
  }

  public getOrgService(): OrgService {
    return {
      getAllowedOrgUsernames: async () => Cache.safeGet('allowedOrgs'),
      getAllowedOrgs: () => getAllAllowedOrgs(),
      getConnection: (username: string) => getConnection(username),
      getDefaultTargetOrg: () => getDefaultTargetOrg(),
      getDefaultTargetDevHub: () => getDefaultTargetDevHub(),
      findOrgByUsernameOrAlias: (allOrgs: SanitizedOrgAuthorization[], usernameOrAlias: string) =>
        findOrgByUsernameOrAlias(allOrgs, usernameOrAlias),
    };
  }
}

class NoopTelemetryService implements TelemetryService {
  public sendEvent(_eventName: string, _event: TelemetryEvent): void {
    // no-op
  }
}
