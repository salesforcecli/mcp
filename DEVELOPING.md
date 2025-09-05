# Developing in this monorepo

This guide explains how to work in this Yarn workspaces monorepo, add new packages, and develop existing ones without tripping on common pitfalls. Individual packages may include their own, more specific `DEVELOPING.md`—always check those first.

## What’s here

- Packages live under `packages/`
- Yarn workspaces with `nohoist: ["**"]` means each package has its own `node_modules`
- Root scripts fan out to all workspaces (they call each package’s own scripts)

## Prerequisites

- Node.js (use an up-to-date LTS). Managing versions with Volta or nvm is recommended.
- Yarn (this repo uses Yarn workspaces; install yarn globally)

## Root-level commands

Run these from the repo root; they execute across all packages via workspace scripts.

```bash
# Install deps for all packages and wire workspace links
yarn install

# Build, test, lint, clean all packages
yarn build
yarn test
yarn lint
yarn clean

# Clean everything, including the root node_modules (useful after renames/moves)
yarn clean-all

# Pack all packages (creates .tgz in each package)
yarn package
```

## Working on an existing package

1) Find the package in `packages/<dir>` and check for a local `DEVELOPING.md` or `README.md` with package-specific steps.

2) Run package scripts from the repo root using `yarn workspace`:

```bash
# Replace with the actual workspace name from the package.json "name" field
yarn workspace @salesforce/mcp-provider-api build
yarn workspace @salesforce/mcp-provider-api test
yarn workspace @salesforce/mcp-provider-api lint

# Add or remove dependencies for just that package
yarn workspace @salesforce/mcp-provider-api add some-dep@^1
yarn workspace @salesforce/mcp-provider-api add -D some-dev-dep@^1
yarn workspace @salesforce/mcp-provider-api remove some-dep
```

3) Linking sibling workspaces locally

- Workspaces are symlinked automatically by `yarn install` when the version you declare in `dependencies` matches (or satisfies) the sibling package’s version.
- If you see Yarn fetching a dependency from the registry instead of linking a sibling, check that the version range you declared actually matches the sibling’s version.

4) Watch/iterative workflows

- Some packages provide `build:watch`, `test:only`, etc. Use those if available (see the package scripts).
- Root `yarn build`/`yarn test` will call each package’s own scripts, which can vary (e.g., TypeScript + Vitest vs. Mocha/Wireit).

## Adding a new package

