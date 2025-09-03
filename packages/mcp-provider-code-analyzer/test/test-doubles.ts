import { Connection } from "@salesforce/core";
import {
  ConfigService,
  OrgConfigInfo,
  OrgService,
  SanitizedOrgAuthorization,
  Services,
  TelemetryEvent,
  TelemetryService,
} from "@salesforce/mcp-provider-api";

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
    throw new Error("Method not implemented.");
  }
}

export class StubOrgService implements OrgService {
  public getAllowedOrgUsernames(): Promise<Set<string>> {
    throw new Error("Method not implemented.");
  }

  public getAllowedOrgs(): Promise<SanitizedOrgAuthorization[]> {
    throw new Error("Method not implemented.");
  }

  public getConnection(_username: string): Promise<Connection> {
    throw new Error("Method not implemented.");
  }

  public getDefaultTargetOrg(): Promise<OrgConfigInfo | undefined> {
    throw new Error("Method not implemented.");
  }

  public getDefaultTargetDevHub(): Promise<OrgConfigInfo | undefined> {
    throw new Error("Method not implemented.");
  }

  public findOrgByUsernameOrAlias(_allOrgs: SanitizedOrgAuthorization[], _usernameOrAlias: string): SanitizedOrgAuthorization | undefined {
    throw new Error("Method not implemented.");
  }
}

export type SendTelemetryEvent = {
  eventName: string,
  event: TelemetryEvent
}

export class SpyTelemetryService implements TelemetryService {
  public sendEventCallHistory: SendTelemetryEvent[] = [];
  public sendEvent(eventName: string, event: TelemetryEvent): void {
    this.sendEventCallHistory.push({ eventName, event });
  }
}