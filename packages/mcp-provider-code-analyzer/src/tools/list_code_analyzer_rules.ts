import {z} from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {McpTool, ReleaseState, McpToolConfig, Toolset} from "@salesforce/mcp-provider-api";
import {ListRulesAction, ListRulesInput, ListRulesOutput, ListRulesActionImpl} from "../actions/list-rules.js";
import {CodeAnalyzerConfigFactoryImpl} from "../factories/CodeAnalyzerConfigFactory.js";
import {EnginePluginsFactoryImpl} from "../factories/EnginePluginsFactory.js";
import {getErrorMessage} from "../utils.js";
import {
    ENGINE_NAMES,
    SEVERITY_NUMBERS,
    SEVERITY_NAMES,
    GENERAL_TAGS,
    CATEGORIES,
    LANGUAGES,
    ENGINE_SPECIFIC_TAGS
} from "../constants.js";

// Precompute allowed selector tokens (lowercased) once at module scope
const ALLOWED_SELECTOR_TOKENS_LOWER: ReadonlySet<string> = new Set<string>([
    ...ENGINE_NAMES.map(s => s.toLowerCase()),
    ...SEVERITY_NAMES.map(s => s.toLowerCase()),
    ...SEVERITY_NUMBERS.map(n => String(n)),
    ...GENERAL_TAGS.map(s => s.toLowerCase()),
    ...CATEGORIES.map(s => s.toLowerCase()),
    ...LANGUAGES.map(s => s.toLowerCase()),
    ...ENGINE_SPECIFIC_TAGS.map(s => s.toLowerCase())
]);


const DESCRIPTION: string = `A tool for selecting Code Analyzer rules based on a number of criteria.\n` +
    `This tool returns a JSON array describing Code Analyzer rules that match a "selector".\n` +
    `A selector is a colon-separated (:) string of tokens; tags and severity names are case-insensitive.\n` +
    `\n` +
    `Examples:\n` +
    `- "Recommended" → all rules tagged as Recommended.\n` +
    `- "Performance:pmd:Critical" → rules in the PMD engine with the Performance tag and Critical severity.\n` +
    `- "Security:High" → rules tagged Security with High severity.\n` +
    `- "Apex:Recommended" → rules for the Apex language that are Recommended.\n` +
    `- "DevPreview" → rules marked as DevPreview.\n` +
    `- Prompt: "tell me about all performance rules" → selector: "Performance".\n` +
    `\n` +
    `Supported selector tokens:\n` +
    `- Engines: eslint, regex, retire-js, flow, pmd, cpd, sfge\n` +
    `- Severities (names): Critical, High, Moderate, Low, Info\n` +
    `- Severities (numbers): 1, 2, 3, 4, 5\n` +
    `- General tags: Recommended, Custom, All\n` +
    `- Categories: BestPractices, CodeStyle, Design, Documentation, ErrorProne, Security, Performance\n` +
    `- Languages: Apex, CSS, HTML, JavaScript, TypeScript, Visualforce, XML\n` +
    `- Engine-specific tags: DevPreview, LWC
    `;

export const inputSchema = z.object({
    selector: z.string().describe("A selector for Code Analyzer rules. Must meet the criteria outlined in the tool-level description.")
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    status: z.string().describe('If the operation succeeds, this will be "success". Otherwise, it will be an error message.'),
    rules: z.array(z.object({
        name: z.string().describe('The name of the rule, equivalent to the `ruleName` input property.'),
        engine: z.string().describe('The name of the engine to which the rule belongs.'),
        severity: z.number().describe('An integer between 1 and 5 indicating the severity of the rule. Lower numbers are MORE severe.'),
        tags: z.array(z.string()).describe('An array of strings indicating tags applicable to the rule, e.g. "performance", "security", etc.'),
        description: z.string().describe('A string describing the purpose and functionality of the rule.'),
        resources: z.array(z.string()).describe('A possibly empty array of strings that represent links to documentation or other helpful material.')
    })).optional().describe('An array of rules that matched the selector. Empty if no rules matched.')
});
type OutputArgsShape = typeof outputSchema.shape;

export class CodeAnalyzerListRulesMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    public static readonly NAME: string = 'list_code_analyzer_rules';
    private readonly action: ListRulesAction;

    /**
     * Validates a selector string ensuring that each token (split on ',' and ':')
     * matches one of the supported engines, severities (name or number), or tags.
     * Case-insensitive for tags and severity names; engine names compared case-insensitively as well.
     */
    public static validateSelector(selector: string): { valid: true } | { valid: false, invalidTokens: string[] } {
        // Explicitly reject empty selectors
        if (!selector || selector.trim().length === 0) {
            return { valid: false, invalidTokens: ['<empty>'] };
        }

        const rawTokens: string[] = selector
            .split(':')
            .map(t => t.trim())
            .filter(t => t.length > 0);

        const invalid: string[] = [];
        for (const token of rawTokens) {
            const normalized = token.toLowerCase();
            if (!ALLOWED_SELECTOR_TOKENS_LOWER.has(normalized)) {
                invalid.push(token);
            }
        }
        return invalid.length === 0 ? { valid: true } : { valid: false, invalidTokens: Array.from(new Set(invalid)) };
    }

    public constructor(
        action: ListRulesAction = new ListRulesActionImpl({
            configFactory: new CodeAnalyzerConfigFactoryImpl(),
            enginePluginsFactory: new EnginePluginsFactoryImpl()
        })
    ) {
        super();
        this.action = action;
    }

    public getReleaseState(): ReleaseState {
        return ReleaseState.NON_GA;
    }

    public getToolsets(): Toolset[] {
        return [Toolset.CODE_ANALYSIS];
    }

    public getName(): string {
        return CodeAnalyzerListRulesMcpTool.NAME;
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "List Code Analyzer Rules",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: outputSchema.shape,
            annotations: {
                readOnlyHint: true
            }
        }
    }

    /**
     * Supports selector filtering with the following values:
     * - Engine names: eslint, regex, retire-js, flow, pmd, cpd, sfge
     * - Severities:
     *   - Names: Critical, High, Moderate, Low, Info
     *   - Numbers: 1, 2, 3, 4, 5
     * - Tags (case-insensitive):
     *   - General: Recommended, Custom, All
     *   - Categories: BestPractices, CodeStyle, Design, Documentation, ErrorProne, Security, Performance
     *   - Languages: Apex, CSS, HTML, JavaScript, TypeScript, Visualforce, XML
     *   - Engine-specific: DevPreview, LWC
     */
    public async exec(input: ListRulesInput): Promise<CallToolResult> {
        let output: ListRulesOutput;
        const validation = CodeAnalyzerListRulesMcpTool.validateSelector(input.selector);
        if (validation.valid === false) {
            const msg = `Invalid selector token(s): ${validation.invalidTokens.join(', ')}`;
            return {
                isError: true,
                content: [{ type: "text", text: JSON.stringify({ status: msg }) }],
                structuredContent: { status: msg }
            };
        }
        try {
            output = await this.action.exec(input);
        } catch (e) {
            output = { status: getErrorMessage(e) }
        }
        return {
            content: [{ type: "text", text: JSON.stringify(output)}],
            structuredContent: output
        };
    }
}