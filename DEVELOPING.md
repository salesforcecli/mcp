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
1. Run changed commands: e.g., `./bin/run.js my-topic my-command`
1. Write tests and run: `yarn test` ([unit](#unit-tests)) and/or `yarn test:nuts` ([NUTS](#nuts-non-unit-tests))
1. Show all changed files: `git status`
1. Add all files to staging: `git add .`
1. Commit staged files with helpful commit message: `git commit`
   - TODO
1. Push commit(s) to remote: `git push -u origin <branch_name>`
1. Create a pull request (PR) using the GitHub UI [here](https://github.com/salesforcecli/mcp).

## Testing

All changes must have associated tests. This library uses a combination of unit testing and NUTs (non-unit tests).

### Unit tests

Unit tests are run with `yarn test` and use the mocha test framework. Tests are located in the test directory and are named with the pattern, `test/commands/my-topic/my-command/<test-file>.test.ts`. Notice that the directory structure is similar to the commands in the `src` directory. Reference the existing unit tests when writing and testing code changes.

### NUTs (non-unit tests)

Non-unit tests are run with `yarn test:nuts` and use the [cli-plugin-testkit](https://github.com/salesforcecli/cli-plugins-testkit) framework. These tests run using the default devhub in your environment. NUTs are a way to test the library code in a real environment versus a unit test environment where many things are stubbed.

## Debugging

If you need to debug plugin code or tests you should refer to the excellent documentation on this topic in the [Plugin Developer Guide](https://github.com/salesforcecli/cli/wiki/Debug-Your-Plugin).

## Running Commands

To run your modified plugin commands locally, use `./bin/run.js` or `./bin/run.cmd` (Windows). Note that you must compile any code changes (`yarn compile`) before seeing those changes with `./bin/run.js`.

```bash
# Run using local script.
./bin/run.js my-topic my-command
```

There should be no differences when running via the Salesforce CLI or using the local `bin` scripts. However, it can be useful to link the plugin to the CLI to do some additional testing or run your commands from anywhere on your machine.

```bash
# Link your plugin to the sf cli
sf plugins link .
# To verify
sf plugins
# To run
sf my-topic my-command
```

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

#### `yarn test:nuts`

This runs NUTs (non-unit tests) for the project using ts-node.
