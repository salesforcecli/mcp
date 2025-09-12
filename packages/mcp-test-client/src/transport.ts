import {
  StdioClientTransport,
} from '@modelcontextprotocol/sdk/client/stdio.js';

type DxMcpTransportOptions = {
  command?: string;
  args?: string[];
  orgUsername?: string;
};

export function DxMcpTransport(
  options: DxMcpTransportOptions,
): StdioClientTransport {
  // 1. custom command passed in test
  // 2. path to mcp bin via SF_MCP_SERVER_BIN env var
  // 3. use the `sf-mcp-server` bin available in $PATH
  const command = options.command ?? process.env.SF_MCP_SERVER_BIN ?? 'sf-mcp-server'

  return new StdioClientTransport({
    command,
    args: options.args ?? ['--orgs', options.orgUsername ?? 'DEFAULT_TARGET_ORG', '--no-telemetry'],
    // this is needed because testkit sets it when transferring the hub auth and creating a scratch.
    // Without it you get a keychain error/silent failure because the server will look for orgUsername
    // in the OS keychain but testkit modifies the home dir in the process so all auth is in the test dir.
    env: {
      SF_USE_GENERIC_UNIX_KEYCHAIN: 'true'
    }
  });
}
