# mcp

MCP Server for Interacting with Salesforce Orgs

[![NPM](https://img.shields.io/npm/v/@salesforce/mcp.svg?label=@salesforce/mcp)](https://www.npmjs.com/package/@salesforce/mcp) [![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/license/apache-2-0)

## Overview of the Salesforce DX MCP Server (Developer Preview)

The Salesforce DX MCP Server is a specialized Model Context Protocol (MCP) implementation designed to facilitate seamless interaction between large language models (LLMs) and Salesforce orgs. This MCP server provides a robust set of tools and capabilities that enable LLMs to read, manage, and operate Salesforce resources securely.

Key Features:

- Direct interaction with Salesforce orgs through LLM-driven tools.
- Secure access using TypeScript libraries (not shelling out to the `sf` Salesforce CLI).
- Improved security by avoiding the exposure of secrets in plain text.
- Granular access control with org allowlisting.
- Modular tool architecture for easy extensibility.

**NOTE**: The Salesforce DX MCP Server is available as a developer preview. The feature isn’t generally available unless or until Salesforce announces its general availability in documentation or in press releases or public statements. All commands, parameters, and other features are subject to change or deprecation at any time, with or without notice. Don't implement functionality developed with these commands or tools. As we continue to enhance and refine the implementation, the available functionality and tools may evolve. We welcome feedback and contributions to help shape the future of this project.

### Security Features

The Salesforce DX MCP Server was designed with security as a top priority.

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

  - MCP Server can access auth info for only orgs that have been explicitly allowlisted.
  - Users specify allowed orgs when starting the server.

## Get Started Using VS Code as the Client

Want to jump in and see what all the fuss is about? Read on!

This example uses Visual Studio Code (VS Code) as the MCP client because it's a standard Salesforce DX development tool. After you configure it with the Salesforce DX MCP Server, you then use GitHub Copilot and natural language to easily execute typical Salesforce DX development tasks, such as listing your authorized orgs, viewing org records, and deploying or retrieving metadata.

But you're not limited to using only VS Code and Copilot! You can [configure many other clients](README.md#configure-other-clients-to-use-the-salesforce-mcp-server) to use the Salesforce DX MCP Server, such as Cursor, Cline, Claude Desktop, Zed, Windsurf, and more.

**Before You Begin**

For the best getting-started experience, make sure that you have a Salesforce DX environment set up on your computer. In particular:

- [Install VS Code](https://code.visualstudio.com/docs) on your computer.
- [Create a Salesforce DX project](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_create_new.htm) and open it in VS Code. You can also clone an example repo, such as [dreamhouse-lwc](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_intro_sample_repo.htm), which is a ready-to-use DX project that contains a simple Salesforce application, with metadata and test data.
- [Authorize at least one Salesforce org](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_web_flow.htm) to use with your DX project. You can also create a scratch org.

**Let's Do It**

1. Create a `.vscode/mcp.json` file at the root of your DX project and add this JSON:

   ```json
   {
     "servers": {
       "salesforce": {
         "type": "stdio",
         "command": "npx",
         "args": ["-y", "@salesforce/mcp", "--orgs", "DEFAULT_TARGET_ORG", "--toolsets", "all"]
       }
     }
   }
   ```

   You can also configure the MCP server globally by editing the VS Code [settings.json](https://code.visualstudio.com/docs/configure/settings#_settings-file-locations) file and adding a similar JSON snippet but contained in an `mcp:servers` section.

   The `--orgs` argument is required and specifies the authorized orgs you're allowing the MCP server to access. The `--toolsets` argument is optional and specifies the toolsets it should consult when determining the specific tool to run. See [Configure Orgs and Toolsets](README.md#configure-orgs-and-toolsets) for the available values for the two arguments.

1. Open VS Code, go to **View -> Command Palette** and enter **MCP: List Servers**.

   TIP: You can also get to the command palette by pressing press Ctrl+Shift+P (Windows or Linux) or Command-Shift-P (macOS).

1. Click `salesforce`, then **Start Server**.

   Check the Output tab for the server status.

1. Run **Chat: Open Chat (Agent)** from the command palette to start a new GitHub Copilot chat session.

   Be sure your Copilot chat window is in `Agent` mode; if you're in `Ask` or `Edit` mode, use the [little drop-down](https://github.blog/ai-and-ml/github-copilot/copilot-ask-edit-and-agent-modes-what-they-do-and-when-to-use-them/) to switch.

1. In the GitHub Copilot chat window, use natural language to explain what you want to do. The MCP server determines which configured tool to use, and then shows it to you along with other information. Click **Continue** to run the tool and see the results of your request.

   Try out these examples:

   - List all my orgs.
   - Which are my active scratch orgs?
   - Show me all the accounts in the org with alias my-org.
   - Deploy everything in my project to the org with alias my-org.

1. To stop, restart, or view the MCP server configuration, run the **MCP: List Servers** command, click `salesforce`, then click the appropriate option.

## Configure Orgs and Toolsets

You configure the Salesforce DX MCP Server by specifying at least one authorized org and an optional list of MCP toolsets.

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

The Salesforce DX MCP Server supports **toolsets** - a way to selectively enable different groups of MCP tools based on your needs. This allows you to run the MCP server with only the tools you require, which in turn reduces the context.

Use the `--toolsets` (or short name `-t`) argument to specify the toolsets when you configure the Salesforce DX MCP Server. Separate multiple toolsets with commas. The `--toolsets` argument is optional; if you don't specify it, the MCP server is configured with all toolsets.

These are the available toolsets:

- `all` (default) - Enables all available tools from all toolsets.
- `orgs` - [Tools to manage your authorized orgs.](README.md#orgs-toolset)
- `data` - [Tools to manage the data in your org, such as listing all accounts.](README.md#data-toolset)
- `users` - [Tools to manage org users, such as assigning a permission set.](README.md#users-toolset)
- `metadata` - [Tools to deploy and retrieve metadata to and from your org and your DX project.](README.md#metadata-toolset)
- `testing` - [Tools to test your code and features](README.md#testing-toolset)

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

#### Dynamic Tools (Experimental)

The `--dynamic-tools` flag enables dynamic tool discovery and loading. When this flag is set, the MCP server starts with a minimal set of core tools and will load new tools as the need arises. This is useful for reducing initial context size and improving LLM performance.

**NOTE:** This feature works in VSCode and Cline but may not work in other environments.

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
-

#### Testing Toolset

Includes these tools:

- `sf-test-agents` - Executes agent tests in your org.
- `sf-test-apex` - Executes apex tests in your org

## Configure Other Clients to Use the Salesforce DX MCP Server

**Cursor**

To configure [Cursor](https://www.cursor.com/) to work with Salesforce DX MCP Server, add this snippet to your Cursor `mcp.json` file:

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
