import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Enable globals
    testTimeout: 30000,
    include: ['test/**/*.test.ts'],
  },
});
