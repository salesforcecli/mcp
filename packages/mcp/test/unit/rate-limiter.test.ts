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

import { expect } from 'chai';
import { createRateLimiter } from '../../src/utils/rate-limiter.js';

describe('RateLimiter', () => {
  describe('createRateLimiter', () => {
    it('should create a rate limiter with default config', () => {
      const limiter = createRateLimiter();
      const status = limiter.getStatus();

      expect(status.allowed).to.be.true;
      expect(status.remaining).to.equal(10); // Default burst allowance
    });

    it('should create a rate limiter with custom config', () => {
      const limiter = createRateLimiter({
        limit: 120,
        burstAllowance: 20,
      });
      const status = limiter.getStatus();

      expect(status.allowed).to.be.true;
      expect(status.remaining).to.equal(20); // Custom burst allowance
    });
  });

  describe('checkLimit', () => {
    it('should allow requests within burst allowance', () => {
      const limiter = createRateLimiter({
        limit: 60,
        windowMs: 60_000,
        burstAllowance: 5,
      });

      // Should allow 5 requests immediately (burst allowance)
      for (let i = 0; i < 5; i++) {
        const result = limiter.checkLimit();
        expect(result.allowed).to.be.true;
        expect(result.remaining).to.equal(4 - i);
      }

      // 6th request should be denied
      const result = limiter.checkLimit();
      expect(result.allowed).to.be.false;
      expect(result.remaining).to.equal(0);
      expect(result.retryAfter).to.be.a('number');
    });

    it('should refill tokens over time', async () => {
      const limiter = createRateLimiter({
        limit: 60, // 1 token per second
        windowMs: 60_000,
        burstAllowance: 2,
      });

      // Exhaust initial tokens
      limiter.checkLimit();
      limiter.checkLimit();

      // Should be rate limited now
      let result = limiter.checkLimit();
      expect(result.allowed).to.be.false;

      // Wait for token refill (simulate 1.1 seconds)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should have one token available now
      result = limiter.checkLimit();
      expect(result.allowed).to.be.true;
    });
  });

  describe('getStatus', () => {
    it('should return status without consuming tokens', () => {
      const limiter = createRateLimiter({
        limit: 60,
        windowMs: 60_000,
        burstAllowance: 3,
      });

      // Check status multiple times
      for (let i = 0; i < 5; i++) {
        const status = limiter.getStatus();
        expect(status.allowed).to.be.true;
        expect(status.remaining).to.equal(3); // Should not decrease
      }
    });

    it('should reflect actual token count after consumption', () => {
      const limiter = createRateLimiter({
        limit: 60,
        windowMs: 60_000,
        burstAllowance: 3,
      });

      // Consume one token
      limiter.checkLimit();

      // Status should show remaining tokens
      const status = limiter.getStatus();
      expect(status.remaining).to.equal(2);
    });
  });
});
