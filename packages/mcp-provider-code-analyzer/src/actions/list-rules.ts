import {CodeAnalyzerConfigFactory} from "../factories/CodeAnalyzerConfigFactory.js";
import {EnginePluginsFactory} from "../factories/EnginePluginsFactory.js";
import {TelemetryService} from "@salesforce/mcp-provider-api";
import {CodeAnalyzer, Rule, RuleSelection} from "@salesforce/code-analyzer-core";
import {getMessage} from "../messages.js";
import {getErrorMessage} from "../utils.js";
import {ErrorCapturer} from "../listeners/ErrorCapturer.js";
import {TelemetryListenerFactory} from "../factories/TelemetryListenerFactory.js";
import {EnginePlugin} from "@salesforce/code-analyzer-engine-api";
import * as Constants from "../constants.js";

type ListRulesActionOptions = {
    configFactory: CodeAnalyzerConfigFactory
    enginePluginsFactory: EnginePluginsFactory
    telemetryService?: TelemetryService
}

export type ListRulesInput = {
    selector: string
};


export type ListRulesOutput = {
    status: string
    rules?: {
        name: string
        engine: string
        severity: number
        tags: string[]
    }[]
};

export interface ListRulesAction {
    exec(input: ListRulesInput): Promise<ListRulesOutput>;
}

export class ListRulesActionImpl implements ListRulesAction {
    private readonly configFactory: CodeAnalyzerConfigFactory;
    private readonly enginePluginsFactory: EnginePluginsFactory;
    private readonly telemetryService?: TelemetryService;

    public constructor(options: ListRulesActionOptions) {
        this.configFactory = options.configFactory;
        this.enginePluginsFactory = options.enginePluginsFactory;
        this.telemetryService = options.telemetryService;
    }

    public async exec(input: ListRulesInput): Promise<ListRulesOutput> {
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

        const telemetryListener = new TelemetryListenerFactory().create(this.telemetryService)
        telemetryListener.listen(analyzer)

        const enginePlugins: EnginePlugin[] = this.enginePluginsFactory.create();
        try {
            for (const enginePlugin of enginePlugins) {
                await analyzer.addEnginePlugin(enginePlugin);
            }
        } catch (e) {
            return {
                status: getMessage('errorAddingEngine', getErrorMessage(e))
            };
        }

        const ruleSelection: RuleSelection = await analyzer.selectRules([input.selector]);
        this.emitEngineTelemetry(ruleSelection, enginePlugins.flatMap(p => p.getAvailableEngineNames()));

        const rules = ruleSelection.getEngineNames().flatMap(e => ruleSelection.getRulesFor(e)).map(r => {
            return {
                name: r.getName(),
                engine: r.getEngineName(),
                severity: r.getSeverityLevel(),
                tags: r.getTags()
            }
        });
        return {
            status: "success",
            rules
        };
    }


    private emitEngineTelemetry(ruleSelection: RuleSelection, coreEngineNames: string[]): void {
        const selectedEngineNames: Set<string> = new Set(ruleSelection.getEngineNames());
        for (const coreEngineName of coreEngineNames) {
            if (!selectedEngineNames.has(coreEngineName)) {
                continue;
            }
            if (this.telemetryService) {
                this.telemetryService.sendEvent(Constants.TelemetryEventName, {
                    source: Constants.TelemetrySource,
                    sfcaEvent: Constants.McpTelemetryEvents.ENGINE_SELECTION,
                    engine: coreEngineName,
                    ruleCount: ruleSelection.getRulesFor(coreEngineName).length
                })
            }
        }
    }
}