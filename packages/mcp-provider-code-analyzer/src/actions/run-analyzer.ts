import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import {CodeAnalyzer, OutputFormat, RuleSelection, RunResults, Workspace} from "@salesforce/code-analyzer-core";
import {EnginePlugin} from "@salesforce/code-analyzer-engine-api";
import {getErrorMessage} from "../utils.js";
import {getMessage} from "../messages.js";
import { CodeAnalyzerConfigFactory } from "../factories/CodeAnalyzerConfigFactory.js";
import { EnginePluginsFactory } from "../factories/EnginePluginsFactory.js";
import { ErrorCapturer } from "../listeners/ErrorCapturer.js";
import {TelemetryService} from "@salesforce/mcp-provider-api";
import {TelemetryListenerFactory} from "../factories/TelemetryListenerFactory.js";
import {TelemetryListener} from "../listeners/TelemetryListener.js";
import * as Constants from "../constants.js";


type RunAnalyzerActionOptions = {
    configFactory: CodeAnalyzerConfigFactory
    enginePluginsFactory: EnginePluginsFactory
    telemetryService?: TelemetryService
}

// NOTE: THIS MUST ALIGN WITH THE ZOD SCHEMA DEFINED IN `sf-code-analyzer-run.ts`.
export type RunInput = {
    target: string[]
}

// NOTE: THIS MUST ALIGN WITH THE ZOD SCHEMA DEFINED IN `sf-code-analyzer-run.ts`.
export type RunOutput = {
    status: string
    resultsFile?: string
}

export interface RunAnalyzerAction {
    exec(input: RunInput): Promise<RunOutput>;
}

export class RunAnalyzerActionImpl implements RunAnalyzerAction {
    private readonly configFactory: CodeAnalyzerConfigFactory;
    private readonly enginePluginsFactory: EnginePluginsFactory;
    private readonly telemetryService?: TelemetryService

    public constructor(options: RunAnalyzerActionOptions) {
        this.configFactory = options.configFactory;
        this.enginePluginsFactory = options.enginePluginsFactory;
        this.telemetryService = options.telemetryService;
    }

    public async exec(input: RunInput): Promise<RunOutput> {
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

        const telemetryListener: TelemetryListener = new TelemetryListenerFactory().create(this.telemetryService);
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

        // TODO: If we ever add support for FlowTest or SFGE, we'll need to synthesize an actual workspace, probably from `process.cwd()` or similar.
        const workspace: Workspace = await analyzer.createWorkspace([
            ...input.target
        ], input.target);

        // At this time, we're hardcoding for the recommended rules.
        const ruleSelection: RuleSelection = await analyzer.selectRules(['recommended'], {workspace});

        const results: RunResults = await analyzer.run(ruleSelection, {workspace});
        this.emitEngineTelemetry(ruleSelection, results, enginePlugins.flatMap(p => p.getAvailableEngineNames()));

        const resultsFile: string = await this.writeResults(results);

        const capturedErrors: string[] = errorCapturer.getCapturedEvents();

        if (capturedErrors.length > 0) {
            return {
                status: getMessage('runCompletedWithErrorsHeader') + '\n' + indent(capturedErrors.join('\n')),
                resultsFile
            };
        }

        return Promise.resolve({
            status: `success`,
            resultsFile
        });
    }

    private async writeResults(results: RunResults): Promise<string> {
        const resultsFilePath: string = path.join(os.tmpdir(), this.getResultsFileName());

        await fs.promises.writeFile(resultsFilePath, results.toFormattedOutput(OutputFormat.JSON));

        return resultsFilePath;
    }

    private getResultsFileName(): string {
        const dateTime: Date = new Date(Date.now());
        const year: number = dateTime.getFullYear();
        const month: string = String(dateTime.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const day: string = String(dateTime.getDate()).padStart(2, '0');
        const hours: string = String(dateTime.getHours()).padStart(2, '0');
        const minutes: string = String(dateTime.getMinutes()).padStart(2, '0');
        const seconds: string = String(dateTime.getSeconds()).padStart(2, '0');
        const milliseconds: string = String(dateTime.getMilliseconds()).padStart(3, '0');
        return `code-analyzer-results-${year}_${month}_${day}_${hours}_${minutes}_${seconds}_${milliseconds}.json`;
    }

    private emitEngineTelemetry(ruleSelection: RuleSelection, results: RunResults, coreEngineNames: string[]): void {
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
                this.telemetryService.sendEvent(Constants.TelemetryEventName, {
                    source: Constants.TelemetrySource,
                    sfcaEvent: Constants.McpTelemetryEvents.ENGINE_EXECUTION,
                    engine: coreEngineName,
                    violationCount: results.getEngineRunResults(coreEngineName).getViolationCount()
                })
            }
        }
    }
}

export function indent(value: string): string {
    return '    ' + value.replaceAll('\n', `\n    `);
}