## [0.23.5](https://github.com/salesforcecli/mcp/compare/0.23.4...0.23.5) (2025-11-07)


### Bug Fixes

* add shrinkwrap lockfile @W-19291869@ ([#188](https://github.com/salesforcecli/mcp/issues/188)) ([915e19d](https://github.com/salesforcecli/mcp/commit/915e19d5a25232ca6fde62cf71c698f9d19ba8a5))
* listen on `SIGTERM` for telemetry ([#296](https://github.com/salesforcecli/mcp/issues/296)) ([2115e37](https://github.com/salesforcecli/mcp/commit/2115e3733f7bb8cbfc997635bbe7b807333d931b))
* switch slds tools to non ga @W-20093690 ([#322](https://github.com/salesforcecli/mcp/issues/322)) ([1abc80a](https://github.com/salesforcecli/mcp/commit/1abc80aa179d12500c7cd547aa6783548bfee554))
* **telemetry:** always set `isError` for tool events ([#308](https://github.com/salesforcecli/mcp/issues/308)) ([a7f9568](https://github.com/salesforcecli/mcp/commit/a7f95689d650d30900b920b5ee609b3af488b0e1))



## [0.23.4](https://github.com/salesforcecli/mcp/compare/0.23.3...0.23.4) (2025-10-06)



## [0.23.3](https://github.com/salesforcecli/mcp/compare/0.23.2...0.23.3) (2025-10-03)


### Bug Fixes

* temp tool rename fix ([#278](https://github.com/salesforcecli/mcp/issues/278)) ([3bcaa5d](https://github.com/salesforcecli/mcp/commit/3bcaa5d4d9edbe5395e40f8550ea7effe098b18c))



## [0.23.2](https://github.com/salesforcecli/mcp/compare/0.23.1...0.23.2) (2025-10-03)



## [0.23.1](https://github.com/salesforcecli/mcp/compare/0.23.0...0.23.1) (2025-10-03)



# [0.23.0](https://github.com/salesforcecli/mcp/compare/0.22.1...0.23.0) (2025-10-01)


### Bug Fixes

* remove telem from source ([#269](https://github.com/salesforcecli/mcp/issues/269)) ([c78053f](https://github.com/salesforcecli/mcp/commit/c78053f2cab4330b97c7ca78a7a3ffd1cd6c84fa))


### Features

* enable o11y telemetry ([#268](https://github.com/salesforcecli/mcp/issues/268)) ([f02156e](https://github.com/salesforcecli/mcp/commit/f02156ed0bc42a3bc79ea196bd6749cf866968ea)), closes [#264](https://github.com/salesforcecli/mcp/issues/264)



## [0.22.1](https://github.com/salesforcecli/mcp/compare/0.22.0...0.22.1) (2025-10-01)



# [0.22.0](https://github.com/salesforcecli/mcp/compare/0.21.4...0.22.0) (2025-09-30)


### Features

* update tools description and add lds workflow tool ([#258](https://github.com/salesforcecli/mcp/issues/258)) ([76c53f6](https://github.com/salesforcecli/mcp/commit/76c53f68446be7431801033c8db902b8a72d1c93))



## [0.21.4](https://github.com/salesforcecli/mcp/compare/0.21.3...0.21.4) (2025-09-26)



## [0.21.3](https://github.com/salesforcecli/mcp/compare/0.21.2...0.21.3) (2025-09-25)



## [0.21.2](https://github.com/salesforcecli/mcp/compare/0.21.1...0.21.2) (2025-09-24)


### Bug Fixes

* update tool names of LWC and Aura experts ([#247](https://github.com/salesforcecli/mcp/issues/247)) ([1d42c4c](https://github.com/salesforcecli/mcp/commit/1d42c4c90fbdbc41003cea71e0dd82708b91d085))



## [0.21.1](https://github.com/salesforcecli/mcp/compare/0.21.0...0.21.1) (2025-09-23)



# [0.21.0](https://github.com/salesforcecli/mcp/compare/0.20.1...0.21.0) (2025-09-23)


### Bug Fixes

* **devops:** tool rename ([#242](https://github.com/salesforcecli/mcp/issues/242)) ([199a45f](https://github.com/salesforcecli/mcp/commit/199a45fe3bf96931299a75ae8c434651383b1b58))
* remove dev-scripts scripts ([b0e096f](https://github.com/salesforcecli/mcp/commit/b0e096ffc70572a777243d2bdd2dd3eec0e1d978))
* remove sf prefix -W-19676410 ([#228](https://github.com/salesforcecli/mcp/issues/228)) ([9b02795](https://github.com/salesforcecli/mcp/commit/9b02795e72ee8fc716dcca643ede1ca8e1c3e378))


### Features

* add `--tools` flag ([#231](https://github.com/salesforcecli/mcp/issues/231)) ([3effd2a](https://github.com/salesforcecli/mcp/commit/3effd2ac5ac72d9e8413a9f9402bb0f35ecb20d2)), closes [#234](https://github.com/salesforcecli/mcp/issues/234)
* add aura and LWC toolset @W-19627145 ([#229](https://github.com/salesforcecli/mcp/issues/229)) ([8e7681f](https://github.com/salesforcecli/mcp/commit/8e7681fb80b5b53e2a8977b07f108bc7efed14e5))
* add devops tools W-19616705 ([#232](https://github.com/salesforcecli/mcp/issues/232)) ([06d3e5e](https://github.com/salesforcecli/mcp/commit/06d3e5e1f5847b795da88156e086eb77401434cb)), closes [#227](https://github.com/salesforcecli/mcp/issues/227)
* add lwc security guide mcp tool ([#245](https://github.com/salesforcecli/mcp/issues/245)) ([41b3bd4](https://github.com/salesforcecli/mcp/commit/41b3bd4c7c7d3263ced0806558be6ce9e0ae1bd0))


### Reverts

* Revert "chore(release): 0.21.0 [skip ci]" ([7e35e06](https://github.com/salesforcecli/mcp/commit/7e35e0698917fef56765e49a3f15179dd5d0d92e))



## [0.20.1](https://github.com/salesforcecli/mcp/compare/0.20.0...0.20.1) (2025-09-16)



# [0.20.0](https://github.com/salesforcecli/mcp/compare/0.19.3...0.20.0) (2025-09-16)


### Features

* @W-18832384 add lwc experts mcp provider ([#211](https://github.com/salesforcecli/mcp/issues/211)) ([b8b9169](https://github.com/salesforcecli/mcp/commit/b8b9169753c8341f57a5ad43752cb12393b6892c))



## [0.19.3](https://github.com/salesforcecli/mcp/compare/0.19.2...0.19.3) (2025-09-16)



## [0.19.2](https://github.com/salesforcecli/mcp/compare/0.19.1...0.19.2) (2025-09-16)



## [0.19.1](https://github.com/salesforcecli/mcp/compare/0.19.0...0.19.1) (2025-09-04)


### Bug Fixes

* improve sf-get-username instructions W-19472383 ([#181](https://github.com/salesforcecli/mcp/issues/181)) ([ce845f8](https://github.com/salesforcecli/mcp/commit/ce845f8a956dece92cf2d67e29cc868c8ac69b92))



# [0.19.0](https://github.com/salesforcecli/mcp/compare/0.18.0...0.19.0) (2025-08-29)


### Features

* remove sf-suggest-cli-command W-19452518 ([#166](https://github.com/salesforcecli/mcp/issues/166)) ([9a06c05](https://github.com/salesforcecli/mcp/commit/9a06c056c564844b2df74a1ecf3484eb654e614e))



# [0.18.0](https://github.com/salesforcecli/mcp/compare/0.17.1...0.18.0) (2025-08-28)


### Bug Fixes

* **W-19398430:** clean up from initial refactor ([#148](https://github.com/salesforcecli/mcp/issues/148)) ([39a8a8a](https://github.com/salesforcecli/mcp/commit/39a8a8af9519529281acb1ee5b49ad4fd3f0229c))


### Features

* **W-19398454:** move dx core tools to separate package ([#155](https://github.com/salesforcecli/mcp/issues/155)) ([36f94bb](https://github.com/salesforcecli/mcp/commit/36f94bb97e0ba4de8aeba700ff947d03eb865bc0))



