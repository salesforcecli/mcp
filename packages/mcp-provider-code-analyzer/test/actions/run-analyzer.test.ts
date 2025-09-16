import {fileURLToPath} from "url";
import path from "node:path";
import fs from "node:fs";

import {
    RunAnalyzerActionImpl,
    RunInput,
    RunOutput
} from "../../src/actions/run-analyzer.js";
import { CustomizableConfigFactory } from "../stubs/CustomizableConfigFactory.js";
import {EnginePluginsFactoryImpl} from "../../src/factories/EnginePluginsFactory.js";
import {CodeAnalyzerConfigFactoryImpl} from "../../src/factories/CodeAnalyzerConfigFactory.js";
import {
    FactoryWithThrowingPlugin1,
    FactoryWithThrowingPlugin2,
    FactoryForThrowingPlugin3,
    FactoryWithErrorLoggingPlugin
} from "../stubs/EnginePluginFactories.js";
import {SendTelemetryEvent, SpyTelemetryService} from "../test-doubles.js";
import * as Constants from "../../src/constants.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PATH_TO_SAMPLE_TARGETS: string = path.resolve(__dirname, '..', 'fixtures', 'sample-targets');
const PATH_TO_COMPARISON_FILES: string = path.resolve(__dirname, '..', 'fixtures', 'comparison-files');

// TODO: FIGURE OUT A WAY TO MAKE THESE GOLD FILE TESTS MORE ROBUST AGAINST VERSION CHANGES. FOR NOW USING CONSTANT:
const PMD_VERSION: string = '7.17.0';

