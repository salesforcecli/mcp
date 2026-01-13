/**
 * Runtime Data Service
 * 
 * Handles fetching runtime metrics from the Connect endpoint.
 * Returns null on failure for graceful fallback to static severity.
 */

import { type Connection } from "@salesforce/core";
import {
  RuntimeReport,
  RuntimeDataRequest,
  ClassRuntimeData,
} from "../models/runtime-data.js";

/**
 * Configuration options for RuntimeDataService
 */
export interface RuntimeDataServiceConfig {
  /**
   * API path for the runtime data endpoint (relative to instance URL)
   * e.g., /services/data/v65.0/scalemcp/apexguru/class-runtime-data
   */
  apiPath: string;

  /**
   * Request timeout in milliseconds (default: 30000)
   */
  timeoutMs?: number;

  /**
   * Number of retry attempts on failure (default: 2)
   */
  retryAttempts?: number;
}

/**
 * Service for fetching runtime data from Connect endpoint
 * Provides graceful fallback by returning null on failures
 */
export class RuntimeDataService {
  private readonly apiPath: string;
  private readonly timeoutMs: number;
  private readonly retryAttempts: number;

  constructor(config: RuntimeDataServiceConfig) {
    this.apiPath = config.apiPath;
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.retryAttempts = config.retryAttempts ?? 2;
  }

  /**
   * Fetches runtime data for the specified classes from the Connect endpoint
   * 
   * @param connection - Salesforce connection object
   * @param request - The request parameters including orgId and class names
   * @returns RuntimeReport on success, null on failure (for graceful fallback)
   */
  public async fetchRuntimeData(
    connection: Connection,
    request: RuntimeDataRequest
  ): Promise<RuntimeReport | null> {
    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        // Create an AbortController for timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
          // Use connection.request() to call the Connect API
          // The connection handles authentication and instance URL automatically
          const response = await (connection as unknown as { request: (options: {
            method: string;
            url: string;
            body: string;
            headers: Record<string, string>;
          }) => Promise<unknown> }).request({
            method: "POST",
            url: this.apiPath,
            body: JSON.stringify(request),
            headers: {
              "Content-Type": "application/json",
            },
          });

          clearTimeout(timeoutId);

          // Parse and validate response
          const data = response as RuntimeReport;

          if (data.status !== "SUCCESS") {
            console.warn(
              `RuntimeDataService: API returned non-success status: ${data.message}`
            );
            return null;
          }

          return data;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
          `RuntimeDataService: Error on attempt ${attempt + 1}: ${errorMessage}`
        );

        if (attempt === this.retryAttempts) {
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Gets runtime data for a specific class from a RuntimeReport
   * 
   * @param report - The full runtime report
   * @param className - The class name to look up
   * @returns ClassRuntimeData if found, undefined otherwise
   */
  public static getClassData(
    report: RuntimeReport,
    className: string
  ): ClassRuntimeData | undefined {
    
    return report.classData[className];
  }

  /**
   * Generates a unique request ID for tracking and correlation purposes
   * Format: {orgId}:{userId}:{timestamp}
   * 
   * @param orgId - The Salesforce org ID for traceability
   * @param userId - The Salesforce user ID for traceability
   * @returns A unique, traceable request identifier
   */
  public static generateRequestId(orgId: string, userId: string): string {
    const timestamp = Date.now();
    return `${orgId}:${userId}:${timestamp}`;
  }
}
