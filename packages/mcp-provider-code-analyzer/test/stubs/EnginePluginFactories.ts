import {EnginePluginsFactory} from "../../src/factories/EnginePluginsFactory.js";
import * as EngineApi from "@salesforce/code-analyzer-engine-api";

export class FactoryWithThrowingPlugin1 implements EnginePluginsFactory {
    public create(): EngineApi.EnginePlugin[] {
        return [
            new ThrowingPlugin1()
        ];
    }
}

class ThrowingPlugin1 extends EngineApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        throw new Error('FakeErrorWithinGetAvailableEngineNames');
    }

    describeEngineConfig(_engineName: string): EngineApi.ConfigDescription {
        throw new Error('Should be uncallable');
    }

    createEngine(_engineName: string, _config: EngineApi.ConfigObject): Promise<EngineApi.Engine> {
        throw new Error('Should be uncallable');
    }
}

export class FactoryWithThrowingPlugin2 implements EnginePluginsFactory {
    public create(): EngineApi.EnginePlugin[] {
        return [
            new ThrowingPlugin2()
        ];
    }
}

class ThrowingPlugin2 extends EngineApi.EnginePluginV1 {
    private readonly createdEngines: Map<string, EngineApi.Engine> = new Map();

    getAvailableEngineNames(): string[] {
        return ['EngineThatCannotReturnRules'];
    }

    createEngine(engineName: string, config: EngineApi.ConfigObject): Promise<EngineApi.Engine> {
        if (engineName === 'EngineThatCannotReturnRules') {
            this.createdEngines.set(engineName, new EngineThatCannotReturnRules(config));
        } else {
            throw new Error(`Unsupported engine name ${engineName}`);
        }
        return Promise.resolve(this.getCreatedEngine(engineName));
    }

    getCreatedEngine(engineName: string): EngineApi.Engine {
        if (this.createdEngines.has(engineName)) {
            return this.createdEngines.get(engineName) as EngineApi.Engine;
        }
        throw new Error(`Engine with name ${engineName} has not yet been created`);
    }
}

class EngineThatCannotReturnRules extends EngineApi.Engine {

    public constructor(_config: EngineApi.ConfigObject) {
        super();
    }

    getName(): string {
        return 'EngineThatCannotReturnRules';
    }

    getEngineVersion(): Promise<string> {
        return Promise.resolve("1.0.0");
    }

    async describeRules(): Promise<EngineApi.RuleDescription[]> {
        throw new Error('ThisEngineCannotReturnRules');
    }

    async runRules(_ruleNames: string[], _runOptions: EngineApi.RunOptions): Promise<EngineApi.EngineRunResults> {
        throw new Error('This engine is impossible to run');
    }
}

export class FactoryForThrowingPlugin3 implements EnginePluginsFactory {
    public create(): EngineApi.EnginePlugin[] {
        return [
            new ThrowingPlugin3()
        ];
    }
}

class ThrowingPlugin3 extends EngineApi.EnginePluginV1 {
    private readonly createdEngines: Map<string, EngineApi.Engine> = new Map();

    getAvailableEngineNames(): string[] {
        return ['UnrunnableEngine'];
    }

    createEngine(engineName: string, config: EngineApi.ConfigObject): Promise<EngineApi.Engine> {
        if (engineName === 'UnrunnableEngine') {
            this.createdEngines.set(engineName, new UnrunnableEngine(config));
        } else {
            throw new Error(`Unsupported engine name: ${engineName}`);
        }
        return Promise.resolve(this.getCreatedEngine(engineName));
    }

    getCreatedEngine(engineName: string): EngineApi.Engine {
        if (this.createdEngines.has(engineName)) {
            return this.createdEngines.get(engineName) as EngineApi.Engine;
        }
        throw new Error(`Engine with name ${engineName} has not yet been created`);
    }
}

class UnrunnableEngine extends EngineApi.Engine {

    public constructor(_config: EngineApi.ConfigObject) {
        super();
    }

    getName(): string {
        return 'UnrunnableEngine';
    }

    getEngineVersion(): Promise<string> {
        return Promise.resolve("1.0.0");
    }

    async describeRules(): Promise<EngineApi.RuleDescription[]> {
        return [
            {
                name: "stub1RuleA",
                severityLevel: EngineApi.SeverityLevel.Low,
                tags: ["Recommended", "CodeStyle"],
                description: "Some description for stub1RuleA",
                resourceUrls: ["https://example.com/stub1RuleA"]
            }
        ]
    }

    async runRules(_ruleNames: string[], _runOptions: EngineApi.RunOptions): Promise<EngineApi.EngineRunResults> {
        throw new Error('This engine is impossible to run');
    }
}

export class FactoryWithErrorLoggingPlugin implements EnginePluginsFactory {
    public create(): EngineApi.EnginePlugin[] {
        return [
            new PluginForEngineThatLogsError()
        ];
    }
}

class PluginForEngineThatLogsError extends EngineApi.EnginePluginV1 {
    private readonly createdEngines: Map<string, EngineApi.Engine> = new Map();

    getAvailableEngineNames(): string[] {
        return ['EngineThatLogsError'];
    }

    createEngine(engineName: string, config: EngineApi.ConfigObject): Promise<EngineApi.Engine> {
        if (engineName === 'EngineThatLogsError') {
            this.createdEngines.set(engineName, new EngineThatLogsError(config));
        } else {
            throw new Error(`Unsupported engine name: ${engineName}`);
        }
        return Promise.resolve(this.getCreatedEngine(engineName));
    }

    getCreatedEngine(engineName: string): EngineApi.Engine {
        if (this.createdEngines.has(engineName)) {
            return this.createdEngines.get(engineName) as EngineApi.Engine;
        }
        throw new Error(`Engine with name ${engineName} has not yet been created`);
    }
}

class EngineThatLogsError extends EngineApi.Engine {

    public constructor(_config: EngineApi.ConfigObject) {
        super();
    }

    getName(): string {
        return 'EngineThatLogsError';
    }

    getEngineVersion(): Promise<string> {
        return Promise.resolve("1.0.0");
    }

    async describeRules(): Promise<EngineApi.RuleDescription[]> {
        return [
            {
                name: "stub1RuleA",
                severityLevel: EngineApi.SeverityLevel.Low,
                tags: ["Recommended", "CodeStyle"],
                description: "Some description for stub1RuleA",
                resourceUrls: ["https://example.com/stub1RuleA"]
            }
        ]
    }

    async runRules(ruleNames: string[], _runOptions: EngineApi.RunOptions): Promise<EngineApi.EngineRunResults> {
        this.emitLogEvent(EngineApi.LogLevel.Error, 'FakeErrorLog');

        return Promise.resolve({violations: []});
    }
}