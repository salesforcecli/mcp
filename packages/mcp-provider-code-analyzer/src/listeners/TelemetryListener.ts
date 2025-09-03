import { TelemetryService } from "@salesforce/mcp-provider-api"
import { CodeAnalyzer, EngineTelemetryEvent, EventType, TelemetryEvent } from "@salesforce/code-analyzer-core";
import * as Constants from "../constants.js";

export interface TelemetryListener {
    listen(codeAnalyzer: CodeAnalyzer): void
}


export class NoOpTelemetryListener implements TelemetryListener {

    public listen(_codeAnalyzer: CodeAnalyzer): void {
        // DELIBERATE NO-OP
    }
}

export class TelemetryListenerImpl implements TelemetryListener {
    private readonly telemetryService: TelemetryService;

    public constructor(telemetryService: TelemetryService) {
        this.telemetryService = telemetryService
    }

    public listen(codeAnalyzer: CodeAnalyzer): void {
        codeAnalyzer.onEvent(EventType.TelemetryEvent, (e: TelemetryEvent) => this.handleEvent("Core", e))
        codeAnalyzer.onEvent(EventType.EngineTelemetryEvent, (e: EngineTelemetryEvent) => this.handleEvent(e.engineName, e))
    }

    private handleEvent(source: string, event: TelemetryEvent|EngineTelemetryEvent): void {
        this.telemetryService.sendEvent(Constants.TelemetryEventName, {
            ...event.data,
            sfcaEvent: event.eventName,
            timestamp: event.timestamp.getTime(),
            uuid: event.uuid,
            source
        })
    }
}