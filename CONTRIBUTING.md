## Contributing

1. The [DEVELOPING](DEVELOPING.md) doc has details on how to set up your environment.
1. Create a new issue [here](https://github.com/forcedotcom/cli/issues) before starting your project so that we can keep track of
   what you are trying to add/fix. That way, we can also offer suggestions or
   let you know if there is already an effort in progress.
1. Fork this repository (external contributors) or branch off main (committers).
1. Create a _topic_ branch in your fork based on the main branch. Note, this step is recommended but technically not required if contributing using a fork.
1. Edit the code in your fork/branch.
1. Write appropriate tests for your changes. Try to achieve at least 95% code coverage on any new code. No pull request will be accepted without associated tests.
1. Sign CLA (see [CLA](#cla) below).
1. Send us a pull request when you are done. We'll review your code, suggest any
   needed changes, and merge it in.
1. Upon merge, a new release of the `@salesforce/mcp` plugin will be published to [npm](https://www.npmjs.com/package/@salesforce/mcp) with a version bump corresponding to commitizen rules.

### CLA

External contributors will be required to sign a Contributor's License
Agreement. You can do so by going to https://cla.salesforce.com/sign-cla.

## Branches

- We work in branches off of `main`.
- Our released (aka. _production_) branch is `main`.
- Our work happens in _topic_ branches (feature and/or bug-fix).
  - feature as well as bug-fix branches are based on `main`
  - branches _should_ be kept up-to-date using `rebase`
  - [commit messages are enforced](DEVELOPING.md#When-you-are-ready-to-commit)

## Pull Requests

- Develop features and bug fixes in _topic_ branches off main, or forks.
- _Topic_ branches can live in forks (external contributors) or within this repository (committers).
  - When creating _topic_ branches in this repository please prefix with `<initials>/`. For example: `mb/refactor-tests`.
- PRs will be reviewed and merged by committers.

## Releasing

- A new version of this plugin (`@salesforce/mcp`) will be published upon merging PRs to `main`, with the version number increment based on commitizen rules.
