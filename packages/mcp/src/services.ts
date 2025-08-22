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
} from '@salesforce/mcp-provider-api';
import { SfMcpServer } from './sf-mcp-server.js';

export class Services implements IServices {
  private readonly telemetry: TelemetryService;
  private readonly serverWrapper: ApprovedServerMethods;

  public constructor(opts: { telemetry: TelemetryService | undefined; server: SfMcpServer }) {
    this.telemetry = opts.telemetry ? opts.telemetry : new NoopTelemetryService();
    this.serverWrapper = new ServerWrapper(opts.server);
  }

  public getTelemetryService(): TelemetryService {
    return this.telemetry;
  }

  public getApprovedServerMethods(): ApprovedServerMethods {
    return this.serverWrapper;
  }
}

class NoopTelemetryService implements TelemetryService {
  public sendEvent(_eventName: string, _event: TelemetryEvent): void {
    // no-op
  }
}

class ServerWrapper implements ApprovedServerMethods {
  private readonly server: SfMcpServer;

  public constructor(server: SfMcpServer) {
    this.server = server;
  }

  public sendToolListChanged(): void {
    this.server.sendToolListChanged();
  }
}