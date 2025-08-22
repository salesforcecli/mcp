import {
  Services,
  TelemetryEvent,
  TelemetryService,
} from "@salesforce/mcp-provider-api";

export class StubServices implements Services {
  public readonly telemetryService: TelemetryService;

  public constructor(
    telemetryService: TelemetryService = new SpyTelemetryService()
  ) {
    this.telemetryService = telemetryService;
  }

  public getTelemetryService(): TelemetryService {
    return this.telemetryService;
  }
}

export class SpyTelemetryService implements TelemetryService {
  public sendEventCallHistory: { eventName: string; event: TelemetryEvent }[] =
    [];
  public sendEvent(eventName: string, event: TelemetryEvent): void {
    this.sendEventCallHistory.push({ eventName, event });
  }
}
