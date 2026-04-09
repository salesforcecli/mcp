import path from "node:path";
import fs from "node:fs";
import { CodeAnalyzerConfig } from "@salesforce/code-analyzer-core";

export interface CodeAnalyzerConfigFactory {
    create(configPath?: string): CodeAnalyzerConfig;
}

export class CodeAnalyzerConfigFactoryImpl {
    private static readonly CONFIG_FILE_NAME: string = "code-analyzer";
    private static readonly CONFIG_FILE_EXTENSIONS: string[] = ['yaml', 'yml'];

    public create(configPath?: string): CodeAnalyzerConfig {
        // If a config path is explicitly provided, use it
        if (configPath) {
            if (!path.isAbsolute(configPath)) {
                throw new Error(`Config path must be an absolute path: ${configPath}`);
            }
            if (!fs.existsSync(configPath)) {
                throw new Error(`Specified config file does not exist: ${configPath}`);
            }
            return CodeAnalyzerConfig.fromFile(configPath);
        }

        // Otherwise, seek config in current directory
        return this.seekConfigInCurrentDirectory() ?? CodeAnalyzerConfig.withDefaults();
    }

    private seekConfigInCurrentDirectory(): CodeAnalyzerConfig | undefined {
        for (const ext of CodeAnalyzerConfigFactoryImpl.CONFIG_FILE_EXTENSIONS) {
            const possibleConfigFilePath: string = path.resolve(`${CodeAnalyzerConfigFactoryImpl.CONFIG_FILE_NAME}.${ext}`);
            if (fs.existsSync(possibleConfigFilePath)) {
                return CodeAnalyzerConfig.fromFile(possibleConfigFilePath);
            }
        }
        return undefined;
    }
}