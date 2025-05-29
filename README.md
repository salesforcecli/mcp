# mcp

MCP Server for interacting with Salesforce orgs

[![NPM](https://img.shields.io/npm/v/@salesforce/mcp.svg?label=@salesforce/mcp)](https://www.npmjs.com/package/@salesforce/mcp) [![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/license/apache-2-0)

## Overview of the Salesforce MCP Server

The Salesforce MCP Server is a specialized Model Context Protocol (MCP) implementation designed to facilitate seamless interaction between large language models (LLMs) and Salesforce orgs. This MCP server provides a robust set of tools and capabilities that enable LLMs to read, manage, and operate Salesforce resources securely.

Key Features:

- Direct interaction with Salesforce orgs through LLM-driven tools.
- Secure access using TypeScript libraries (not shelling out to the `sf` Salesforce CLI).
- Improved security by avoiding the exposure of secrets in plain text.
- Granular access control with org allow-listing.
- Modular tool architecture for easy extensibility.

Note: The Salesforce MCP Server is currently in early development. As we continue to enhance and refine the implementation, the available functionality and tools may evolve. We welcome feedback and contributions to help shape the future of this project.

### Security Features: More Details

The Salesforce MCP Server was designed with security as a top priority:

- **Uses TypeScript libraries directly**

  - Greatly decreases the size of the MCP Server
  - Significantly reduces the risk of remote code execution (RCE)

- **No secrets needed in configuration**

  - Eliminates the risk of plain text secret exposure
  - Accesses pre-existing (encrypted) auth files on the user's machine
  - Implements allowlisting for auth info key/values to prevent sensitive data exposure

- **No secrets exposed via MCP tools**

  - Prevents other tools from accessing unencrypted tokens
  - Tools pass usernames around instead of tokens

- **Granular access control**
  - MCP Server can only access auth info for orgs that have been explicitly allowlisted
  - Users specify allowed orgs when starting the server

## Get Started Using VS Code

Want to jump right in and see what all the fuss is about? Read on!

Let's use Visual Studio Code (VS Code) as our sample MCP client because it's a standard Salesforce DX development tool. After you configure VS Code with the Salesforce MCP server, you then use GitHub Copilot and natural language to easily execute typical Salesforce DX development tasks, such as listing your authorized orgs, viewing org records, and deploying or retrieving metadata. But you're not limited to using only VS Code and Copilot. You can configure many other clients to use the Salesforce MCP server, such as Cursor, Claude Desktop, Zed, Windsurf, and more.

**Prerequisites**

Make sure that you already have a Salesforce DX environment set up on your computer, in particular that you:

- [Installed VS Code](https://code.visualstudio.com/docs) on your computer.
- [Created a Salesforce DX project](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_create_new.htm) and opened it in VS Code.
- [Authorized at least one Salesforce org](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_web_flow.htm) to use with your DX project.

1. Edit the [settings.json](https://code.visualstudio.com/docs/configure/settings#_settings-file-locations) settings file and add this JSON snippet:

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

   The `--orgs` argument is required and specifies the authorized orgs you're allowing the MCP server to access. The `--toolsets` argument is optional and specifies the toolsets it should use when determining the specific tool to use. See [Configure Orgs and Toolsets](README.md#configure-orgs-and-toolsets} for the available values for the two arguments.

   If you already have an `mcp:servers` section in your VS Code settings file, then just add the `salesforce` part, which adds the Salesforce MCP server. If you prefer to configure the MCP server for only your DX project, create a `.vscode/mcp.json` file at the root of the DX project with the same JSON snippet.

1. Open VS Code, go to **View -> Command Palette** and enter **MCP: List Servers**. You can also get to the command palette by pressing press Ctrl+Shift+P (Windows or Linux) or Command-Shift-P (macOS).
1. Click `salesforce`, then **Start Server**.

   Check the Output tab for the server status. Use the same **MCP: List Servers** command to stop or restart a running MCP server and view the Salesforce MCP server configuration.

1. Run **Chat: Open Chat (Agent)** from the command palette to start a new GitHub Copilot chat session.

1. In the GitHub Copilot chat window, use natural language to say what you want to do, and then the MCP server determines which configured tool to use. The MCP server usually shows the tool it plans to run along with other information; click **Continue** to see the results of your request. Here are some examples to get you started:

   - List all my orgs.
   - Which are my active scratch orgs?
   - Show me all the accounts in the org with alias my-org.
   - Add a new account with the name "Exciting Account". Then list all the accounts.
   - Deploy everything in my project to the org with alias my-org.

## Configure Orgs and Toolsets

### Orgs

#### OPTIONS:

- `DEFAULT_TARGET_ORG` - Allow access to default orgs (local then global)
- `DEFAULT_TARGET_DEV_HUB` - Allow access to default dev hubs (local then global)
- `ALLOW_ALL_ORGS` - Allow access to all authenticated orgs (use with caution)
- `<username or alias>` - Allow access to specific org by username or alias

#### Examples:

```sh
sf-mcp-server DEFAULT_TARGET_ORG
sf-mcp-server DEFAULT_TARGET_DEV_HUB my-alias
sf-mcp-server test-org@example.com my-dev-hub-alias my-scratch-org-alias
```

### Toolsets

The Salesforce MCP Server supports **toolsets** - a way to selectively enable different groups of tools based on your needs. This allows you to run the MCP server with only the tools you require, which in turn reduces the context.

Use the `--toolsets` (or short name `-t`) argument to specify a toolset when you configure the Salesforce MCP server. These are the available toolsets:

- `all` (default) - Enables all available tools from all toolsets.
- `orgs` - [Tools to manage your authorized orgs.](README.md#orgs-toolset)
- `data` - [Tools to manage the data in your org, such as listing all accounts or creating a new opportunity.](README.md#data-toolset)
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

Includes these tools:

- `sf-query-org` - Runs a SOQL query against a Salesforce org.
- `sf-create-record` - Creates and inserts a record into a Salesforce or Tooling API object.

#### Users Toolset

Includes this tool:

- `sf-assign-permission-set` - Assigns a permission set to the user or on behalf of another user.

#### Metadata Toolset

Includes these tools:

- `sf-deploy-metadata` - Deploys metadata from your DX project to an org.
- `sf-retrieve-metadata` - Retrieves metadata from your org to your DX project.

## Configure Other Clients to Use the Salesforce MCP Server

To configure Cursor](https://www.cursor.com/) to work with Salesforce MCP server, add this snippet to your Cursor `mcp.json` file:

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

For these clients, refer to their documentation for adding MCP servers and follow the same pattern as the preceding examples:

- [Claude Desktop](https://claude.ai/download)
- [Zed](https://github.com/zed-industries/zed)
- [Windsurf](https://www.windsurf.com/)
- [Cline](https://cline.bot)
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
