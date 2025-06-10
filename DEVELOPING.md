# Developing

Use this guide to learn how to contribute to the Salesforce DX MCP Server.

## Table of Contents

[One-Time Setup](#one-time-setup)</br>
[Quick Start](#quick-start)</br>
[Testing](#testing)</br>
[Useful Yarn Commands](#useful-yarn-commands)</br>

<hr>

## One-Time Setup

1. Install Node.js. If you need to work with multiple versions of Node, consider using [nvm](https://github.com/nvm-sh/nvm).
   - _Suggestion:_ Use the current [LTS version of Node.js](https://github.com/nodejs/release#release-schedule).
1. Install [yarn v1](https://yarnpkg.com/) to manage Node.js dependencies.
   - _Suggestion:_ Install `yarn` globally using this command: `npm install --global yarn`.
1. If you're an external contributor, fork the `main` branch of this [Salesforce DX MCP Server repo](https://github.com/salesforcecli/mcp).
1. Clone this repository from GitHub.
   - Example (ssh): `git clone git@github.com:salesforcecli/mcp.git`
1. Configure [git commit signing](https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits).

## Quick Start

1. Open a terminal or command window and change to the `mcp` directory (`cd mcp`).
1. Check out the `main` branch: `git checkout main`.
1. Get all the latest changes: `git pull`.
1. Download the NPM dependencies: `yarn install`.
   - _Suggestion:_ If it's been a while since you last ran the command, consider running `yarn clean-all` before you run `yarn install`.
1. Build and lint the code: `yarn build`.
1. Create a branch off of `main` for your new work: `git checkout -b <branch_name>`.
   - _Suggestion:_ Name your branch using this format: `<initials>/<work-title>`.  Example: `mb/refactor-tests`
1. Make your code changes and then build: `yarn build`.
1. Update your MCP client to launch your local build using `node` instead of the published npm package using `npx`. For example, if you're using VS Code, update your MCP configuration file like this (change `/full/path/to` to the full location where you cloned the `mcp` repo):

    ```json
    {
      "servers": {
        "salesforce": {
          "command": "node",
          "args": ["/full/path/to/mcp/bin/run.js", "--toolsets", "all", "--orgs", "ALLOW_ALL_ORGS"]
        }
      }
    }
    ```
1. Start the Salesforce DX MCP server and call the tools using natural language prompts.  See [./README.md] for details.
1. Write tests and run them: `yarn test`. See [Unit Tests](#unit-tests) for details.
1. See all changed files and verify that you want to commit them: `git status`.
1. Add all files to staging: `git add .`  (Make sure you include the period!)
1. Commit staged files with a helpful commit message that adheres to the [conventional commits specification](https://www.conventionalcommits.org/en/v1.0.0/): `git commit -m "feat: add new tool"`.
1. Push commit(s) to remote: `git push -u origin <branch_name>`.
1. Create a pull request (PR) using the [GitHub UI](https://github.com/salesforcecli/mcp).

## Testing

All changes must have associated unit tests when possible. End-to-end tests for tools will be added in the future.

For manual tool testing, use the MCP inspector to make tool calls directly from your browser or terminal. This type of testing is handy when you start working on a new tool and you want to focus on the tool logic first before optimizing the agent instructions.

First install the MCP inspector CLI:

```
npm i -g @modelcontextprotocol/inspector
```

Then follow the steps for the type of testing you want to do: from the browser or from a terminal. 

### Browser

1. Build the local server: `yarn build`.
2. Start the MCP inspector server: `mcp-inspector node lib/index.js --orgs DEFAULT_TARGET_ORG`.
3. If successful, open the specified localhost URL in your browser. In this example it's `http://127.0.0.1:6274`:

    ```
    MCP Inspector is up and running at http://127.0.0.1:6274
    ```

4. Click the `Connect` button; you should see this message in the bottom-left panel:

    ```
    ✅ Salesforce MCP Server running on stdio
    ```

5. Click `List Tools`, then select one of the tools, fill the required parameters, and click `Run Tool`.

### Terminal

1. Build the local server: `yarn build`.
2. Use the MCP inspector CLI to call a specific tool with its parameters.

This example calls the `sf-query-org` tool from the context of a Salesforce DX project:

```shell
mcp-inspector --cli node bin/run.js --orgs DEFAULT_TARGET_ORG \
  --method tools/call \
  --tool-name sf-query-org \
  --tool-arg query="select id from account limit 5" \
  --tool-arg usernameOrAlias=dreamhouse \
  --tool-arg directory="/path/to/sfdx-project"

{
  "content": [
    {
      "type": "text",
      "text": "SOQL query results for dreamhouse:\n\n{\n  \"records\": [\n    {\n      \"attributes\": {\n        \"type\": \"Account\",\n        \"url\": \"/services/d
ata/v63.0/sobjects/Account/001DK00001BFbHbYAL\"\n      },\n      \"Id\": \"001DK00001BFbHbYAL\"\n    }\n  ],\n  \"totalSize\": 1,\n  \"done\": true\n}"
    }
  ],
  "isError": false
}
```

Learn more about each tool argument by looking at its definition in the code, the MCP inspector browser UI, or by listing all tools using the MCP inspector CLI. For example:

```shell
mcp-inspector --cli node bin/run.js --orgs DEFAULT_TARGET_ORG --method tools/list
```

### Unit Tests

Unit tests are run with `yarn test` and use the Mocha test framework. Tests are located in the `test` directory and are named with the pattern, `test/**/*.test.ts`.

## Useful yarn Commands

#### `yarn install`

Downloads all NPM dependencies into the `node_modules` directory.

#### `yarn compile`

Compiles the TypeScript code to JavaScript.

#### `yarn compile --watch`

Watches for file changes and compiles the TypeScript code to JavaScript.

#### `yarn lint`

Lints all the TypeScript code using ESLint.

#### `yarn build`

Compiles and lints all the TypeScript code. (Basically the same as `yarn compile && yarn lint`).

#### `yarn clean`

Cleans all generated files and directories. Run `yarn clean-all` to also clean up the `node_modules` directories.

#### `yarn test`

Runs unit tests (Mocha) for the project using `ts-node`.
