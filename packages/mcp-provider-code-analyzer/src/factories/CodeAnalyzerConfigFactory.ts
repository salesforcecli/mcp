import path from "node:path";
import fs from "node:fs";
import { CodeAnalyzerConfig } from "@salesforce/code-analyzer-core";
import { sanitizePath } from "../utils.js";

export interface CodeAnalyzerConfigFactory {
    create(configPath?: string, directory?: string): CodeAnalyzerConfig;
}

export class CodeAnalyzerConfigFactoryImpl {
    private static readonly CONFIG_FILE_NAME: string = "code-analyzer";
    private static readonly CONFIG_FILE_EXTENSIONS: string[] = ['yaml', 'yml'];

    public create(configPath?: string, directory?: string): CodeAnalyzerConfig {
        // Priority 1: If a config path is explicitly provided, use it
        if (configPath) {
            if (!sanitizePath(configPath)) {
                throw new Error(`Invalid config path: ${configPath}. Path must be absolute and not contain traversal sequences.`);
            }
            if (!fs.existsSync(configPath)) {
                throw new Error(`Specified config file does not exist: ${configPath}`);
            }
            return CodeAnalyzerConfig.fromFile(configPath);
        }

        // Priority 2: If directory is provided, search for config files there
        if (directory) {
            if (!sanitizePath(directory)) {
                throw new Error(`Invalid directory path: ${directory}. Path must be absolute and not contain traversal sequences.`);
            }
            if (!fs.existsSync(directory)) {
                throw new Error(`Directory does not exist: ${directory}`);
            }
            if (!fs.statSync(directory).isDirectory()) {
                throw new Error(`Directory must be a directory, not a file: ${directory}`);
            }
            const configFromDirectory = this.seekConfigInDirectory(directory);
            if (configFromDirectory) {
                return configFromDirectory;
            }
        }

        // Priority 3: Use defaults
        return CodeAnalyzerConfig.withDefaults();
    }

    private seekConfigInDirectory(directory: string): CodeAnalyzerConfig | undefined {
        for (const ext of CodeAnalyzerConfigFactoryImpl.CONFIG_FILE_EXTENSIONS) {
            const possibleConfigFilePath: string = path.join(directory, `${CodeAnalyzerConfigFactoryImpl.CONFIG_FILE_NAME}.${ext}`);
            if (fs.existsSync(possibleConfigFilePath)) {
                return CodeAnalyzerConfig.fromFile(possibleConfigFilePath);
            }
        }
        return undefined;
    }
}