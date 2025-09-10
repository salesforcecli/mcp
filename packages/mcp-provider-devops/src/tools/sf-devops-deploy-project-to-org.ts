import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { DeployProjectToOrgAction, DeployProjectToOrgInput } from "../actions/deploy-project-to-org.js";

const DESCRIPTION = `**MANDATORY:** Before using this tool, always confirm that the target org is a Sandbox or Dev org. 
      If not clear, use the 'list-orgs' tool to list all orgs. The list will indicate which org is Sandbox or Dev if possible. 
      If these details are not provided, ask the user to specify which org is Sandbox or Dev. 
      Only proceed after the user has selected the correct org.

Deploys a Salesforce project to a specified org using the Salesforce CLI.

**How to use this tool:**
- Use after checking out a project branch with the 'checkout-workitem-branch' tool. The project directory should be the one just checked out and on the correct branch for the work item.
- The target org must be a Sandbox or Dev org. The org alias or ID is available in the work item or must be provided by the user.
- If either the project directory or org alias/ID is not clear, ask the user to select the work item again.
- The tool will deploy all source files in the specified directory to the given org.
- The output will indicate success or failure, include the CLI output, and clearly state the org where the deployment is happening.
- **After a successful deployment, always suggest the user push their changes in the work item branch using the 'push-workitem-branch-changes' tool to ensure all changes are committed and available in the remote repository.**

**Input Parameters:**
- targetOrg: The alias of the Salesforce Sandbox or Dev org to deploy to (e.g., 'my-scratch').
- projectDir: The path to the project directory to deploy from.`;

const inputSchema = z.object({
    targetOrg: z.string().describe("The alias of the Salesforce org to deploy to."),
    projectDir: z.string().describe("The path to the project directory to deploy from.")
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsDeployProjectToOrgTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: DeployProjectToOrgAction;

    constructor(action: DeployProjectToOrgAction) {
        super();
        this.action = action;
    }

    public getReleaseState(): ReleaseState {
        return ReleaseState.NON_GA;
    }

    public getToolsets(): Toolset[] {
        return [Toolset.METADATA];
    }

    public getName(): string {
        return "sf-devops-deploy-project-to-org";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Deploy Project to Salesforce Org",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: false,
            },
        };
    }

    public async exec(input: InputArgs): Promise<CallToolResult> {
        const deployInput: DeployProjectToOrgInput = {
            targetOrg: input.targetOrg,
            projectDir: input.projectDir
        };

        const result = await this.action.exec(deployInput);

        return {
            content: [{
                type: "text",
                text: result.message,
            }],
            isError: !result.success,
        };
    }
}
