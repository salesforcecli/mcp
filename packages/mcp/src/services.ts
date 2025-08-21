/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  Services as IServices,
  TelemetryService,
  ApprovedServerMethods,
  TelemetryEvent,
  RagAssetService,
} from '@salesforce/mcp-provider-api';
import { SfMcpServer } from './sf-mcp-server.js';
import { getAssets } from './utils/assets.js';

export class Services implements IServices {
  private telemetry: TelemetryService;
  private server: SfMcpServer;
  private dataDir: string;

  public constructor(opts: { telemetry: TelemetryService | undefined; server: SfMcpServer; dataDir: string }) {
    this.telemetry = opts.telemetry ? opts.telemetry : new NoopTelemetryService();
    this.server = opts.server;
    this.dataDir = opts.dataDir;
  }

  public getTelemetryService(): TelemetryService {
    return this.telemetry;
  }

  public getApprovedServerMethods(): ApprovedServerMethods {
    return {
      sendToolListChanged: this.server.sendToolListChanged.bind(this.server),
    };
  }

  public getRagAssetService<D, E, I>(): RagAssetService<D, E, I> {
    return {
      getDataDir: () => this.dataDir,
      getAssets,
    };
  }
}

class NoopTelemetryService implements TelemetryService {
  public sendEvent(_eventName: string, _event: TelemetryEvent): void {
    // no-op
  }
}
