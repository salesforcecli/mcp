import path from "node:path";
import fs from "node:fs";
import { CodeAnalyzerConfig } from "@salesforce/code-analyzer-core";

export interface CodeAnalyzerConfigFactory {
    create(configPath?: string): CodeAnalyzerConfig;
}

export class CodeAnalyzerConfigFactoryImpl {
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

        // If no config path provided, use defaults (ignore any config files in current directory)
        return CodeAnalyzerConfig.withDefaults();
    }
}