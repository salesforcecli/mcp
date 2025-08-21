import { ApprovedServerMethods, Services, TelemetryEvent, TelemetryService } from "@salesforce/mcp-provider-api";

export class StubServices implements Services {
    public readonly telemetryService: TelemetryService;
    public readonly approvedServerMethods: ApprovedServerMethods;

    public constructor(telemetryService: TelemetryService = new SpyTelemetryService(),
                       approvedServerMethods: ApprovedServerMethods = new SpyApprovedServerMethods()) {
        this.telemetryService = telemetryService;
        this.approvedServerMethods = approvedServerMethods;
    }

    public getTelemetryService(): TelemetryService {
        return this.telemetryService;
    }

    public getApprovedServerMethods(): ApprovedServerMethods {
        return this.approvedServerMethods;
    }
}

export class SpyTelemetryService implements TelemetryService {
    public sendEventCallHistory: {eventName: string, event: TelemetryEvent}[] = []
    public sendEvent(eventName: string, event: TelemetryEvent): void {
        this.sendEventCallHistory.push({eventName, event});
    }
}

export class SpyApprovedServerMethods implements ApprovedServerMethods {
    public sendToolListChangedCount: number = 0;
    public sendToolListChanged(): void {
        this.sendToolListChangedCount++;
    }
}