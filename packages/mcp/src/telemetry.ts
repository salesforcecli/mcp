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

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Attributes, TelemetryReporter } from '@salesforce/telemetry';
import { warn } from '@oclif/core/ux';
import { Config } from '@oclif/core';
import { TelemetryService } from '@salesforce/mcp-provider-api/src/index.js';

const PROJECT = 'salesforce-mcp-server';
// WARN: This is intentionally empty! It's populated at the time of publish
//       This is to prevent telemetry pollution from local clones and forks
const APP_INSIGHTS_KEY = '';

const generateRandomId = (): string => randomBytes(20).toString('hex');

const getCliId = (cacheDir: string): string => {
  // We need to find sf's cache directory and read the CLIID.txt file from there.
  // The problem is that sf's cache directory is OS specific and we don't want to
  // hardcode all the potential paths. oclif does this for us already during startup
  // so we can simply replace sf-mcp-server with sf in the cache directory path and
  // end up with the correct OS specific path.
  //
  // The only downside to this approach is that the user could have a different
  // cache directory set via env var. In that case, we'll just generate a new CLIID.
  // This is a very rare case and we can live with it for now.
  const sfCacheDir = cacheDir.replace('sf-mcp-server', 'sf');
  const cliIdPath = join(sfCacheDir, 'CLIID.txt');
  try {
    return readFileSync(cliIdPath, 'utf-8');
  } catch {
    return generateRandomId();
  }
};

class McpTelemetryReporter extends TelemetryReporter {
  /**
   * TelemetryReporter references sf's config to determine if telemetry is enabled.
   * We want to always send telemetry events, so we override the method to always return true.
   * This is okay to do since the Telemetry class won't be instantiated in the MCP server if telemetry is disabled.
   *
   * @returns true
   */
  // eslint-disable-next-line class-methods-use-this
  public isSfdxTelemetryEnabled(): boolean {
    return true;
  }
}

export class Telemetry implements TelemetryService {
  /**
   * A unique identifier for the session.
   */
  private sessionId: string;
  /**
   * The unique identifier generated for the user by the `sf` CLI.
   * If it doesn't exist, or we can't read it, we'll generate a new one.
   */
  private cliId: string;
  private started = false;
  private reporter?: McpTelemetryReporter;

  public constructor(private readonly config: Config, private attributes: Attributes = {}) {
    const startupMessage = APP_INSIGHTS_KEY
      ? 'You acknowledge and agree that the MCP server may collect usage information, user environment, and crash reports for the purposes of providing services or functions that are relevant to use of the MCP server and product improvements.'
      : 'Telemetry is automatically disabled for local development.'

    warn(startupMessage);
    this.sessionId = generateRandomId();
    this.cliId = getCliId(config.cacheDir);
  }

  public addAttributes(attributes: Attributes): void {
    this.attributes = { ...this.attributes, ...attributes };
  }

  public sendEvent(eventName: string, attributes?: Attributes): void {
    try {
      this.reporter?.sendTelemetryEvent(eventName, {
        ...this.attributes,
        ...attributes,
        // Identifiers
        sessionId: this.sessionId,
        cliId: this.cliId,
        // System information
        version: this.config.version,
        platform: this.config.platform,
        arch: this.config.arch,
        nodeVersion: process.version,
        nodeEnv: process.env.NODE_ENV,
        origin: this.config.userAgent,
        // Timestamps
        date: new Date().toUTCString(),
        timestamp: String(Date.now()),
        processUptime: process.uptime() * 1000,
      });
    } catch {
      /* empty */
    }
  }

  public async start(): Promise<void> {
    if (this.started) return;
    if (!APP_INSIGHTS_KEY) return;
    this.started = true;

    try {
      this.reporter = await McpTelemetryReporter.create({
        project: PROJECT,
        key: APP_INSIGHTS_KEY,
        userId: this.cliId,
        waitForConnection: true,
      });

      this.reporter.start();
    } catch {
      // connection probably failed, but we can continue without telemetry
    }
  }

  public stop(): void {
    if (!this.started) return;
    this.started = false;
    this.reporter?.stop();
  }
}
