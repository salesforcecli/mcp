import { type Connection } from '@salesforce/core';
import { type OrgConfigInfo, type SanitizedOrgAuthorization } from './types.js';

export interface Services {
  getTelemetryService(): TelemetryService;
  getOrgService(): OrgService;
  getConfigService(): ConfigService;
}

export interface TelemetryService {
  sendEvent(eventName: string, event: TelemetryEvent): void;
}

export type TelemetryEvent = {
  [key: string]: string | number | boolean | null | undefined;
};


export interface OrgService {
  getAllowedOrgUsernames(): Promise<Set<string>>;
  getAllowedOrgs(): Promise<SanitizedOrgAuthorization[]>;
  getConnection(username: string): Promise<Connection>;
  getDefaultTargetOrg(): Promise<OrgConfigInfo | undefined>;
  getDefaultTargetDevHub(): Promise<OrgConfigInfo | undefined>;
  findOrgByUsernameOrAlias(
    allOrgs: SanitizedOrgAuthorization[],
    usernameOrAlias: string
  ): SanitizedOrgAuthorization | undefined;
}

export interface ConfigService {
  getDataDir(): string;
}
