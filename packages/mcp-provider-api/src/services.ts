export interface Services {
  getTelemetryService(): TelemetryService;
  getApprovedServerMethods(): ApprovedServerMethods;
  getRagAssetService<D, E, I>(): RagAssetService<D, E, I>;
}

export interface TelemetryService {
  sendEvent(eventName: string, event: TelemetryEvent): void;
}

export type TelemetryEvent = {
  [key: string]: string | number | boolean | null | undefined;
};

export interface ApprovedServerMethods {
  sendToolListChanged: () => void;
}

export type RagAssets<D, E, I> = {
  data: D;
  embedder: E;
  index: I;
};

export interface RagAssetService<D, E, I> {
  getAssets(dataDir: string, dataPath: string, indexPath: string): Promise<RagAssets<D, E, I>>;
  getDataDir(): string;
}
