import { CodeAnalyzer, EngineLogEvent, EventType, LogEvent, LogLevel } from "@salesforce/code-analyzer-core";

import { getMessage } from "../messages.js";

export class ErrorCapturer {
    private readonly capturedEvents: string[] = [];

    public listen(codeAnalyzer: CodeAnalyzer): void {
        codeAnalyzer.onEvent(EventType.LogEvent, (e: LogEvent) => this.captureEvent('Core', e));
        codeAnalyzer.onEvent(EventType.EngineLogEvent, (e: EngineLogEvent) => this.captureEvent(e.engineName, e));
    }

    private captureEvent(source: string, event: LogEvent|EngineLogEvent): void {
        if (event.logLevel > LogLevel.Error) {
            return;
        }

        const formattedMessage: string = getMessage('errorLogWrapper', source, event.message);

        this.capturedEvents.push(formattedMessage);
    }

    public getCapturedEvents(): string[] {
        return this.capturedEvents;
    }
}