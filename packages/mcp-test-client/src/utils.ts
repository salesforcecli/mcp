import { McpTestClient } from './index.js';

export interface TestSetupOptions {
  client: McpTestClient;
  timeout?: number;
}

export class TestSetup {
  private cleanupFunctions: Array<() => Promise<void> | void> = [];

  constructor(private client: McpTestClient) {}

  onCleanup(fn: () => Promise<void> | void): void {
    this.cleanupFunctions.push(fn);
  }

  async cleanup(): Promise<void> {
    const errors: Error[] = [];

    for (const cleanup of this.cleanupFunctions.reverse()) {
      try {
        await cleanup();
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    try {
      if (this.client.connected) {
        await this.client.disconnect();
      }
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }

    if (errors.length > 0) {
      throw new Error(
        `Cleanup errors: ${errors.map((e) => e.message).join(', ')}`,
      );
    }
  }
}
