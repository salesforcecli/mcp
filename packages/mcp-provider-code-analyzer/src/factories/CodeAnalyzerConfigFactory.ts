import path from "node:path";
import fs from "node:fs";
import { CodeAnalyzerConfig } from "@salesforce/code-analyzer-core";

export interface CodeAnalyzerConfigFactory {
    create(): CodeAnalyzerConfig;
}

export class CodeAnalyzerConfigFactoryImpl {
    private static readonly CONFIG_FILE_NAME: string = "code-analyzer";
    private static readonly CONFIG_FILE_EXTENSIONS: string[] = ['yaml', 'yml'];

    public create(): CodeAnalyzerConfig {
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