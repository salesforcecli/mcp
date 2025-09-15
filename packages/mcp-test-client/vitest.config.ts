import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 10000,
    environment: "node",
    include: ["test/**/*.test.ts"],
    globals: true,
    clearMocks: true,
  },
});
