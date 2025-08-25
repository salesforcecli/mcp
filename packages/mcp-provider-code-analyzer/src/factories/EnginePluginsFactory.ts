import { EnginePlugin } from "@salesforce/code-analyzer-engine-api";

// SFCA has other first-party engine plugins, but the MCP server will (initially) only support these ones, because they
// are static analysis engines instead of path-based ones, which means that they can function with a smaller number
// of files provided to the server, and will succeed fast enough that the LLM is unlikely to give up.
import * as ESLintEngineModule from '@salesforce/code-analyzer-eslint-engine';
import * as PmdCpdEnginesModule from '@salesforce/code-analyzer-pmd-engine';
import * as RetireJSEngineModule from '@salesforce/code-analyzer-retirejs-engine';
import * as RegexEngineModule from '@salesforce/code-analyzer-regex-engine';

export interface EnginePluginsFactory {
    create(): EnginePlugin[];
}

export class EnginePluginsFactoryImpl implements EnginePluginsFactory {
    public create(): EnginePlugin[] {
        return [
            ESLintEngineModule.createEnginePlugin(),
            PmdCpdEnginesModule.createEnginePlugin(),
            RetireJSEngineModule.createEnginePlugin(),
            RegexEngineModule.createEnginePlugin()
        ];
    }
}