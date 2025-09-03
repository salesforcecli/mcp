import {TelemetryService} from "@salesforce/mcp-provider-api";
import {NoOpTelemetryListener, TelemetryListener, TelemetryListenerImpl} from "../listeners/TelemetryListener.js";


export class TelemetryListenerFactory {
    public create(telemetryService?: TelemetryService): TelemetryListener {
        if (telemetryService) {
            return new TelemetryListenerImpl(telemetryService)
        } else {
            return new NoOpTelemetryListener()
        }
    }
}