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

import { Connection } from '@salesforce/core';
import {
  ConfigService,
  OrgConfigInfo,
  OrgService,
  SanitizedOrgAuthorization,
  Services,
  TelemetryEvent,
  TelemetryService,
} from '@salesforce/mcp-provider-api';

export class StubServices implements Services {
  public configService: ConfigService = new StubConfigService();
  public orgService: OrgService = new StubOrgService();
  public telemetryService: TelemetryService = new SpyTelemetryService();

  public getConfigService(): ConfigService {
    return this.configService;
  }

  public getOrgService(): OrgService {
    return this.orgService;
  }

  public getTelemetryService(): TelemetryService {
    return this.telemetryService;
  }
}

export class StubConfigService implements ConfigService {
  public getDataDir(): string {
    throw new Error('Method not implemented.');
  }

  public getStartupFlags(): { 'allow-non-ga-tools': boolean | undefined; debug: boolean | undefined } {
    throw new Error('Method not implemented.');
  }
}

export class StubOrgService implements OrgService {
  public getAllowedOrgUsernames(): Promise<Set<string>> {
    throw new Error('Method not implemented.');
  }

  public getAllowedOrgs(): Promise<SanitizedOrgAuthorization[]> {
    throw new Error('Method not implemented.');
  }

  public getConnection(_username: string): Promise<Connection> {
    throw new Error('Method not implemented.');
  }

  public getDefaultTargetOrg(): Promise<OrgConfigInfo | undefined> {
    throw new Error('Method not implemented.');
  }

  public getDefaultTargetDevHub(): Promise<OrgConfigInfo | undefined> {
    throw new Error('Method not implemented.');
  }

  public findOrgByUsernameOrAlias(
    _allOrgs: SanitizedOrgAuthorization[],
    _usernameOrAlias: string,
  ): SanitizedOrgAuthorization | undefined {
    throw new Error('Method not implemented.');
  }
}

export class SpyTelemetryService implements TelemetryService {
  public sendEventCallHistory: { eventName: string; event: TelemetryEvent }[] = [];
  public sendEvent(eventName: string, event: TelemetryEvent): void {
    this.sendEventCallHistory.push({ eventName, event });
  }
}
