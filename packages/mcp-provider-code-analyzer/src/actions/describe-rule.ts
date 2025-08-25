import {EnginePlugin} from "@salesforce/code-analyzer-engine-api";
import {CodeAnalyzer, Rule, RuleSelection} from "@salesforce/code-analyzer-core";
import { getErrorMessage } from "../utils.js";
import { CodeAnalyzerConfigFactory } from "../factories/CodeAnalyzerConfigFactory.js";
import { EnginePluginsFactory } from "../factories/EnginePluginsFactory.js";
import { getMessage } from "../messages.js";
import { ErrorCapturer } from "../listeners/ErrorCapturer.js";

type DescribeRuleActionOptions = {
    configFactory: CodeAnalyzerConfigFactory
    enginePluginsFactory: EnginePluginsFactory
}

// NOTE: THIS MUST ALIGN WITH THE ZOD SCHEMA DEFINED IN `sf-code-analyzer-describe-rule.ts`.
export type DescribeRuleInput = {
    ruleName: string
    engineName: string
};

// NOTE: THIS MUST ALIGN WITH THE ZOD SCHEMA DEFINED IN `sf-code-analyzer-describe-rule.ts`.
export type DescribeRuleOutput = {
    status: string
    rule?: {
        name: string
        engine: string
        severity: number
        tags: string[]
        description: string
        resources: string[]
    }
};

export interface DescribeRuleAction {
    exec(input: DescribeRuleInput): Promise<DescribeRuleOutput>;
}

export class DescribeRuleActionImpl implements DescribeRuleAction {
    private readonly configFactory: CodeAnalyzerConfigFactory;
    private readonly enginePluginsFactory: EnginePluginsFactory;

    public constructor(options: DescribeRuleActionOptions) {
        this.configFactory = options.configFactory;
        this.enginePluginsFactory = options.enginePluginsFactory;
    }

    public async exec(input: DescribeRuleInput): Promise<DescribeRuleOutput> {
        let analyzer: CodeAnalyzer;
        try {
            analyzer = new CodeAnalyzer(this.configFactory.create());
        } catch (e) {
            return {
                status: getMessage('errorCreatingConfig', getErrorMessage(e))
            };
        }

        const errorCapturer: ErrorCapturer = new ErrorCapturer();

        errorCapturer.listen(analyzer);

        try {
            const enginePlugins: EnginePlugin[] = this.enginePluginsFactory.create();
            for (const enginePlugin of enginePlugins) {
                await analyzer.addEnginePlugin(enginePlugin);
            }
        } catch (e) {
            return {
                status: getMessage('errorAddingEngine', getErrorMessage(e))
            };
        }

        const ruleSelection: RuleSelection = await analyzer.selectRules([`${input.ruleName}:${input.engineName}`]);

        if (ruleSelection.getCount() === 0) {
            const capturedErrors: string[] = errorCapturer.getCapturedEvents();
            return {
                status: capturedErrors.length > 0
                    ? capturedErrors.join('\n')
                    : getMessage('ruleNotFound', input.ruleName, input.engineName)
            };
        }

        const rule: Rule = ruleSelection.getRulesFor(ruleSelection.getEngineNames()[0])[0];
        return {
            status: `success`,
            rule: {
                name: rule.getName(),
                engine: rule.getEngineName(),
                severity: rule.getSeverityLevel(),
                description: rule.getDescription(),
                resources: rule.getResourceUrls(),
                tags: rule.getTags()
            }
        };
    }
}