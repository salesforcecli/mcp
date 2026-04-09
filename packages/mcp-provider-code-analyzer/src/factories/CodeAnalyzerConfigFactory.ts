import path from "node:path";
import fs from "node:fs";
import { CodeAnalyzerConfig } from "@salesforce/code-analyzer-core";

export interface CodeAnalyzerConfigFactory {
    create(configPath?: string, workingDirectory?: string): CodeAnalyzerConfig;
}

export class CodeAnalyzerConfigFactoryImpl {
    private static readonly CONFIG_FILE_NAME: string = "code-analyzer";
    private static readonly CONFIG_FILE_EXTENSIONS: string[] = ['yaml', 'yml'];

    public create(configPath?: string, workingDirectory?: string): CodeAnalyzerConfig {
        // Priority 1: If a config path is explicitly provided, use it
        if (configPath) {
            if (!path.isAbsolute(configPath)) {
                throw new Error(`Config path must be an absolute path: ${configPath}`);
            }
            if (!fs.existsSync(configPath)) {
                throw new Error(`Specified config file does not exist: ${configPath}`);
            }
            return CodeAnalyzerConfig.fromFile(configPath);
        }

        // Priority 2: If workingDirectory is provided, search for config files there
        if (workingDirectory) {
            if (!path.isAbsolute(workingDirectory)) {
                throw new Error(`Working directory must be an absolute path: ${workingDirectory}`);
            }
            if (!fs.existsSync(workingDirectory)) {
                throw new Error(`Working directory does not exist: ${workingDirectory}`);
            }
            if (!fs.statSync(workingDirectory).isDirectory()) {
                throw new Error(`Working directory must be a directory, not a file: ${workingDirectory}`);
            }
            const configFromWorkingDir = this.seekConfigInDirectory(workingDirectory);
            if (configFromWorkingDir) {
                return configFromWorkingDir;
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