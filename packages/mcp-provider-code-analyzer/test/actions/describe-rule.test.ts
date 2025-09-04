import path from "node:path";
import {fileURLToPath} from "url";

import {
    DescribeRuleActionImpl,
    DescribeRuleInput,
    DescribeRuleOutput
} from "../../src/actions/describe-rule.js";
import {
    CodeAnalyzerConfigFactoryImpl
} from "../../src/factories/CodeAnalyzerConfigFactory.js";
import { CustomizableConfigFactory } from "../stubs/CustomizableConfigFactory.js";
import { EnginePluginsFactoryImpl } from "../../src/factories/EnginePluginsFactory.js";
import { FactoryWithThrowingPlugin1, FactoryWithErrorLoggingPlugin } from "../stubs/EnginePluginFactories.js";
import {SendTelemetryEvent, SpyTelemetryService} from "../test-doubles.js";
import * as Constants from "../../src/constants.js";
import {expect} from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


describe('DescribeRuleActionImpl', () => {
    describe.each([
        {
            case: 'When a custom configuration is present in the run directory',
            pathToDirectory: path.resolve(__dirname, '..', 'fixtures', 'sample-workspaces', 'workspace-with-config'),
            expectedSeverity: 1,
            expectedTags: ['Recommended', 'Apex', 'MyCustomTag']
        },
        {
            case: 'When no custom configuration is present',
            pathToDirectory: path.resolve(__dirname, '..', 'fixtures', 'sample-workspaces', 'workspace-without-config'),
            expectedSeverity: 3,
            expectedTags: ['Recommended', 'CodeStyle', 'Apex']
        }
    ])('$case', ({pathToDirectory, expectedSeverity, expectedTags}) => {

        beforeEach(() => {
            process.chdir(pathToDirectory);
        });

        afterEach(() => {
            process.chdir(__dirname);
        });

        it('When asked to describe an existing rule, the correct description is returned', async () => {
            const input: DescribeRuleInput = {
                ruleName: 'WhileLoopsMustUseBraces',
                engineName: 'PMD' // All-caps the engine name in the input, because some LLMs have been observed to do this too.
            };

            const action: DescribeRuleActionImpl = new DescribeRuleActionImpl({
                configFactory: new CodeAnalyzerConfigFactoryImpl(),
                enginePluginsFactory: new EnginePluginsFactoryImpl()
            });

            const output: DescribeRuleOutput = await action.exec(input);
            expect(output.status).toEqual('success');
            expect(output.rule?.name).toEqual('WhileLoopsMustUseBraces');
            expect(output.rule?.engine).toEqual('pmd');
            expect(output.rule?.severity).toEqual(expectedSeverity);
            expect(output.rule?.tags).toEqual(expectedTags);
        });

        it('When asked to describe a non-existent rule, a coherent error is returned', async () => {
            const input: DescribeRuleInput = {
                ruleName: 'not-a-real-rule',
                engineName: 'pmd'
            };

            const action: DescribeRuleActionImpl = new DescribeRuleActionImpl({
                configFactory: new CodeAnalyzerConfigFactoryImpl(),
                enginePluginsFactory: new EnginePluginsFactoryImpl()
            });

            const output: DescribeRuleOutput = await action.exec(input);

            expect(output.status).toContain(`No rule with name 'not-a-real-rule' exists in engine 'pmd'.`);
            expect(output.rule).toBeUndefined();
        });
    });

    it.each([
        {
            case: 'config is invalid',
            configFactory: new CustomizableConfigFactory('{"asdf": true}'),
            enginePluginsFactory: new EnginePluginsFactoryImpl(),
            keyErrorPhrases: [
                `Error creating Code Analyzer Config:`,
                `invalid key 'asdf'`
            ]
        },
        {
            case: 'an engine cannot be instantiated',
            configFactory: new CustomizableConfigFactory('{"engines": {"pmd": {"asdf": true}}}'),
            enginePluginsFactory: new EnginePluginsFactoryImpl(),
            keyErrorPhrases: [
                `Error within Core: Failed to create engine with name 'pmd' due to the following error:`,
                `invalid key 'asdf'`
            ]
        },
        {
            case: 'an engine cannot be added',
            configFactory: new CodeAnalyzerConfigFactoryImpl(),
            enginePluginsFactory: new FactoryWithThrowingPlugin1(),
            keyErrorPhrases: [
                `Error adding engine:`,
                `FakeErrorWithinGetAvailableEngineNames`
            ]
        }
    ])('When $case, the relevant error is returned', async ({configFactory, enginePluginsFactory, keyErrorPhrases}) => {
        const input: DescribeRuleInput = {
            ruleName: 'irrelevantRuleName',
            engineName: 'pmd'
        };

        const action: DescribeRuleActionImpl = new DescribeRuleActionImpl({
            configFactory,
            enginePluginsFactory
        });

        const output: DescribeRuleOutput = await action.exec(input);

        for (const keyErrorPhrase of keyErrorPhrases) {
            expect(output.status).toContain(keyErrorPhrase);
        }
        expect(output.rule).toBeUndefined();
    });

    describe('Telemetry Emission', () => {
        it('When a telemetry service is provided, it is used', async () => {
            const input: DescribeRuleInput = {
                ruleName: 'Stub1RuleA',
                engineName: 'EngineThatLogsError'
            };

            const telemetryService: SpyTelemetryService = new SpyTelemetryService();

            const action: DescribeRuleActionImpl = new DescribeRuleActionImpl({
                configFactory: new CodeAnalyzerConfigFactoryImpl(),
                enginePluginsFactory: new FactoryWithErrorLoggingPlugin(),
                telemetryService
            });

            await action.exec(input);

            const telemetryEvents: SendTelemetryEvent[] = telemetryService.sendEventCallHistory;

            expect(telemetryEvents).toHaveLength(2);
            expect(telemetryEvents[0].event.source).toEqual('EngineThatLogsError')
            expect(telemetryEvents[0].event.prop1).toEqual(true)
            expect(telemetryEvents[0].event.sfcaEvent).toEqual('DescribeRuleTelemetryEvent');
            expect(telemetryEvents[1].event.source).toEqual('MCP')
            expect(telemetryEvents[1].event.sfcaEvent).toEqual(Constants.McpTelemetryEvents.ENGINE_SELECTION)
            expect(telemetryEvents[1].event.ruleCount).toEqual(1)
        });
    });
});