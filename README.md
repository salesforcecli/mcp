# mcp

MCP Server for Interacting with Salesforce Orgs (Developer Preview)

[![NPM](https://img.shields.io/npm/v/@salesforce/mcp.svg?label=@salesforce/mcp)](https://www.npmjs.com/package/@salesforce/mcp) [![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/license/apache-2-0)

## Overview of the Salesforce MCP Server

The Salesforce MCP Server is a specialized Model Context Protocol (MCP) implementation designed to facilitate seamless interaction between large language models (LLMs) and Salesforce orgs. This MCP server provides a robust set of tools and capabilities that enable LLMs to read, manage, and operate Salesforce resources securely.

Key Features:

- Direct interaction with Salesforce orgs through LLM-driven tools.
- Secure access using TypeScript libraries (not shelling out to the `sf` Salesforce CLI).
- Improved security by avoiding the exposure of secrets in plain text.
- Granular access control with org allow-listing.
- Modular tool architecture for easy extensibility.

NOTE: The Salesforce MCP Server is available as a developer preview. The integration isn’t generally available unless or until Salesforce announces its general availability in documentation or in press releases or public statements. All commands, parameters, and other features are subject to change or deprecation at any time, with or without notice. Don't implement functionality developed with these commands or tools.

Note: The Salesforce MCP Server is currently in early development. As we continue to enhance and refine the implementation, the available functionality and tools may evolve. We welcome feedback and contributions to help shape the future of this project.

### Security Features

The Salesforce MCP Server was designed with security as a top priority.

- **Uses TypeScript libraries directly**

  - Greatly decreases the size of the MCP Server.
  - Significantly reduces the risk of remote code execution (RCE).

- **No secrets needed in configuration**

  - Eliminates the risk of plain text secret exposure.
  - Accesses pre-existing (encrypted) auth files on the user's machine.
  - Implements allowlisting for auth info key/values to prevent sensitive data exposure.

- **No secrets exposed via MCP tools**

  - Prevents other tools from accessing unencrypted tokens.
  - Tools pass usernames around instead of tokens.

- **Granular access control**

  - MCP Server can only access auth info for orgs that have been explicitly allowlisted.
  - Users specify allowed orgs when starting the server.

## Get Started Using VS Code as the Client

Want to jump in and see what all the fuss is about? Read on!

This example uses Visual Studio Code (VS Code) as the MCP client because it's a standard Salesforce DX development tool. After you configure VS Code with the Salesforce MCP server, you then use GitHub Copilot and natural language to easily execute typical Salesforce DX development tasks, such as listing your authorized orgs, viewing org records, and deploying or retrieving metadata.

But you're not limited to using only VS Code and Copilot! You can configure many other clients to use the Salesforce MCP server, such as Cursor, Claude Desktop, Zed, Windsurf, and more.

**Before You Begin**

For the best getting-started experience, make sure that you have a Salesforce DX environment set up on your computer. In particular:

- [Install VS Code](https://code.visualstudio.com/docs) on your computer.
- [Create a Salesforce DX project](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_create_new.htm) and open it in VS Code.
- [Authorize at least one Salesforce org](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_web_flow.htm) to use with your DX project.

**Let's Do It**

1. Edit the VS Code [settings.json](https://code.visualstudio.com/docs/configure/settings#_settings-file-locations) file and add this JSON snippet:

   ```json
   {
     "mcp": {
       "servers": {
         "salesforce": {
           "type": "stdio",
           "command": "npx",
           "args": ["-y", "@salesforce/mcp", "--orgs", "DEFAULT_TARGET_ORG", "--toolsets", "all"]
         }
       }
     }
   }
   ```

   The `--orgs` argument is required and specifies the authorized orgs you're allowing the MCP server to access. The `--toolsets` argument is optional and specifies the toolsets it should consult when determining the specific tool to run. See [Configure Orgs and Toolsets](README.md#configure-orgs-and-toolsets) for the available values for the two arguments.

   If you already have an `mcp:servers` section in your VS Code settings file, then add just the `salesforce` part, which adds the Salesforce MCP server. If you prefer to configure the MCP server for only your DX project, create a `.vscode/mcp.json` file at the root of the DX project with the same JSON snippet.

1. Open VS Code, go to **View -> Command Palette** and enter **MCP: List Servers**.

   TIP: You can also get to the command palette by pressing press Ctrl+Shift+P (Windows or Linux) or Command-Shift-P (macOS).

1. Click `salesforce`, then **Start Server**.

   Check the Output tab for the server status.

1. Run **Chat: Open Chat (Agent)** from the command palette to start a new GitHub Copilot chat session.

1. In the GitHub Copilot chat window, use natural language to explain what you want to do. The MCP server determines which configured tool to use, and then shows it to you along with other information. Click **Continue** to run the tool and see the results of your request. Try out these examples:

   - List all my orgs.
   - Which are my active scratch orgs?
   - Show me all the accounts in the org with alias my-org.
   - Deploy everything in my project to the org with alias my-org.

1. To manage the Salesforce MCP server, such as stopping or restarting it or viewing its configuration, run the **MCP: List Servers** command, click `salesforce`, then click the appropriate option.

## Configure Orgs and Toolsets

You configure the Salesforce MCP server by specifying at least one authorized org and an optional list of MCP toolsets.

### Configure Orgs

The Salesforce MCP tools require an org, and so you must include the required `--orgs` argument to specify at least one authorized org when you configure the MCP server. Separate multiple values with commas.

You must explicitly [authorize the orgs](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_web_flow.htm) on your computer before the MCP server can access them. Use the `org login web` Salesforce CLI command or the VS Code **SFDX: Authorize an Org** command from the command palette.

These are the available values for the `--orgs` argument:

- `DEFAULT_TARGET_ORG` - Allow access to your default org. If you've set a local default org in your DX project, the MCP server uses it. If not, the server uses a globally-set default org.
- `DEFAULT_TARGET_DEV_HUB` - Allow access to your default Dev Hub org. If you've set a local default Dev Hub org in your DX project, the MCP server uses it. If not, the server uses a globally-set default Dev Hub org.
- `ALLOW_ALL_ORGS` - Allow access to all authorized orgs. Use this value with caution.
- `<username or alias>` - Allow access to a specific org by specifying its username or alias.

This example shows how to specify that the MCP tools run against your default org when you configure the MCP server for VS Code:

```json
     "mcp": {
       "servers": {
         "salesforce": {
           "type": "stdio",
           "command": "npx",
           "args": ["-y", "@salesforce/mcp", "--orgs", "DEFAULT_TARGET_ORG"]
         }
       }
     }
```

This sample snippet shows how to configure access to your default Dev Hub org and an org with username `test-org@example.com`:

```json
           "args": ["-y", "@salesforce/mcp", "--orgs", "DEFAULT_TARGET_DEV_HUB,test-org@example.com"]
```

This sample snippet shows how to configure access to two orgs for which you specified aliases when you authorized them:

```json
           "args": ["-y", "@salesforce/mcp", "--orgs", "my-scratch-org,my-dev-hub"]
```

### Configure Toolsets

The Salesforce MCP Server supports **toolsets** - a way to selectively enable different groups of MCP tools based on your needs. This allows you to run the MCP server with only the tools you require, which in turn reduces the context.

Use the `--toolsets` (or short name `-t`) argument to specify the toolsets when you configure the Salesforce MCP server. Separate multiple toolsets with commas. The `--toolsets` argument is optional; if you don't specify it, the MCP server is configured with all toolsets.

These are the available toolsets:

- `all` (default) - Enables all available tools from all toolsets.
- `orgs` - [Tools to manage your authorized orgs.](README.md#orgs-toolset)
- `data` - [Tools to manage the data in your org, such as listing all accounts.](README.md#data-toolset)
- `users` - [Tools to manage org users, such as assigning a permission set.](README.md#users-toolset)
- `metadata` - [Tools to deploy and retrieve metadata to and from your org and your DX project.](README.md#metadata-toolset)

This example shows how to enable the `data`, `orgs`, and `metadata` toolsets when configuring the MCP server for VS Code:

```json
     "mcp": {
       "servers": {
         "salesforce": {
           "type": "stdio",
           "command": "npx",
           "args": ["-y", "@salesforce/mcp", "--orgs", "DEFAULT_TARGET_ORG", "--toolsets", "data,orgs,metadata"]
         }
       }
     }
```

#### Core Toolset (always enabled)

Includes this tool:

- `sf-get-username` - Determines the appropriate username or alias for Salesforce operations, handling both default orgs and Dev Hubs.

#### Orgs Toolset

Includes this tool:

- `sf-list-all-orgs` - Lists all configured Salesforce orgs, with optional connection status checking.

#### Data Toolset

Includes this tool:

- `sf-query-org` - Runs a SOQL query against a Salesforce org.

#### Users Toolset

Includes this tool:

- `sf-assign-permission-set` - Assigns a permission set to the user or on behalf of another user.

#### Metadata Toolset

Includes these tools:

- `sf-deploy-metadata` - Deploys metadata from your DX project to an org.
- `sf-retrieve-metadata` - Retrieves metadata from your org to your DX project.

## Configure Other Clients to Use the Salesforce MCP Server

**Cursor**

To configure [Cursor](https://www.cursor.com/) to work with Salesforce MCP server, add this snippet to your Cursor `mcp.json` file:

```json
{
  "mcpServers": {
    "salesforce": {
      "command": {
        "path": "npx",
        "args": ["-y", "@salesforce/mcp", "--orgs", "DEFAULT_TARGET_ORG", "--toolsets", "all"]
      }
    }
  }
}
```

**Cline**

To configure [Cline](https://cline.bot), add this snippet to your Cline `cline_mcp_settings.json` file:

```json
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": ["-y", "@salesforce/mcp", "--orgs", "DEFAULT_TARGET_ORG", "--toolsets", "all"]
    }
  }
}
```

**Other Clients**

For these other clients, refer to their documentation for adding MCP servers and follow the same pattern as in the preceding VS Code and Cursor JSON snippets:

- [Claude Desktop](https://claude.ai/download)
- [Zed](https://github.com/zed-industries/zed)
- [Windsurf](https://www.windsurf.com/)
- [Trae](https://trae.ai)

## Debugging

You can use the [MCP inspector](https://modelcontextprotocol.io/docs/tools/inspector) or the
[VS Code Run and Debug function](https://code.visualstudio.com/docs/debugtest/debugging#_start-a-debugging-session) to
run and debug the Salesforce MCP server.

1. Link the project as a global CLI using `npm link` from the project root.
2. Build with `npm run build` or watch for file changes and build automatically with `npm run build:watch`.

### Use the MCP Inspector

Use the MCP inspector with no breakpoints in the code:

```
# Breakpoints are not available
npx @modelcontextprotocol/inspector sf-mcp-server DEFAULT_TARGET_ORG
```

Alternatively, if you installed the package in a specific directory or are actively developing on the Salesforce MCP server:

```
cd /path/to/servers
npx @modelcontextprotocol/inspector dist/index.js DEFAULT_TARGET_ORG
```

### Use the VSCode Run and Debug Function

Use the VS Code [Run and Debug launcher](https://code.visualstudio.com/docs/debugtest/debugging#_start-a-debugging-session) with fully functional breakpoints in the code:

1. Locate and select the run debug.
2. Select the configuration labeled "`MCP Server Launcher`" in the dropdown.
3. Select the run/debug button.
