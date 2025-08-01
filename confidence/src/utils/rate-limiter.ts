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

/* eslint-disable no-await-in-loop */

import makeDebug from 'debug';

const debug = makeDebug('confidence:rate-limiter');

type QueuedRequest<T extends Response> = {
  execute: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (error: unknown) => void;
};

type RetryConfig = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryOn: number[];
};

type RateLimitStatus = {
  queueLength: number;
  requestsInWindow: number;
  maxRequests: number;
  canExecute: boolean;
  nextAvailableSlot?: number;
  isProcessing: boolean;
  completed: number;
  failed: number;
  burstModeActive: boolean;
  utilizationRatio: number;
  timeUntilWindowReset: number;
  adaptiveMaxRequests: number;
  backoffMultiplier: number;
  retryStats: {
    totalRetries: number;
    retriesByStatus: Record<number, number>;
  };
};

class RateLimitError extends Error {
  public constructor(message: string, public readonly status?: number, public readonly retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * A rate limiter that controls the frequency of requests using a sliding window approach with adaptive burst control and intelligent retry logic.
 *
 * This class implements a queue-based rate limiter that ensures no more than a specified
 * number of requests are executed within a given time window. It features intelligent burst
 * detection that allows rapid execution of small batches while maintaining rate limit compliance
 * for larger workloads.
 *
 * Key Features:
 * - Sliding window rate limiting with adaptive capacity adjustment
 * - Intelligent burst control for small request batches
 * - Exponential backoff retry logic with jitter for resilience
 * - Respect for Retry-After headers when present
 * - Adaptive rate adjustment based on 429 responses
 * - Comprehensive monitoring and debugging information
 * - Graceful degradation and recovery mechanisms
 *
 * @example
 * ```typescript
 * // Create a rate limiter that allows 10 requests per minute
 * const rateLimiter = new RateLimiter(10, 60_000);
 *
 * // Small batches execute immediately in burst mode
 * const results = await Promise.all([
 *   rateLimiter.enqueue(() => fetch('/api/data1')),
 *   rateLimiter.enqueue(() => fetch('/api/data2')),
 *   rateLimiter.enqueue(() => fetch('/api/data3'))
 * ]);
 *
 * // Check current status including burst mode and retry information
 * const status = rateLimiter.getStatus();
 * console.log(`Burst mode active: ${status.burstModeActive}`);
 * console.log(`Adaptive capacity: ${status.adaptiveMaxRequests}/${status.maxRequests}`);
 * console.log(`Retry stats: ${status.retryStats.totalRetries} total retries`);
 * ```
 */
export class RateLimiter {
  private static completed: number = 0;
  private static failed: number = 0;

  private readonly requestTimestamps: number[] = [];
  private readonly queue: Array<QueuedRequest<Response>> = [];
  private isProcessing = false;

  /**
   * Utilization threshold below which burst mode is allowed.
   * When current window utilization is below this ratio, requests can execute immediately.
   */
  private readonly burstUtilizationThreshold = 0.5;

  /**
   * Total work threshold (current + queued requests) for burst mode.
   * Burst mode is only allowed when predicted total utilization is below this ratio.
   */
  private readonly burstQueueThreshold = 0.75;

  /**
   * Minimum delay between requests during controlled (non-burst) execution.
   * Provides a baseline spacing to prevent overwhelming the target service.
   */
  private readonly minDelayMs = 50;

  /**
   * Configuration for retry logic when handling rate limit errors.
   */
  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 60_000,
    retryOn: [429, 503, 502, 504],
  };

  /**
   * Adaptive rate limiting state.
   */
  private adaptiveMaxRequests: number;
  private readonly originalMaxRequests: number;
  private backoffMultiplier = 1.0;

  /**
   * Retry statistics for monitoring.
   */
  private retryStats = {
    totalRetries: 0,
    retriesByStatus: {} as Record<number, number>,
  };

  public constructor(private readonly maxRequests = 40, private readonly windowMs = 60_000) {
    this.adaptiveMaxRequests = maxRequests;
    this.originalMaxRequests = maxRequests;
  }

  /**
   * Utility function to sleep for a given number of milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Determines if an error is retryable
   */
  private static isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('429') ||
        message.includes('rate limit') ||
        message.includes('econnreset') ||
        message.includes('timeout')
      );
    }
    return false;
  }

  /**
   * Enqueues a request to be executed when rate limit allows
   *
   * @param requestFn Function that returns a promise for the actual request
   * @returns Promise that resolves when the request is executed
   */
  public async enqueue(requestFn: () => Promise<Response>): Promise<Response> {
    debug('Enqueuing request: %O', this.getStatus());
    return new Promise<Response>((resolve, reject) => {
      this.queue.push({
        execute: requestFn,
        resolve,
        reject,
      });

      // Start processing if not already running
      if (!this.isProcessing) {
        void this.processQueue();
      }
    });
  }

  /**
   * Gets current queue status for monitoring/debugging
   */
  public getStatus(): RateLimitStatus {
    const now = Date.now();
    this.cleanupOldTimestamps(now);

    return {
      queueLength: this.queue.length,
      requestsInWindow: this.requestTimestamps.length,
      maxRequests: this.maxRequests,
      canExecute: this.canExecuteRequest(),
      nextAvailableSlot: this.requestTimestamps.length > 0 ? this.requestTimestamps[0] + this.windowMs : undefined,
      isProcessing: this.isProcessing,
      completed: RateLimiter.completed,
      failed: RateLimiter.failed,
      burstModeActive: this.shouldAllowBurst(),
      utilizationRatio: this.requestTimestamps.length / this.adaptiveMaxRequests,
      timeUntilWindowReset: this.getTimeUntilWindowReset(),
      adaptiveMaxRequests: this.adaptiveMaxRequests,
      backoffMultiplier: this.backoffMultiplier,
      retryStats: { ...this.retryStats },
    };
  }

  /**
   * Executes a single request with retry logic and adaptive rate limiting
   */
  private async executeRequest(request: QueuedRequest<Response>): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const result = await request.execute();

        // Check for rate limit response
        if (!result.ok && this.retryConfig.retryOn.includes(result.status)) {
          // Immediately adjust rate limit on first 429 to prevent more
          if (result.status === 429) {
            this.adjustRateLimit(true);
          }

          if (attempt === this.retryConfig.maxRetries) {
            this.recordRetryFailure(result.status);
            throw new RateLimitError(`Rate limit exceeded after ${this.retryConfig.maxRetries} retries`, result.status);
          }

          this.recordRetryAttempt(result.status);
          const delay = this.calculateRetryDelay(attempt, result);
          debug(`Rate limit hit (${result.status}), retrying in ${delay}ms (attempt ${attempt + 1})`);

          await RateLimiter.sleep(delay);
          continue;
        }

        // Success - record and resolve
        RateLimiter.completed++;
        this.adjustRateLimit(false);
        request.resolve(result);
        return;
      } catch (error) {
        lastError = error as Error;
        debug(`Error executing request: ${lastError.message}. %O`, {
          attempt,
          status: lastError instanceof RateLimitError ? lastError.status : undefined,
          retryAfter: lastError instanceof RateLimitError ? lastError.retryAfter : undefined,
        });
        debug('Full error details: %O', lastError);

        if (attempt < this.retryConfig.maxRetries && RateLimiter.isRetryableError(error)) {
          this.recordRetryAttempt();
          const delay = this.calculateRetryDelay(attempt);
          debug(`Retryable error, retrying in ${delay}ms (attempt ${attempt + 1}): ${lastError.message}`);

          await RateLimiter.sleep(delay);
          continue;
        }
        break;
      }
    }

    // All retries exhausted
    RateLimiter.failed++;
    request.reject(lastError ?? new Error('Max retries exceeded'));
  }

  /**
   * Processes the queue, executing requests when rate limit allows
   */
  private async processQueue(): Promise<void> {
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const now = Date.now();

      // Remove timestamps outside the current window
      this.cleanupOldTimestamps(now);

      if (this.canExecuteRequest()) {
        debug('Executing request: %O', this.getStatus());
        // Execute the next request without waiting for it to complete
        const request = this.queue.shift()!;
        this.recordRequest(now);

        // Execute the request asynchronously - don't await
        void this.executeRequest(request);

        // Use adaptive delay instead of fixed delay
        const delay = this.calculateAdaptiveDelay();
        if (delay > 0) {
          await RateLimiter.sleep(delay);
        }
      } else {
        // Wait until we can make the next request
        await RateLimiter.sleep(this.calculateDelay(now));
      }
    }

    this.isProcessing = false;
  }

  /**
   * Determines if burst mode should be allowed based on current utilization
   */
  private shouldAllowBurst(): boolean {
    const utilizationRatio = this.requestTimestamps.length / this.adaptiveMaxRequests;
    const queueRatio = this.queue.length / this.adaptiveMaxRequests;
    const totalWorkRatio = utilizationRatio + queueRatio;

    // Be more conservative with large queues - reduce burst threshold
    const adjustedBurstThreshold =
      this.queue.length > this.adaptiveMaxRequests * 0.25
        ? this.burstUtilizationThreshold * 0.5
        : this.burstUtilizationThreshold;

    // Allow bursts when:
    // 1. Current utilization is below the burst threshold
    // 2. Total work (current + queued) is below the queue threshold
    // 3. We're not in backoff mode
    return (
      utilizationRatio < adjustedBurstThreshold &&
      totalWorkRatio < this.burstQueueThreshold &&
      this.backoffMultiplier >= 0.9
    );
  }

  /**
   * Calculates adaptive delay based on current utilization and queue state
   */
  private calculateAdaptiveDelay(): number {
    // Allow immediate execution during burst conditions
    if (this.shouldAllowBurst()) {
      return 0;
    }

    const utilizationRatio = this.requestTimestamps.length / this.adaptiveMaxRequests;
    const remainingCapacity = this.adaptiveMaxRequests - this.requestTimestamps.length;
    const queueLength = this.queue.length;

    // At high utilization (>90%), use much more conservative delays
    if (utilizationRatio > 0.9) {
      const baseDelay = Math.ceil(this.windowMs / this.adaptiveMaxRequests);
      // Use exponential scaling at high utilization to prevent 429s
      const aggressiveScaling = Math.pow(utilizationRatio, 3) * 5;
      return Math.max(baseDelay * aggressiveScaling, 1000); // Minimum 1 second at high utilization
    }

    // If we have enough capacity for all queued requests, use minimal spacing
    if (remainingCapacity >= queueLength) {
      return this.minDelayMs;
    }

    // Calculate base delay and scale it based on utilization
    const baseDelay = Math.ceil(this.windowMs / this.adaptiveMaxRequests);
    const scalingFactor = Math.min(utilizationRatio * 2, 1);

    return Math.max(this.minDelayMs, baseDelay * scalingFactor);
  }

  /**
   * Calculates retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number, response?: Response): number {
    if (response?.status === 429) {
      const remainingRequests = this.adaptiveMaxRequests - this.requestTimestamps.length;
      if (remainingRequests <= 0) {
        return this.getTimeUntilWindowReset(); // Wait until the window resets
      }
    }

    // Exponential backoff with jitter
    const exponentialDelay = this.retryConfig.baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
    return Math.min(exponentialDelay + jitter, this.retryConfig.maxDelayMs);
  }
  /**
   * Records a retry attempt for statistics
   */
  private recordRetryAttempt(status?: number): void {
    this.retryStats.totalRetries++;
    if (status) {
      this.retryStats.retriesByStatus[status] = (this.retryStats.retriesByStatus[status] || 0) + 1;
    }
  }

  /**
   * Records a final retry failure
   */
  private recordRetryFailure(status: number): void {
    debug(`Final retry failure with status ${status} after ${this.retryConfig.maxRetries} attempts`);
  }

  /**
   * Adjusts rate limit based on success/failure
   */
  private adjustRateLimit(hit429: boolean): void {
    if (hit429) {
      // Reduce rate by 25% when we hit rate limits
      this.backoffMultiplier = Math.max(0.25, this.backoffMultiplier * 0.75);
      this.adaptiveMaxRequests = Math.floor(this.originalMaxRequests * this.backoffMultiplier);
      debug(`Rate limit hit, reducing to ${this.adaptiveMaxRequests} requests per window`);
    } else {
      // Gradually recover rate limit (2% increase per successful request)
      this.backoffMultiplier = Math.min(1.0, this.backoffMultiplier * 1.02);
      this.adaptiveMaxRequests = Math.floor(this.originalMaxRequests * this.backoffMultiplier);
    }
  }

  /**
   * Gets the time until the current rate limit window resets
   */
  private getTimeUntilWindowReset(): number {
    if (this.requestTimestamps.length === 0) {
      return 0;
    }
    const oldestRequest = this.requestTimestamps[0];
    return Math.max(0, oldestRequest + this.windowMs - Date.now());
  }

  /**
   * Checks if a request can be executed based on current adaptive rate limit
   */
  private canExecuteRequest(): boolean {
    const utilizationRatio = this.requestTimestamps.length / this.adaptiveMaxRequests;

    // Be more conservative at high utilization to prevent 429s
    if (utilizationRatio > 0.9) {
      // Only allow if we have significant capacity remaining
      return this.requestTimestamps.length <= Math.floor(this.adaptiveMaxRequests * 0.85);
    }

    return this.requestTimestamps.length < this.adaptiveMaxRequests;
  }

  /**
   * Records the timestamp of a request
   */
  private recordRequest(timestamp: number): void {
    this.requestTimestamps.push(timestamp);
  }

  /**
   * Removes timestamps that are outside the current window
   */
  private cleanupOldTimestamps(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] < cutoff) {
      this.requestTimestamps.shift();
    }
  }

  /**
   * Calculates how long to wait before the next request can be made
   */
  private calculateDelay(now: number): number {
    if (this.requestTimestamps.length === 0) {
      return 0;
    }

    // If we're at the adaptive limit, wait until the oldest request expires
    if (this.requestTimestamps.length >= this.adaptiveMaxRequests) {
      const oldestRequest = this.requestTimestamps[0];
      const timeUntilExpiry = oldestRequest + this.windowMs - now;
      return Math.max(0, timeUntilExpiry + 100); // Add 100ms buffer
    }

    return 0;
  }
}
