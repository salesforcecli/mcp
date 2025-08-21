import { SemVer } from 'semver';
import { McpPrompt } from "./prompts.js";
import { McpResource, McpResourceTemplate } from "./resources.js";
import { Services } from "./services.js";
import { McpTool } from "./tools.js";
import pkg from '../package.json' with { type: 'json' };

const packageJson: {version: string} = pkg as {version: string};
export const MCP_PROVIDER_API_VERSION: SemVer =  new SemVer(packageJson.version);

export interface Versioned {
    getName(): string;

    getVersion(): SemVer;
}

export abstract class McpProvider implements Versioned {
    /**
     * Returns the name given to this provider instance.
     */
    abstract getName(): string;

    providePrompts(services: Services): McpPrompt[] {
        return [];
    }

    provideResources(services: Services): (McpResource | McpResourceTemplate)[] {
        return [];
    }

    provideTools(services: Services): McpTool[] {
        return [];
    }

    /**
     * This method allows the server to check that this instance is compatible and is able to be registered.
     * Subclasses should not override this method.
     */
    public getVersion(): SemVer {
        return MCP_PROVIDER_API_VERSION;
    }
}