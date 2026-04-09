import path from "node:path";
import { fileURLToPath } from "url";
import { CodeAnalyzerConfigFactoryImpl } from "../../src/factories/CodeAnalyzerConfigFactory.js";
import { CodeAnalyzerConfig } from "@salesforce/code-analyzer-core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PATH_TO_WORKSPACE_WITH_CONFIG = path.resolve(__dirname, '..', 'fixtures', 'sample-workspaces', 'workspace-with-config');
const PATH_TO_CONFIG_FILE = path.join(PATH_TO_WORKSPACE_WITH_CONFIG, 'code-analyzer.yml');

describe("CodeAnalyzerConfigFactoryImpl", () => {
    let factory: CodeAnalyzerConfigFactoryImpl;

    beforeEach(() => {
        factory = new CodeAnalyzerConfigFactoryImpl();
    });

    describe("create with no configPath", () => {
        it("When no config file exists in current directory, then returns default config", () => {
            const config: CodeAnalyzerConfig = factory.create();
            expect(config).toBeDefined();
            expect(config.getLogFolder()).toBeDefined();
        });
    });

    describe("create with configPath", () => {
        it("When valid config path is provided, then loads config from that path", () => {
            const config: CodeAnalyzerConfig = factory.create(PATH_TO_CONFIG_FILE);
            expect(config).toBeDefined();

            // Verify the config was loaded from the specified file
            // The test config file has a custom rule override with severity 1
            const ruleOverride = config.getRuleOverrideFor('pmd', 'WhileLoopsMustUseBraces');
            expect(ruleOverride.severity).toBe(1);
            expect(ruleOverride.tags).toContain('MyCustomTag');
        });

        it("When config path does not exist, then throws error", () => {
            const nonExistentPath = path.join(__dirname, 'does-not-exist.yml');
            expect(() => factory.create(nonExistentPath)).toThrow('Specified config file does not exist');
        });

        it("When config path is relative, then throws error", () => {
            const relativePath = './code-analyzer.yml';
            expect(() => factory.create(relativePath)).toThrow('Config path must be an absolute path');
        });
    });
});