describe('RunAnalyzerActionImpl', () => {
    it.each([
        {
            case: 'no violations are found and all engines succeed',
            expectation: 'the status is "success" and the outfile has no violations',
            target: [
                path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget1.cls')
            ],
            comparisonFile: path.join(PATH_TO_COMPARISON_FILES, 'no-pmd-violations.goldfile.json'),
            // Turn off CPD because it has an observed tendency to fail on `.mts` files and it's likely to catch some in the crossfire.
            configFactory: new CustomizableConfigFactory('{"engines": {"cpd": {"disable_engine": true}}}'),
            enginePluginsFactory: new EnginePluginsFactoryImpl(),
            keyStatusPhrases: [
                'success'
            ],
            expectedSummary: {
                total: 0,
                sev1: 0,
                sev2: 0,
                sev3: 0,
                sev4: 0,
                sev5: 0
            }
        },
        {
            case: 'violations are found and all engine succeed',
            expectation: 'the status is "success" and the outfile has the right violations',
            target: [
                path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget2.cls')
            ],
            comparisonFile: path.join(PATH_TO_COMPARISON_FILES, 'violations-in-ApexTarget2-cls.goldfile.json'),
            // Turn off CPD because it has an observed tendency to fail on `.mts` files and it's likely to catch some in the crossfire.
            configFactory: new CustomizableConfigFactory('{"engines": {"cpd": {"disable_engine": true}}}'),
            enginePluginsFactory: new EnginePluginsFactoryImpl(),
            keyStatusPhrases: [
                'success'
            ],
            expectedSummary: {
                total: 6,
                sev1: 0,
                sev2: 0,
                sev3: 3,
                sev4: 3,
                sev5: 0
            }
        },
        {
            case: 'no violations are found and non-fatal errors are logged',
            expectation: 'the status contains the errors and the outfile has no violations',
            target: [
                path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget2.cls')
            ],
            comparisonFile: path.join(PATH_TO_COMPARISON_FILES, 'no-custom-engine-violations.goldfile.json'),
            configFactory: new CustomizableConfigFactory('{}'),
            enginePluginsFactory: new FactoryWithErrorLoggingPlugin(),
            keyStatusPhrases: [
                'Run completed successfully, but the following errors were logged, and results may be incomplete:',
                'FakeErrorLog'
            ],
            expectedSummary: {
                total: 0,
                sev1: 0,
                sev2: 0,
                sev3: 0,
                sev4: 0,
                sev5: 0
            }
        },
        {
            case: 'the global config is invalid',
            expectation: 'the status has the relevant errors and no outfile is created',
            target: [
                path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget1.cls')
            ],
            comparisonFile: undefined,
            configFactory: new CustomizableConfigFactory('{"asdf": true}'),
            enginePluginsFactory: new EnginePluginsFactoryImpl(),
            keyStatusPhrases: [
                `Error creating Code Analyzer Config:`,
                `invalid key 'asdf'`
            ]
        },
        {
            case: 'an engine-level config is invalid',
            expectation: 'the status has the relevant errors and the outfile has an UninstantiableEngineError violation',
            target: [
                path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget1.cls')
            ],
            comparisonFile: path.join(PATH_TO_COMPARISON_FILES, 'invalid-pmd-config-violation.goldfile.txt'),
            configFactory: new CustomizableConfigFactory('{"engines": {"pmd": {"asdf": true}}}'),
            enginePluginsFactory: new EnginePluginsFactoryImpl(),
            keyStatusPhrases: [
                `Error within Core: Failed to create engine with name 'pmd' due to the following error:`,
                `invalid key 'asdf'`
            ],
            expectedSummary: {
                total: 1,
                sev1: 1,
                sev2: 0,
                sev3: 0,
                sev4: 0,
                sev5: 0
            }
        },
        {
            case: 'an engine cannot be added',
            expectation: 'the status has the relevant errors and no outfile is created',
            target: [
                path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget1.cls')
            ],
            comparisonFile: undefined,
            configFactory: new CodeAnalyzerConfigFactoryImpl(),
            enginePluginsFactory: new FactoryWithThrowingPlugin1(),
            keyStatusPhrases: [
                `Error adding engine:`,
                `FakeErrorWithinGetAvailableEngineNames`
            ]
        },
        {
            case: 'an engine cannot return rules',
            expectation: 'the status has the relevant errors and the outfile has an UninstantiableengineError violation',
            target: [
                path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget1.cls')
            ],
            comparisonFile: path.join(PATH_TO_COMPARISON_FILES, 'UninstantiableEngineError-for-EngineThatCannotReturnRules.goldfile.txt'),
            configFactory: new CodeAnalyzerConfigFactoryImpl(),
            enginePluginsFactory: new FactoryWithThrowingPlugin2(),
            keyStatusPhrases: [
                'Run completed successfully, but the following errors were logged, and results may be incomplete:',
                "Error within Core: Failed to get rules from engine with name 'EngineThatCannotReturnRules' due to the following error:",
                "ThisEngineCannotReturnRules"
            ],
            expectedSummary: {
                total: 1,
                sev1: 1,
                sev2: 0,
                sev3: 0,
                sev4: 0,
                sev5: 0
            }
        },
        {
            case: 'an engine cannot run rules',
            // CodeAnalyzer catches the error and treats it as a synthetic violation.
            // Since we're not actually reading the outfile to check its results, we can't actually return anything useful
            // in the status.
            expectation: 'the status is "success" and the outfile has an UnexpectedEngineError violation',
            target: [
                path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget1.cls')
            ],
            comparisonFile: path.join(PATH_TO_COMPARISON_FILES, 'UnexpectedEngineError-violation.goldfile.txt'),
            configFactory: new CodeAnalyzerConfigFactoryImpl(),
            enginePluginsFactory: new FactoryForThrowingPlugin3(),
            keyStatusPhrases: [
                'success'
            ],
            expectedSummary: {
                total: 1,
                sev1: 1,
                sev2: 0,
                sev3: 0,
                sev4: 0,
                sev5: 0
            }
        }
    ])('When $case, $expectation', async ({target, comparisonFile, configFactory, enginePluginsFactory, keyStatusPhrases, expectedSummary}) => {
        const input: RunInput = {
            target
        }

        const action: RunAnalyzerActionImpl = new RunAnalyzerActionImpl({
            configFactory,
            enginePluginsFactory
        });

        const output: RunOutput = await action.exec(input);

        for (const keyStatusPhrase of keyStatusPhrases) {
            expect(output.status).toContain(keyStatusPhrase);
        }

        if (comparisonFile) {
            expect(output.resultsFile).toBeDefined();

            const outputFileContents: string = await fs.promises.readFile(output.resultsFile!, 'utf-8');

            const pathSepVar: string = path.sep.replaceAll('\\', '\\\\');
            const runDir: string = process.cwd().replaceAll('\\' , '\\\\');

            const expectedOutfile: string =  (await fs.promises.readFile(comparisonFile, 'utf-8'))
                .replaceAll('{{RUNDIR}}', runDir)
                .replaceAll(`{{SEP}}`, pathSepVar)
                .replaceAll('{{PMD_VERSION}}', PMD_VERSION);

            expect(outputFileContents).toContain(expectedOutfile);
            expect(output.summary).toEqual(expectedSummary);
        } else {
            expect(output.resultsFile).toBeUndefined();
        }
    }, 15_000);

    describe('Telemetry Emission', () => {
        it('When a telemetry service is provided, it is used', async () => {
            const input: RunInput = {
                target: [path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget1.cls')]
            };

            const spyTelemetryService: SpyTelemetryService = new SpyTelemetryService();

            const action: RunAnalyzerActionImpl = new RunAnalyzerActionImpl({
                configFactory: new CodeAnalyzerConfigFactoryImpl(),
                enginePluginsFactory: new FactoryWithErrorLoggingPlugin(),
                telemetryService: spyTelemetryService
            });

            await action.exec(input);

            const telemetryEvents: SendTelemetryEvent[] = spyTelemetryService.sendEventCallHistory;

            expect(telemetryEvents).toHaveLength(4);
            expect(telemetryEvents[0].event.source).toEqual('EngineThatLogsError')
            expect(telemetryEvents[0].event.sfcaEvent).toEqual('DescribeRuleTelemetryEvent');
            expect(telemetryEvents[0].event.prop1).toEqual(true);
            expect(telemetryEvents[1].event.source).toEqual('EngineThatLogsError')
            expect(telemetryEvents[1].event.sfcaEvent).toEqual('RunRulesTelemetryEvent');
            expect(telemetryEvents[1].event.prop1).toEqual(true);
            expect(telemetryEvents[2].event.source).toEqual('MCP')
            expect(telemetryEvents[2].event.sfcaEvent).toEqual(Constants.McpTelemetryEvents.ENGINE_SELECTION);
            expect(telemetryEvents[2].event.ruleCount).toEqual(1);
            expect(telemetryEvents[3].event.source).toEqual('MCP')
            expect(telemetryEvents[3].event.sfcaEvent).toEqual(Constants.McpTelemetryEvents.ENGINE_EXECUTION);
            expect(telemetryEvents[3].event.violationCount).toEqual(0);
        });
    });
})
