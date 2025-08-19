import { McpPrompt } from "./prompts.js";
import { McpResource, McpResourceTemplate } from "./resources.js";
import { Services } from "./services.js";
import { McpTool } from "./tools.js";
export declare abstract class McpProvider {
    providePrompts(services: Services): McpPrompt[];
    provideResources(services: Services): (McpResource | McpResourceTemplate)[];
    provideTools(services: Services): McpTool[];
}
