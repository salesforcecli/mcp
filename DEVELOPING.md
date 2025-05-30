# Developing

## Table of Contents

[One-time Setup](#one-time-setup)</br>
[Quick Start](#quick-start)</br>
[Testing](#testing)</br>
[Debugging](#debugging)</br>
[Running Commands](#running-commands)</br>
[Useful Yarn Commands](#useful-yarn-commands)</br>

<hr>

## One-time Setup

1. Install NodeJS. If you need to work with multiple versions of Node, consider using [nvm](https://github.com/nvm-sh/nvm).
   - _Suggestion:_ Use the current [LTS version of node](https://github.com/nodejs/release#release-schedule).
1. Install [yarn v1](https://yarnpkg.com/) to manage node dependencies.
   - _Suggestion:_ install `yarn` globally using `npm install --global yarn`
1. For external contributors, fork the `main` branch of the [repo](https://github.com/salesforcecli/mcp)
1. Clone this repository from git.
   - Example (ssh): `git clone git@github.com:salesforcecli/mcp.git`
1. Configure [git commit signing](https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits).

## Quick Start

1. `cd` into the `mcp` directory
1. Checkout the `main` branch: `git checkout main`
1. Get all latest changes: `git pull`
1. Download NPM dependencies: `yarn install`.
   - If it's been a while since you last did this you may want to run `yarn clean-all` before this step.
1. Build and lint the code: `yarn build`
1. Create a branch off `main` for new work: `git checkout -b <branch_name>`
   - _Suggestion:_ Use branch name format of `<initials>/<work-title>`.
     - Example: `mb/refactor-tests`
1. Make code changes and build: `yarn build`
1. Update your MCP client to launch the local build with node instead of the npm package via npx, example with vscode MCP config file:
```json
{
  "servers": {
    "salesforce": {
      "command": "node",
      "args": ["/full/path/to/mcp/lib/index.js", "--toolsets", "all", "--orgs", "ALLOW_ALL_ORGS"]
    }
  }
}
```
1. Start the MCP server and call the tools via prompts
1. Write tests and run: `yarn test` ([unit](#unit-tests))
1. Show all changed files: `git status`
1. Add all files to staging: `git add .`
1. Commit staged files with helpful commit message: `git commit`
   - TODO
1. Push commit(s) to remote: `git push -u origin <branch_name>`
1. Create a pull request (PR) using the GitHub UI [here](https://github.com/salesforcecli/mcp).

## Testing

All changes must have associated unit tests when possible.
E2E tests for tools will be added in the future.

For manual tool testing you can use the MCP inspector to make tool calls directly from your browser or terminal, this is handy when starting working on a new tool and you want to focus on the tool logic first before optimizing the agent instructions.
Install the MCP inspector CLI: 
```
npm i -g @modelcontextprotocol/inspector
```

then do the following:

### Browser
1. Build the local server: `yarn build`
2. Start the inspector server: `mcp-inspector node lib/index.js --orgs DEFAULT_TARGET_ORG`
3. If successful, open printed the localhost URL in your browser:
```
MCP Inspector is up and running at http://127.0.0.1:6274
```
4. Click `Connect` button, you should the this msg in the bottom-left panel
```
✅ Salesforce MCP Server running on stdio
```
5. Click on `List Tools`, then select one and fill the parameters required and click `Run Tool`

### Terminal

1. Build the local server: `yarn build`
5. Call a specific tool with its params by via the MCP inspector CLI:

Example calling sf-query-org from the context of an SFDX project
```shell
mcp-inspector --cli node lib/index.js --orgs DEFAULT_TARGET_ORG \
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
You can know more about each tool argument by looking at the their definition in code, the inspector browser UI or by listing all tools via the inspector CLI:
```shell
mcp-inspector --cli node lib/index.js --orgs DEFAULT_TARGET_ORG --method tools/list
```


### Unit tests

Unit tests are run with `yarn test` and use the mocha test framework. Tests are located in the test directory and are named with the pattern, `test/**/*.test.ts`.

## Debugging

<TODO>

## Useful yarn commands

#### `yarn install`

This downloads all NPM dependencies into the node_modules directory.

#### `yarn compile`

This compiles the typescript to javascript.

#### `yarn compile --watch`

This watches for file changes and compiles the typescript to javascript.

#### `yarn lint`

This lints all the typescript using eslint.

#### `yarn build`

This compiles and lints all the typescript (e.g., `yarn compile && yarn lint`).

#### `yarn clean`

This cleans all generated files and directories. Run `yarn clean-all` to also clean up the node_module directories.

#### `yarn test`

This runs unit tests (mocha) for the project using ts-node.
