import {
  StdioClientTransport,
} from '@modelcontextprotocol/sdk/client/stdio.js';

type DxMcpTransportOptions = {
  command?: string;
  args?: string[];
  orgUsername?: string;
};

/**
 * Transport helper for the Salesforce DX MCP server.
 *
 * If passing custom args, remember to always pass `--no-telemetry`, we don't want test runs to be captured.
 *
 * @param {DxMcpTransportOptions} options - Configuration options for the transport.
 * 
 * Inside this monorepo, `sf-mcp-server` is available in $PATH (when started from a yarn/npm script) and points to the `packages/mcp/bin/run.js` bin.
 * Use `SF_MCP_SERVER_BIN` to specify a custom bin path (run tests with an npm-installed server version).
 *
 * @param {string} [options.command] - Custom command to execute. Defaults to the value of the `SF_MCP_SERVER_BIN` environment variable or 'sf-mcp-server'.
 * @param {string[]} [options.args] - Arguments to pass to the command. Defaults to `['--orgs', options.orgUsername ?? 'DEFAULT_TARGET_ORG', '--no-telemetry']`.
 * @param {string} [options.orgUsername] - The organization username. Used to avoid keychain errors in testing environments.
 * @returns {StdioClientTransport} An instance of StdioClientTransport configured with the specified options.
 */
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
