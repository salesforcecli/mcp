# mcp

MCP Server for interacting with Salesforce instances

[![NPM](https://img.shields.io/npm/v/@salesforce/mcp.svg?label=@salesforce/mcp)](https://www.npmjs.com/package/@salesforce/mcp) [![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/license/apache-2-0)

## Overview

The Salesforce MCP Server is a specialized Model Context Protocol (MCP) implementation designed to facilitate seamless interaction between large language models (LLMs) and Salesforce orgs. This server provides a robust set of tools and capabilities that enable LLMs to read, manage, and operate Salesforce resources securely.

Key Features:

- Direct interaction with Salesforce orgs through LLM-driven tools
- Secure access using TypeScript libraries (not shelling out to the `sf` CLI)
- Enhanced security through no plain text secret exposure
- Granular access control with org allowlisting
- Modular tool architecture for easy extensibility

Note: The Salesforce MCP Server is currently in early development. As we continue to enhance and refine the implementation, the available functionality and tools may evolve. We welcome feedback and contributions to help shape the future of this project.

## Security Features

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

## Starting the MCP Server

When starting the MCP server, you must specify which orgs the server is allowed to access:

```sh
sf-mcp-server [OPTIONS]
```

### OPTIONS:

- `DEFAULT_TARGET_ORG` - Allow access to default orgs (local then global)
- `DEFAULT_TARGET_DEV_HUB` - Allow access to default dev hubs (local then global)
- `ALLOW_ALL_ORGS` - Allow access to all authenticated orgs (use with caution)
- `<username or alias>` - Allow access to specific org by username or alias

### Examples:

```sh
sf-mcp-server DEFAULT_TARGET_ORG
sf-mcp-server DEFAULT_TARGET_DEV_HUB my-alias
sf-mcp-server test-org@example.com my-dev-hub-alias my-scratch-org-alias
```

## Configure the Salesforce MCP Server

You can configure Claude Desktop, Zed, Cursor, Windsurf and others to work with the Salesforce MCP Server.

### [Claude Desktop](https://claude.ai/download)

Add this snippet to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": ["-y", "@salesforce/mcp", "DEFAULT_TARGET_ORG"]
    }
  }
}
```

### [Zed](https://github.com/zed-industries/zed)

Add this snippet to your Zed `settings.json`:

```json
{
  "context_servers": {
    "salesforce": {
      "command": {
        "path": "npx",
        "args": ["-y", "@salesforce/mcp", "DEFAULT_TARGET_ORG"]
      }
    }
  }
}
```

### [Cursor](https://www.cursor.com/)

Add this snippet to your Cursor `mcp.json`:

```json
{
  "mcpServers": {
    "salesforce": {
      "command": {
        "path": "npx",
        "args": ["-y", "@salesforce/mcp", "DEFAULT_TARGET_ORG"]
      }
    }
  }
}
```

### [Windsurf](https://www.windsurf.com/)

Add this snippet to your Windsurf `mcp_config.json`:

```json
{
  "mcpServers": {
    "salesforce": {
      "command": {
        "path": "npx",
        "args": ["-y", "@salesforce/mcp", "DEFAULT_TARGET_ORG"]
      }
    }
  }
}
```

### [Cline](https://cline.bot)

Add this snippet to your Cline `config.json`:

```json
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": ["-y", "@salesforce/mcp", "DEFAULT_TARGET_ORG"]
    }
  }
}
```

### [VSCode](https://code.visualstudio.com/)

Add this snippet to your VSCode `settings.json` or `.vscode/mcp.json`:

```json
{
  "mcp": {
    "servers": {
      "salesforce": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@salesforce/mcp", "DEFAULT_TARGET_ORG"]
      }
    }
  }
}
```

### [Trae](https://trae.ai)

Add this snippet to your Trae `mcp_settings.json`:

```json
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": ["-y", "@salesforce/mcp", "DEFAULT_TARGET_ORG"]
    }
  }
}
```

## Available Tools

### Org Management

- `sf-list-all-orgs` - Lists all configured Salesforce orgs, with optional connection status checking.
- `sf-get-username` - Intelligently determines the appropriate username or alias for Salesforce operations, handling both default orgs and dev hubs.

### User Management

- `sf-assign-permission-set` - Assigns a permission set to the user or on behalf of another.

### Data Management

- `sf-query-org` - Runs a SOQL query against a Salesforce org.
- `sf-create-record` - Creates and inserts a record into a Salesforce or Tooling API object.

## Debugging

You can use the [MCP inspector](https://modelcontextprotocol.io/docs/tools/inspector) or the
[VS Code Run and Debug function](https://code.visualstudio.com/docs/debugtest/debugging#_start-a-debugging-session) to
run and debug the server.

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
