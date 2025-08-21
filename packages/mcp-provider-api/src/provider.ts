import { SemVer } from 'semver';
import { McpPrompt } from './prompts.js';
import { McpResource, McpResourceTemplate } from './resources.js';
import { Services } from './services.js';
import { McpTool } from './tools.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const packageJson: { version: string } = require('../../package.json');
export const MCP_PROVIDER_API_VERSION: SemVer = new SemVer(packageJson.version);

export abstract class McpProvider implements Versioned {
  /**
   * Returns the name given to this provider instance.
   */
  abstract getName(): string;

  /**
   * Provides prompts to be registered with the MCP Server.
   *
   * NOTE - CURRENTLY THE MAIN MCP SERVER DOES NOT CONSUME THIS YET.
   * TODO: Update this documentation when the main server registered provided McpPrompt instances.
   */
  providePrompts(services: Services): Promise<McpPrompt[]> {
    return Promise.resolve([]);
  }

  /**
   * Provides resources to be registered with the MCP Server.
   *
   * NOTE - CURRENTLY THE MAIN MCP SERVER DOES NOT CONSUME THIS YET.
   * TODO: Update this documentation when the main server registered provided McpResource/McpResourceTemplate instances.
   */
  provideResources(services: Services): Promise<(McpResource | McpResourceTemplate)[]> {
    return Promise.resolve([]);
  }

  /**
   * Provides tools to be registered with the MCP Server.
   * @param services Provides a list of services that are available to tool authors
   * @returns An array of McpTool instances
   */
  provideTools(services: Services): Promise<McpTool[]> {
    return Promise.resolve([]);
  }

  /**
   * This method allows the server to check that this provider is return compatible prompts, resources, and tools to be registered.
   * IMPORTANT: Subclasses should not override this method.
   */
  public getVersion(): SemVer {
    return MCP_PROVIDER_API_VERSION;
  }
}

export interface Versioned {
  getName(): string;

  getVersion(): SemVer;
}
