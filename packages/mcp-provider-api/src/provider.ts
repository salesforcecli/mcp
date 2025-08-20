import { McpPrompt } from "./prompts.js";
import { McpResource, McpResourceTemplate } from "./resources.js";
import { Services } from "./services.js";
import { McpTool } from "./tools.js";
import { MCP_PROVIDER_API_VERSION } from "./constants.js";

export abstract class McpProvider {
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
    public getVersion(): string {
        return MCP_PROVIDER_API_VERSION;
    }
}