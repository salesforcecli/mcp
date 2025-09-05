import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

export interface StdioTransportOptions {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface SSETransportOptions {
  url: string;
  headers?: Record<string, string>;
}

export class TransportFactory {
  static createStdio(options: StdioTransportOptions): Transport {
    return new StdioClientTransport({
      command: options.command,
      args: options.args,
      env: options.env
    });
  }

  static createSSE(options: SSETransportOptions): Transport {
    return new SSEClientTransport(new URL(options.url), {
      requestInit: {
        headers: options.headers
      }
    });
  }
}

export { StdioClientTransport, SSEClientTransport };
