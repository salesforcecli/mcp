import { McpPrompt } from "./prompts.js";
import { McpResource, McpResourceTemplate } from "./resources.js";
import { Services } from "./services.js";
import { McpTool } from "./tools.js";

export abstract class McpProvider {
    providePrompts(services: Services): McpPrompt[] {
        return [];
    }

    provideResources(services: Services): (McpResource | McpResourceTemplate)[] {
        return [];
    }

    provideTools(services: Services): McpTool[] {
        return [];
    }
}