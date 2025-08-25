import {CodeAnalyzerConfigFactory} from "../../src/factories/CodeAnalyzerConfigFactory.js";
import {CodeAnalyzerConfig} from "@salesforce/code-analyzer-core";

export class CustomizableConfigFactory implements CodeAnalyzerConfigFactory {
    private readonly configString: string;

    public constructor(configString: string) {
        this.configString = configString;
    }

    public create(): CodeAnalyzerConfig {
        return CodeAnalyzerConfig.fromJsonString(this.configString);
    }
}