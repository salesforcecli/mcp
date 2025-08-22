export interface Services {
  getTelemetryService(): TelemetryService;
  getApprovedServerMethods(): ApprovedServerMethods;
}

export interface TelemetryService {
  sendEvent(eventName: string, event: TelemetryEvent): void;
}

export type TelemetryEvent = {
  [key: string]: string | number | boolean | null | undefined;
};

export interface ApprovedServerMethods {
  sendToolListChanged(): void;
}
