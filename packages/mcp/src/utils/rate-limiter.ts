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

/**
 * Configuration options for rate limiting
 */
export type RateLimitConfig = {
  /** Maximum number of calls allowed per window (default: 60) */
  limit: number;
  /** Time window in milliseconds (default: 60000 = 1 minute) */
  windowMs: number;
  /** Allow burst of calls above the average rate (default: 10) */
  burstAllowance: number;
};

/**
 * Result of a rate limit check
 */
export type RateLimitResult = {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in current window */
  remaining: number;
  /** Time in milliseconds until the window resets */
  resetTime: number;
  /** Time in milliseconds to wait before retrying (only set when allowed=false) */
  retryAfter?: number;
};

/**
 * Token bucket rate limiter with burst allowance support
 *
 * Uses a token bucket algorithm where:
 * - Tokens are added at a steady rate (limit/windowMs)
 * - Burst allowance determines the maximum tokens that can accumulate
 * - Each request consumes one token
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly tokensPerMs: number;

  /**
   * Creates a new rate limiter
   *
   * @param config Rate limiting configuration
   */
  public constructor(private readonly config: RateLimitConfig) {
    this.tokens = config.burstAllowance; // Start with full burst capacity
    this.lastRefill = Date.now();
    this.tokensPerMs = config.limit / config.windowMs;
  }

  /**
   * Check if a request should be allowed and consume a token if so
   *
   * @returns Rate limit result
   */
  public checkLimit(): RateLimitResult {
    const now = Date.now();
    this.refillTokens(now);

    if (this.tokens >= 1) {
      // Allow the request and consume a token
      this.tokens -= 1;

      return {
        allowed: true,
        remaining: Math.floor(this.tokens),
        resetTime: this.calculateResetTime(),
      };
    } else {
      // Rate limit exceeded
      const retryAfter = this.calculateRetryAfter();

      return {
        allowed: false,
        remaining: 0,
        resetTime: this.calculateResetTime(),
        retryAfter,
      };
    }
  }

  /**
   * Get current status without consuming a token
   *
   * @returns Rate limit result for status check
   */
  public getStatus(): RateLimitResult {
    const now = Date.now();
    this.refillTokens(now);

    return {
      allowed: this.tokens >= 1,
      remaining: Math.floor(this.tokens),
      resetTime: this.calculateResetTime(),
    };
  }

  /**
   * Refill tokens based on elapsed time
   *
   * @param now Current timestamp
   */
  private refillTokens(now: number): void {
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.tokensPerMs;

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.config.burstAllowance, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * Calculate time until the rate limit window resets
   *
   * @returns Milliseconds until reset
   */
  private calculateResetTime(): number {
    // Time to refill one token
    const timePerToken = 1 / this.tokensPerMs;
    return Math.ceil(timePerToken);
  }

  /**
   * Calculate how long to wait before retrying
   *
   * @returns Milliseconds to wait
   */
  private calculateRetryAfter(): number {
    // Time needed to accumulate one token
    return Math.ceil(1 / this.tokensPerMs);
  }
}

/**
 * Create a rate limiter with default configuration
 *
 * @param overrides Partial configuration to override defaults
 * @returns Configured rate limiter
 */
export function createRateLimiter(overrides: Partial<RateLimitConfig> = {}): RateLimiter {
  const config: RateLimitConfig = {
    limit: 60, // 60 calls per minute
    windowMs: 60 * 1000, // 1 minute
    burstAllowance: 10, // Allow bursts of up to 10 calls
    ...overrides,
  };

  return new RateLimiter(config);
}