> [!NOTE]
> If you are creating an MCP provider in a stand-alone repo:
> - You can still use EXAMPLE-MCP-PROVIDER as a guide for building your tool
> - Publish your package to npm (e.g. `@salesforce/mcp-provider-<your-name>`)
> - Add your package name and version to `packages/mcp/package.json` > `dependencies`
> - Register your tools ([docs](https://github.com/salesforcecli/mcp/blob/main/DEVELOPING.md#registering-new-tools-in-the-server))

If you’re adding an MCP provider to the `salesforcecli/mcp` repository, follow these two rules:

- The folder name under `packages/` must start with `mcp-provider-`.
- The npm package name should follow the existing scope and naming (e.g., `@salesforce/mcp-provider-<your-name>`). Match the scope used by current packages unless you have a reason to use a different scope.

Before you go any further, watch this [video](https://drive.google.com/file/d/19LWuiRKtpxIdizj-YbjslONyZGiFDBdw/view) that reviews how to onboard your project.

Fastest path: copy the example provider.

```bash
# Copy the example and rename the folder (choose a descriptive suffix)
cp -R packages/EXAMPLE-MCP-PROVIDER packages/mcp-provider-your-feature
```

Then, in `packages/mcp-provider-your-feature/package.json`, update at minimum:

- `name`: `@salesforce/mcp-provider-your-feature`
- `description`: a clear, one-line summary
- `main`/`types`: keep as-is (the example outputs to `dist/`)
- `scripts`: the example includes `build`, `clean`, `clean-all`, `lint`, `package`, `test`
- `dependencies`: include `@salesforce/mcp-provider-api` at a version compatible with the local workspace so Yarn links it

Why use the example?

- `packages/EXAMPLE-MCP-PROVIDER` is a minimal, up-to-date template using TypeScript and Vitest. It includes a working provider skeleton (`src/provider.ts`), sensible TS configs, and CI-friendly scripts. Starting from it avoids drift and mysterious build errors.

Register the new workspace and try it:

```bash
# From the repo root
yarn install
yarn workspace @salesforce/mcp-provider-your-feature build
yarn workspace @salesforce/mcp-provider-your-feature test
```

Wire it into the MCP server (update server dependencies):

- Add your new provider as a dependency of the MCP server package so it can be discovered and bundled for local runs.
- Edit `packages/mcp/package.json` and add your package under `dependencies` using a version that matches your provider’s `package.json` (this ensures Yarn links the local workspace).
- Also update the server’s Wireit build order so the server builds after your provider. In `packages/mcp/package.json`, append your provider to `wireit.compile.dependencies` as:
	- `"../mcp-provider-your-feature:build"`
- After editing, run:

```bash
yarn install
yarn workspace @salesforce/mcp build
```

## Triggering releases for your provider

Once your provider is ready for release, you can publish it and optionally trigger a full server release:

### Provider-only release (automatic on main branch):
- Push changes to `main` branch - providers in the auto-publish list (`mcp-provider-api`, `mcp-provider-dx-core`) will automatically publish when changes are detected
- To opt-in to auto-publishing: add your provider to the `AUTO_PUBLISHABLE_PACKAGES` array in `.github/workflows/publish-providers.yml` and in the `on.push.paths` array.
- For manual-schedule providers like `mcp-provider-code-analyzer`, use: `gh workflow run publish-providers --field packages='mcp-provider-YOUR_PROVIDER'`

### Full server release (includes your provider):
1. First ensure your provider is published: `gh workflow run publish-providers --field packages='mcp-provider-YOUR_PROVIDER'`
2. Then release the main server with updated dependencies: `gh workflow run publish-mcp-server --field update-providers=true`

### Server release with all latest providers:
- To release the server with all provider packages updated to their latest versions: `gh workflow run publish-mcp-server --field update-providers=true`
- To update only specific providers: `gh workflow run publish-mcp-server --field update-providers=true --field providers-to-update='mcp-provider-api,mcp-provider-dx-core'`

### Server prerelease (dev versions):
- For dev releases: `gh workflow run publish-mcp-server --field prerelease='dev'`
- Prereleases are published to custom npm tags (e.g., `npm install -g @salesforce/mcp@dev`).

The server release workflow will automatically update to the latest provider versions before publishing the main MCP server package.

- For server wiring details and how providers are loaded, see `packages/mcp/DEVELOPING.md`.

## Dependabot automation
We have Dependabot enabled in this repo for the the packages listed in `.github/dependabot.yml`, if a PR passes all tests it will be automatically merged (cron job checks PRs opens every day).
This automation is opt-in by default (just add your package dir to the dependabot config), just note that you can't enable dependabot PRs and disable automerges yet (will be addressed in the future)

## Running the MCP server locally

Quick options; see `packages/mcp/DEVELOPING.md` for full details and troubleshooting.

- From the repo root, build the server workspace:

```bash
yarn workspace @salesforce/mcp build
```

- Option A: start via the server’s start script (spawns MCP Inspector against the CLI bin):

```bash
yarn workspace @salesforce/mcp start
```

- Option B: use MCP Inspector (browser) directly against the built server (run inside the server package):

```bash
cd packages/mcp
mcp-inspector node lib/index.js --orgs DEFAULT_TARGET_ORG
```

- Option C: use MCP Inspector CLI mode against the server’s CLI entry (run inside the server package):

```bash
cd packages/mcp
mcp-inspector --cli node bin/run.js --orgs DEFAULT_TARGET_ORG --method tools/list
```

Notes:

- If debugging, set a longer timeout: `MCP_SERVER_REQUEST_TIMEOUT=120000`.
- Rebuild after code changes to keep JS and TS in sync: `yarn workspace @salesforce/mcp compile` (or `build`).
- For VS Code, you can point your MCP client to `node bin/run.js` in `packages/mcp`—see the server’s `DEVELOPING.md` for an example configuration.

### Registering new tools in the server

- New tools must be provided by an `McpProvider` and registered in the server’s `MCP_PROVIDER_REGISTRY` (see `packages/mcp/src/registry.ts`). The server package’s `DEVELOPING.md` is the source of truth for registration and validation steps.

Notes for non-provider packages:

- If you’re creating a shared library (not an MCP provider), place it under `packages/` without the `mcp-provider-` prefix and mirror conventions from similar packages (e.g., `mcp-provider-api`).

## Troubleshooting and tips

- No hoisting: because `nohoist` is set to `**`, add dependencies in the specific package, not at the repo root.
- When in doubt, rewire workspaces: `yarn clean-all && yarn install` often fixes stale links after renames or large refactors.
- Workspace linking: if a sibling workspace isn’t linking, align your declared semver range with the sibling’s version.
- Building order: root `yarn build` will invoke each package’s own build. Some packages use Wireit, some plain `tsc`. If a package depends on another, build the dependency first or just run the root build.


