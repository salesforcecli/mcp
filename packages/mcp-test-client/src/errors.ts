export class McpTestClientError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = "McpTestClientError";
  }
}

export class ConnectionError extends McpTestClientError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = "ConnectionError";
  }
}

export class TimeoutError extends McpTestClientError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = "TimeoutError";
  }
}

export class ToolCallError extends McpTestClientError {
  constructor(message: string, public toolName?: string, cause?: Error) {
    super(message, cause);
    this.name = "ToolCallError";
  }
}

export class ValidationError extends McpTestClientError {
  constructor(message: string, public validationErrors?: unknown[], cause?: Error) {
    super(message, cause);
    this.name = "ValidationError";
  }
}