import {describe, it, expect} from 'vitest';
import { ListRulesActionImpl, ListRulesInput, ListRulesOutput } from '../../src/actions/list-rules.js';
import { CustomizableConfigFactory } from '../stubs/CustomizableConfigFactory.js';
import { FactoryWithErrorLoggingPlugin, FactoryWithThrowingPlugin1 } from '../stubs/EnginePluginFactories.js';
import { SpyTelemetryService } from '../test-doubles.js';
import * as Constants from '../../src/constants.js';
import { EnginePluginsFactory } from '../../src/factories/EnginePluginsFactory.js';
import * as EngineApi from '@salesforce/code-analyzer-engine-api';

describe('ListRulesActionImpl', () => {
    it('returns matching rules for a valid selector', async () => {
        const action: ListRulesActionImpl = new ListRulesActionImpl({
            configFactory: new CustomizableConfigFactory('{}'),
            enginePluginsFactory: new FactoryWithErrorLoggingPlugin()
        });

        const input: ListRulesInput = {
            selector: 'Recommended'
        };

        const output: ListRulesOutput = await action.exec(input);

        expect(output.status).toEqual('success');
        expect(output.rules).toBeDefined();
        expect(output.rules!.length).toBeGreaterThan(0);

        const found = output.rules!.find(r => r.name === 'stub1RuleA' && r.engine === 'EngineThatLogsError');
        expect(found).toBeDefined();
        expect(found!.tags).toContain('Recommended');
        expect(found!.description).toContain('Some description');
        expect(Array.isArray(found!.resources)).toBe(true);
    });

    it('emits telemetry for engine selection', async () => {
        const telemetry = new SpyTelemetryService();
        const action: ListRulesActionImpl = new ListRulesActionImpl({
            configFactory: new CustomizableConfigFactory('{}'),
            enginePluginsFactory: new FactoryWithErrorLoggingPlugin(),
            telemetryService: telemetry
        });

        const output: ListRulesOutput = await action.exec({ selector: 'Recommended' });

        expect(output.status).toEqual('success');
        // Expect at least one Engine telemetry (from describeRules) and one MCP selection event
        const events = telemetry.sendEventCallHistory;
        expect(events.length).toBeGreaterThanOrEqual(2);

        const engineEvent = events.find(e => e.event.source === 'EngineThatLogsError' && e.event.sfcaEvent === 'DescribeRuleTelemetryEvent');
        expect(engineEvent).toBeDefined();

        const mcpSelectionEvent = events.find(e => e.event.source === 'MCP' && e.event.sfcaEvent === Constants.McpTelemetryEvents.ENGINE_SELECTION);
        expect(mcpSelectionEvent).toBeDefined();
        expect((mcpSelectionEvent!.event as any).engine).toEqual('EngineThatLogsError');
        expect((mcpSelectionEvent!.event as any).ruleCount).toBeGreaterThanOrEqual(1);
    });

    it('returns an error when the config is invalid', async () => {
        const action: ListRulesActionImpl = new ListRulesActionImpl({
            configFactory: new CustomizableConfigFactory('{"asdf": true}'),
            enginePluginsFactory: new FactoryWithErrorLoggingPlugin()
        });

        const output: ListRulesOutput = await action.exec({ selector: 'Recommended' });

        expect(output.status).toContain('Error creating Code Analyzer Config:');
        expect(output.status).toContain(`invalid key 'asdf'`);
        expect(output.rules).toBeUndefined();
    });

    it('returns an error when adding an engine fails', async () => {
        const action: ListRulesActionImpl = new ListRulesActionImpl({
            configFactory: new CustomizableConfigFactory('{}'),
            enginePluginsFactory: new FactoryWithThrowingPlugin1()
        });

        const output: ListRulesOutput = await action.exec({ selector: 'Recommended' });

        expect(output.status).toContain('Error adding engine:');
        expect(output.status).toContain('FakeErrorWithinGetAvailableEngineNames');
        expect(output.rules).toBeUndefined();
    });

    it('emits selection only for engines with matching rules and skips others', async () => {
        class TwoEngineFactory implements EnginePluginsFactory {
            public create(): EngineApi.EnginePlugin[] {
                return [new TwoEnginePlugin()];
            }
        }
        class TwoEnginePlugin extends EngineApi.EnginePluginV1 {
            private readonly created: Map<string, EngineApi.Engine> = new Map();
            getAvailableEngineNames(): string[] {
                return ['EngineSelected', 'EngineIgnored'];
            }
            createEngine(engineName: string, config: EngineApi.ConfigObject): Promise<EngineApi.Engine> {
                if (engineName === 'EngineSelected') {
                    this.created.set(engineName, new EngineSelected(config));
                } else if (engineName === 'EngineIgnored') {
                    this.created.set(engineName, new EngineIgnored(config));
                } else {
                    throw new Error(`Unsupported engine ${engineName}`);
                }
                return Promise.resolve(this.created.get(engineName)!);
            }
        }
        class EngineSelected extends EngineApi.Engine {
            public constructor(_config: EngineApi.ConfigObject) { super(); }
            getName(): string { return 'EngineSelected'; }
            getEngineVersion(): Promise<string> { return Promise.resolve('1.0.0'); }
            async describeRules(): Promise<EngineApi.RuleDescription[]> {
                return [{
                    name: 'selRule',
                    severityLevel: EngineApi.SeverityLevel.Low,
                    tags: ['Recommended'],
                    description: 'Selected desc',
                    resourceUrls: []
                }];
            }
            async runRules(_ruleNames: string[], _runOptions: EngineApi.RunOptions): Promise<EngineApi.EngineRunResults> {
                return { violations: [] };
            }
        }
        class EngineIgnored extends EngineApi.Engine {
            public constructor(_config: EngineApi.ConfigObject) { super(); }
            getName(): string { return 'EngineIgnored'; }
            getEngineVersion(): Promise<string> { return Promise.resolve('1.0.0'); }
            async describeRules(): Promise<EngineApi.RuleDescription[]> {
                return [{
                    name: 'ignRule',
                    severityLevel: EngineApi.SeverityLevel.High,
                    tags: ['Security'],
                    description: 'Ignored desc',
                    resourceUrls: []
                }];
            }
            async runRules(_ruleNames: string[], _runOptions: EngineApi.RunOptions): Promise<EngineApi.EngineRunResults> {
                return { violations: [] };
            }
        }

        const telemetry = new SpyTelemetryService();
        const action: ListRulesActionImpl = new ListRulesActionImpl({
            configFactory: new CustomizableConfigFactory('{}'),
            enginePluginsFactory: new TwoEngineFactory(),
            telemetryService: telemetry
        });

        const output = await action.exec({ selector: 'Recommended' });
        expect(output.status).toEqual('success');
        expect(output.rules!.every(r => r.engine === 'EngineSelected')).toBe(true);

        const selectionEvents = telemetry.sendEventCallHistory
            .filter(e => e.event.sfcaEvent === Constants.McpTelemetryEvents.ENGINE_SELECTION);
        expect(selectionEvents.find(e => (e.event as any).engine === 'EngineSelected')).toBeDefined();
        expect(selectionEvents.find(e => (e.event as any).engine === 'EngineIgnored')).toBeUndefined();
    });

    it('returns success with empty rules when no selector matches', async () => {
        class OneEngineNoMatchFactory implements EnginePluginsFactory {
            public create(): EngineApi.EnginePlugin[] {
                return [new OneEngineNoMatchPlugin()];
            }
        }
        class OneEngineNoMatchPlugin extends EngineApi.EnginePluginV1 {
            private created?: EngineApi.Engine;
            getAvailableEngineNames(): string[] { return ['NoMatchEngine']; }
            createEngine(engineName: string, config: EngineApi.ConfigObject): Promise<EngineApi.Engine> {
                if (!this.created) this.created = new NoMatchEngine(config);
                return Promise.resolve(this.created);
            }
        }
        class NoMatchEngine extends EngineApi.Engine {
            public constructor(_config: EngineApi.ConfigObject) { super(); }
            getName(): string { return 'NoMatchEngine'; }
            getEngineVersion(): Promise<string> { return Promise.resolve('1.0.0'); }
            async describeRules(): Promise<EngineApi.RuleDescription[]> {
                return [{
                    name: 'nmr',
                    severityLevel: EngineApi.SeverityLevel.Low,
                    tags: ['OtherTag'],
                    description: 'No match',
                    resourceUrls: []
                }];
            }
            async runRules(_ruleNames: string[], _runOptions: EngineApi.RunOptions): Promise<EngineApi.EngineRunResults> {
                return { violations: [] };
            }
        }

        const telemetry = new SpyTelemetryService();
        const action: ListRulesActionImpl = new ListRulesActionImpl({
            configFactory: new CustomizableConfigFactory('{}'),
            enginePluginsFactory: new OneEngineNoMatchFactory(),
            telemetryService: telemetry
        });

        const output = await action.exec({ selector: 'NotPresentTag' });
        expect(output.status).toEqual('success');
        expect(output.rules).toBeDefined();
        expect(output.rules!.length).toEqual(0);
        expect(telemetry.sendEventCallHistory.find(e => e.event.sfcaEvent === Constants.McpTelemetryEvents.ENGINE_SELECTION)).toBeUndefined();
    });
});
