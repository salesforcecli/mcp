import { type Connection } from '@salesforce/core';
import { type OrgConfigInfo, type SanitizedOrgAuthorization } from './types.js';

export interface Services {
  getTelemetryService(): TelemetryService;
  getRagAssetService<D, E, I>(): RagAssetService<D, E, I>;
  getOrgService(): OrgService;
}

export interface TelemetryService {
  sendEvent(eventName: string, event: TelemetryEvent): void;
}

export type TelemetryEvent = {
  [key: string]: string | number | boolean | null | undefined;
};

export type RagAssets<D, E, I> = {
  data: D;
  embedder: E;
  index: I;
};

/**
 * The RagAssetService was built with sf-suggest-cli-command as the only use case.
 * So any additional use cases will almost certainly require changes to this service and
 * would likely require us to develop a fully featured, tool-agnostic RAG system.
 */
export interface RagAssetService<D, E, I> {
  getAssets(dataDir: string, dataPath: string, indexPath: string): Promise<RagAssets<D, E, I>>;
  getDataDir(): string;
}

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
