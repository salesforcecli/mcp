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


type RunAnalyzerActionOptions = {
    configFactory: CodeAnalyzerConfigFactory
    enginePluginsFactory: EnginePluginsFactory
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

    public constructor(options: RunAnalyzerActionOptions) {
        this.configFactory = options.configFactory;
        this.enginePluginsFactory = options.enginePluginsFactory;
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

        // TODO: If we ever add support for FlowTest or SFGE, we'll need to synthesize an actual workspace, probably from `process.cwd()` or similar.
        const workspace: Workspace = await analyzer.createWorkspace([
            ...input.target
        ], input.target);

        // At this time, we're hardcoding for the recommended rules.
        const ruleSelection: RuleSelection = await analyzer.selectRules(['recommended'], {workspace});

        const results: RunResults = await analyzer.run(ruleSelection, {workspace});

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
}

export function indent(value: string): string {
    return '    ' + value.replaceAll('\n', `\n    `);
}