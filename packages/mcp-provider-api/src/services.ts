export interface Services {
    getTelemetryService(): TelemetryService
}

export interface TelemetryService {
    sendTelemetryEvent(eventName: string, event: TelemetryEvent): void;
}

export type TelemetryEvent = {
    [key: string]: string | number | boolean | null | undefined;
}