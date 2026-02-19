# mcp

MCP Server for Interacting with Salesforce Orgs

[![NPM](https://img.shields.io/npm/v/@salesforce/mcp.svg?label=@salesforce/mcp)](https://www.npmjs.com/package/@salesforce/mcp) [![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/license/apache-2-0)

## Feedback

Report bugs and issues [here](https://github.com/forcedotcom/mcp/issues).  
For feature requests and other related topics, start a Discussion [here](https://github.com/forcedotcom/mcp/discussions).

## Documentation

For general documentation about the Salesforce DX MCP Server, see [this section](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_mcp.htm) in the _Salesforce DX Developer Guide_. The docs include:

- Comprehensive overview, including details about the security features.
- Quick start guide.
- Multiple examples of configuring the server in your MCP client.
- Sample prompts for invoking the core DX MCP tools.

[Here are the release notes.](https://github.com/forcedotcom/mcp/tree/main/releasenotes)

## Overview of the Salesforce DX MCP Server (Beta)

The Salesforce DX MCP Server is a specialized Model Context Protocol (MCP) implementation designed to facilitate seamless interaction between large language models (LLMs) and Salesforce orgs. This MCP server provides a robust set of tools and capabilities that enable LLMs to read, manage, and operate Salesforce resources securely.

> [!NOTE]
> _Salesforce DX MCP Server is a pilot or beta service that is subject to the Beta Services Terms at [Agreements - Salesforce.com](https://www.salesforce.com/company/legal/) or a written Unified Pilot Agreement if executed by Customer, and applicable terms in the [Product Terms Directory](https://ptd.salesforce.com/). Use of this pilot or beta service is at the Customer's sole discretion._

## Configure the DX MCP Server

Configure the Salesforce DX MCP Server for your MCP client by updating its associated MCP JSON file; each client is slightly different, so check your MCP client documentation for details. See [MCP Client Configurations](#mcp-client-configurations) for more examples.

Here's an example for VS Code with Copilot in which you create and update a `.vscode/mcp.json` file in your project:

```
{
     "servers": {
       "Salesforce DX": {
         "command": "npx",
         "args": ["-y", "@salesforce/mcp",
                 "--orgs", "DEFAULT_TARGET_ORG",
                 "--toolsets", "orgs,metadata,data,users",
                 "--tools", "run_apex_test",
                 "--allow-non-ga-tools"]
       }
     }
}
```

The `args` format shown in the preceding example is the same for all MCP clients; it's how you customize the DX MCP Server for your particular environment.

**Notes**:

- The `"-y", "@salesforce/mcp"` part tells `npx` to automatically install the `@salesforce/mcp` package instead of asking permission. Don't change this.
- For possible flags that you can pass to the `args` option, and the possible values that you can pass to the `--orgs`, `--toolsets`, and `--tools` flags, see these sections:
  - [Available Flags for the `args` Option](#available-flags-for-the-args-option)
  - [Configure Orgs](#configure-orgs)
  - [Configure Toolsets](#configure-toolsets)
  - [Configure Tools](#configure-tools)
- When writing the `args` option, surround both the flag names and their values in double quotes, and separate all flags and values with commas. Some flags are Boolean and don't take a value.
- The preceding example shows three flags that take a string value (`--orgs`, `--toolsets`, and `--tools`) and one Boolean flag (`--allow-non-ga-tools`). This configuration starts a DX MCP Server that enables all the MCP tools in the `orgs`, `metadata`, `data`, and `users` toolsets and a specific tool called `run_apex_tests`. It also enables tools in these configured toolsets that aren't yet generally available.

## MCP Client Configurations

Here are examples of configuring the Salesforce DX MCP Server in various MCP clients.

### Claude Code

To configure [Claude Code](https://www.claude.com/product/claude-code) to work with Salesforce DX MCP Server, add this snippet to the `.mcp.json` file in your project:

```
{
  "mcpServers": {
    "Salesforce DX": {
      "command": "npx",
      "args": ["-y", "@salesforce/mcp",
               "--orgs", "DEFAULT_TARGET_ORG",
               "--toolsets", "orgs,metadata,data,users",
               "--tools", "run_apex_test",
               "--allow-non-ga-tools" ]
    }
  }
}
```

### Cline

To configure [Cline](https://docs.cline.bot/mcp/mcp-overview) to work with Salesforce DX MCP Server, add this snippet to your Cline `cline_mcp_settings.json` file:

```json
{
  "mcpServers": {
    "Salesforce DX": {
      "command": "npx",
      "args": [
        "-y",
        "@salesforce/mcp@latest",
        "--orgs",
        "DEFAULT_TARGET_ORG",
        "--toolsets",
        "orgs,metadata,data,users",
        "--tools",
        "run_apex_test",
        "--allow-non-ga-tools"
      ]
    }
  }
}
```

### Cursor

To configure [Cursor](https://cursor.com/docs/context/mcp) to work with Salesforce DX MCP Server, add this snippet to your Cursor `mcp.json` file:

```json
{
  "mcpServers": {
    "Salesforce DX": {
      "command": "npx",
      "args": [
        "-y",
        "@salesforce/mcp@latest",
        "--orgs",
        "DEFAULT_TARGET_ORG",
        "--toolsets",
        "orgs,metadata,data,users",
        "--tools",
        "run_apex_test",
        "--allow-non-ga-tools"
      ]
    }
  }
}
```

### Other MCP Clients

For these other clients, refer to their documentation for adding MCP servers and follow the same pattern as in the preceding examples to configure the Salesforce DX MCP Server:

- [Trae](https://docs.trae.ai/ide/model-context-protocol?_lang=en)
- [Windsurf](https://docs.windsurf.com/windsurf/cascade/mcp)
- [Zed](https://github.com/zed-industries/zed)

## Available Flags for the "args" Option

These are the flags that you can pass to the `args` option.

| Flag Name              | Description                                                                                                                                                                           | Required? | Notes                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--allow-non-ga-tools` | Boolean flag to allow the DX MCP Server to use both the generally available (GA) and NON-GA tools that are in the toolsets or tools you specify.                                      | No        | By default, the DX MCP server uses only the tools marked GA.                                                                                                                                                                               |
| `--debug`              | Boolean flag that requests that the DX MCP Server print debug logs.                                                                                                                   | No        | Debug mode is disabled by default. <br/> <br/>**NOTE:** Not all MCP clients expose MCP logs, so this flag might not work for all IDEs.                                                                                                     |
| `--dynamic-tools`      | (experimental) Boolean flag that enables dynamic tool discovery and loading. When specified, the DX MCP server starts with a minimal set of core tools and loads new tools as needed. | No        | This flag is useful for reducing the initial context size and improving LLM performance. Dynamic tool discovery is disabled by default.<br/> <br/>**NOTE:** This feature works in VSCode and Cline but may not work in other environments. |
| `--no-telemetry`       | Boolean flag to disable telemetry, the automatic collection of data for monitoring and analysis.                                                                                      | No        | Telemetry is enabled by default, so specify this flag to disable it.                                                                                                                                                                       |
| `--orgs`               | One or more orgs that you've locally authorized.                                                                                                                                      | Yes       | You must specify at least one org. <br/> <br/>See [Configure Orgs](#configure-orgs) for the values you can pass to this flag.                                                                                                              |
| `--tools`              | Individual tool names that you want to enable.                                                                                                                                        | No        | You can use this flag in combination with the `--toolsets` flag. For example, you can enable all tools in one toolset, and just one tool in a different toolset.                                                                           |
| `--toolsets`           | Sets of tools, based on functionality, that you want to enable.                                                                                                                       | No        | Set to "all" to enable every tool in every toolset. <br/> <br/>See [Configure Toolsets](#configure-toolsets) for the values you can pass to this flag.                                                                                     |

## Configure Orgs

The Salesforce MCP tools require an org, and so you must include the required `--orgs` flag to specify at least one authorized org when you configure the MCP server. Separate multiple values with commas.

You must explicitly [authorize the orgs](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_web_flow.htm) on your computer before the MCP server can access them. Use the `org login web` Salesforce CLI command or the VS Code **SFDX: Authorize an Org** command from the command palette.

These are the available values for the `--orgs` flag:

| --orgs Value             | Description                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ALLOW_ALL_ORGS`         | Allow access to all authorized orgs. Use this value with caution.                                                                                                                           |
| `DEFAULT_TARGET_DEV_HUB` | Allow access to your default Dev Hub org. If you've set a local default Dev Hub org in your DX project, the MCP server uses it. If not, the server uses a globally-set default Dev Hub org. |
| `DEFAULT_TARGET_ORG`     | Allow access to your default org. If you've set a local default org in your DX project, the MCP server uses it. If not, the server uses a globally-set default org.                         |
| `<username or alias>`    | Allow access to a specific org by specifying its username or alias.                                                                                                                         |

## Configure Toolsets

The Salesforce DX MCP Server supports **toolsets**—a way to selectively enable different groups of MCP tools based on your needs. This allows you to run the MCP server with only the tools you require, which in turn reduces the LLM context.

Use the `--toolsets` flag to specify the toolsets when you configure the Salesforce DX MCP Server. Separate multiple toolsets with commas.

These are the available toolsets.

| Toolset          | Description                                                                                                                                                                                                                                                                             | See Tool List                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `all`            | Enables all available tools from all toolsets. <br>We recommend that you configure only the toolsets you’re going to use, rather than all of them with this value. The DX MCP Server includes over 60 MCP tools, so enabling them all in your MCP client can overwhelm the LLM context. | N/A                                                   |
| `aura-experts`   | Tools that provide Aura component analysis, blueprinting, and migration expertise.<br>See the [Aura-to-LWC Migration Tools](https://developer.salesforce.com/docs/platform/lwc/guide/mcp-aura.html) documentation.                                                                      | [Link](#aura-experts-toolset)                         |
| `code-analysis`  | Tools for static analysis of your code using Salesforce Code Analyzer.<br>See the [Code Analyzer MCP Tools](https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/mcp.html) documentation.                                                                      | [Link](#code-analysis-toolset)                        |
| `core`           | Core set of DX MCP tools. This toolset is always enabled. <br>See the [Core Salesforce DX Tools](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_mcp_use_core_tools.htm) documentation.                                                               | [Link](#core-toolset-always-enabled)                  |
| `data`           | Tools to manage the data in your org, such as listing all accounts. <br>See the [Core Salesforce DX Tools](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_mcp_use_core_tools.htm) documentation.                                                     | [Link](#data-toolset)                                 |
| `devops`         | Tools to securely and autonomously read, manage, and operate DevOps Center resources. <br>See the [DevOps MCP Tools](https://help.salesforce.com/s/articleView?id=platform.devops_center_mcp_intro.htm&type=5) documentation.                                                           | [Link](#devops-center-toolset)                        |
| `enrich_metadata`| Tools to Enrich metadata components in your DX project.                                                                                                                                                                                                                                 | [Link](#enrichment-toolset)                        |
| `lwc-experts`    | Tools to assist with Lightning Web Component (LWC) development, testing, optimization, and best practices.<br> See the [LWC MCP Tools](https://developer.salesforce.com/docs/platform/lwc/guide/mcp-intro.html) documentation.                                                          | [Link](#lightning-web-components-lwc-experts-toolset) |
| `metadata`       | Tools to deploy and retrieve metadata to and from your org and your DX project.<br>See the [Core Salesforce DX Tools](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_mcp_use_core_tools.htm) documentation.                                          | [Link](#metadata-toolset)                             |
| `mobile`         | Tools for mobile development and capabilities.<br>See the [Mobile MCP Tools](https://developer.salesforce.com/docs/atlas.en-us.mobile_offline.meta/mobile_offline/dx_mobile_mcp_toolset_mobile.htm) documentation.                                                                      | [Link](#mobile-toolset)                               |
| `mobile-core`    | A subset of tools from the `mobile` toolset focused on essential mobile capabilities. <br>See the [Mobile Core MCP Tools](https://developer.salesforce.com/docs/atlas.en-us.mobile_offline.meta/mobile_offline/dx_mobile_mcp_toolset_core.htm) documentation.                           | [Link](#mobile-core-toolset)                          |
| `orgs`           | Tools to manage your authorized orgs. <br>See the [Core Salesforce DX Tools](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_mcp_use_core_tools.htm) documentation.                                                                                   | [Link](#orgs-toolset)                                 |
| `scale-products` | Tools for detecting and fixing Apex performance.<br>See the [README](./packages/mcp-provider-scale-products/README.md) in the `mcp-provider-scale-products` subdirectory.                                                                                                               | [Link](#scale-products-toolset)                       |
| `testing`        | Tools to test your code and features. <br>See the [Core Salesforce DX Tools](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_mcp_use_core_tools.htm) documentation.                                                                                   | [Link](#testing-toolset)                              |
| `users`          | Tools to manage org users, such as assigning a permission set. <br>See the [Core Salesforce DX Tools](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_mcp_use_core_tools.htm) documentation.                                                          | [Link](#users-toolset)                                |

## Configure Tools

The Salesforce DX MCP Server also supports registering individual **tools**. This can be used in combination with **toolsets** to further fine-tune registered tools.

Use the `--tools` flag to enable specific tools when you configure the Salesforce DX MCP Server. Separate multiple tools with commas. The `--tools` flag is optional.

The following sections list all the tools that are included in a specific toolset.

> [!NOTE]
> The tools marked NON-GA are not yet generally available. Specify the `--allow-non-ga-tools` flag to use them.

### Aura Experts Toolset

For complete documentation, see [Use the Aura-to-LWC Migration Tools](https://developer.salesforce.com/docs/platform/lwc/guide/mcp-aura.html) in the _Lightning Web Components Developer Guide_.

- `create_aura_blueprint_draft` (GA) - Creates a comprehensive Product Requirements Document (PRD) blueprint for Aura component migration. Analyzes Aura component files and generates framework-agnostic specifications suitable for LWC migration, including business requirements, technical patterns, and migration guidelines.
- `enhance_aura_blueprint_draft` (GA) - Enhances an existing draft PRD with expert analysis and unknown resolution. Takes a draft blueprint and applies specialized Aura expert knowledge to resolve dependencies, add technical insights, and improve the migration specifications for better LWC implementation guidance.
- `orchestrate_aura_migration` (GA) - Orchestrates the complete Aura to LWC migration workflow. Provides end-to-end guidance for the entire migration process, from initial analysis through final implementation, including best practices, tooling recommendations, and quality assurance steps.
- `transition_prd_to_lwc` (GA) - Provides migration bridge guidance for creating LWC components from Aura specifications. Takes the enhanced PRD and generates specific implementation guidance, platform service mappings, and step-by-step instructions for building the equivalent LWC component.

### Code Analysis Toolset

For complete documentation, see [Use MCP Tools to Analyze Your Code ](https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/mcp.html) in the _Salesforce Code Analyzer Developer Guide_.

- `describe_code_analyzer_rule` (GA) - A tool for getting the description of a Code Analyzer rule.
- `list_code_analyzer_rules` (GA) - A tool for selecting Code Analyzer rules based on a number of criteria.
- `query_code_analyzer_results` (GA) - Queries a Code Analyzer results JSON file and returns filtered violations. Supports filters such as severity, category/tag, engine, rule, and file name, plus top-N and sorting. Use this after running `run_code_analyzer` to read the generated results file. After completion, this tool will summarize and explain the filtered results to the user.
- `run_code_analyzer` (GA) - A tool for performing static analysis against code. This tool can validate that code conforms to best practices, check for security vulnerabilities, and identify possible performance issues. It returns a JSON containing the absolute path to a results file if such a file was created and a string indicating the overall success or failure of the operation.

### Core Toolset (always enabled)

For sample prompts that invoke the core DX MCP tools, see [Use the Core Salesforce DX MCP Tools](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_mcp_use_core_tools.htm) in the _Salesforce DX Developer Guide_.

- `get_username` (GA) - Determines the appropriate username or alias for Salesforce operations, handling both default orgs and Dev Hubs.
- `resume_tool_operation` (GA) - Resumes a long-running operation that wasn't completed by another tool.

### Data Toolset

For sample prompts that invoke the core DX MCP tools, see [Use the Core Salesforce DX MCP Tools](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_mcp_use_core_tools.htm) in the _Salesforce DX Developer Guide_.

- `run_soql_query` (GA) - Runs a SOQL query against a Salesforce org.

### DevOps Center Toolset

For complete documentation, see [Merge Conflict Resolution with DevOps Center MCP Tools (Managed Package)](https://help.salesforce.com/s/articleView?id=platform.devops_center_mcp_intro.htm&type=5) in Salesforce Help.

- `check_devops_center_commit_status` (NON-GA) - Check the current status of a work item committed to DevOps Center.
- `checkout_devops_center_work_item` (NON-GA) - Checks out the branch associated with a selected work item by name.
- `commit_devops_center_work_item` (NON-GA) - Commit SFDX project changes and register the commit SHA in DevOps Center.
- `create_devops_center_pull_request` (NON-GA) - Commit local changes to a DevOps Center work item’s feature branch.
- `detect_devops_center_merge_conflict` (GA) - Detects merge conflicts for a selected work item or in a given source branch.
- `list_devops_center_projects` (NON-GA) - List all DevOps Center projects in a specific org.
- `list_devops_center_work_items` (NON-GA) - List all the work items for a specific DevOps Center project.
- `promote_devops_center_work_item` (NON-GA) - Promote an approved work item to the next stage in the DevOps Center pipeline.
- `resolve_devops_center_merge_conflict` (GA) - Apply a selected resolution method to a merge conflict.

### Enrichment Toolset

- `enrich_metadata` (NON-GA) - Enrich metadata from your org in your DX project.

### Lightning Web Components (LWC) Experts Toolset

For complete documentation, see [Use DX MCP Tools for LWC](https://developer.salesforce.com/docs/platform/lwc/guide/mcp-intro.html) in the _Lightning Web Components Developer Guide_.

#### Component Development

- `create_lwc_component_from_prd` (GA) - Creates complete LWC components from PRD specifications with proper structure. and best practices
- `create_lwc_jest_tests` (GA) - Generates Jest test suites for LWC components with coverage and mocking.
- `review_lwc_jest_tests` (GA) - Reviews and validates Jest test implementations for LWC components.

#### Development Guidelines

- `create_lightning_type` (GA) - Provides guidance for creating Custom Lightning Types (CLT) for Salesforce applications, agent actions, Lightning web components, and Lightning Platform integrations.
- `guide_lwc_accessibility` (GA) - Provides accessibility guidelines and testing instructions for LWC components.
- `guide_lwc_best_practices` (GA) - Offers LWC development best practices and coding standards guidance.
- `guide_lwc_development` (GA) - Provides LWC development workflow and implementation guidelines.
- `guide_lwc_rtl_support` (GA) - Provides Right-to-Left (RTL) internationalization support and RTL development guidance.
- `guide_lwc_slds2_uplift_linter_fixes` (NON-GA) - Analyzes the given LWC code along with the slds-linter output to fix issues using Salesforce Lightning Design System 2 (SLDS 2) guidelines.
- `guide_lwc_security` (GA) - Provides security analysis in accordance with product security guidelines and Lightning Web Security guidelines.
- `guide_design_general` (GA) - Provides SLDS guidelines and best practices for Lightning Web Components with accessibility, responsive design, and component usage patterns.
- `guide_utam_generation` (NON-GA) - Provides UI Test Automation Model (UTAM) Page Object generation guidelines and best practices.

#### Lightning Data Service (LDS) Tools

- `create_lds_graphql_mutation_query` (GA) - Provides guidance for creating GraphQL mutation queries.
- `create_lds_graphql_read_query` (GA) - Create GraphQL read queries for LDS.
- `explore_lds_graphql_schema` (GA) - Explore GraphQL schema structure for LDS.
- `explore_lds_uiapi` (GA) - Explores and documents Lightning Design System UI API capabilities.
- `guide_lds_data_consistency` (GA) - Provides data consistency patterns and best practices for LDS components.
- `guide_lds_development` (GA) - Provides LDS development guidelines and component integration.
- `guide_lds_graphql` (GA) - Provides LDS GraphQL usage patterns and guidelines.
- `guide_lds_referential_integrity` (GA) - Provides referential integrity patterns for LDS data management.
- `orchestrate_lds_data_requirements` (GA) - Provides step-by-step guidance for analyzing and clarifying LDS data requirements to produce PRD-ready specifications.

#### Migration & Integration Tools

- `guide_figma_to_lwc_conversion` (GA) - Converts Figma designs to LWC component specifications.
- `run_lwc_accessibility_jest_tests` (GA) - Provides accessibility testing utilities and Jest integration for LWC components.
- `verify_aura_migration_completeness` (GA) - Provides Aura to LWC migration completeness checklist and validation.

#### Workflow Tools

- `orchestrate_lwc_component_creation` (GA) - Provides guidance for the entire Aura-to-LWC migration process.
- `orchestrate_lwc_component_optimization` (GA) - Provides performance optimization and best practices for LWC components.
- `orchestrate_lwc_component_testing` (GA) - Provides comprehensive testing workflow and test generation guidance.
- `orchestrate_lwc_slds2_uplift` (NON-GA) - Provides migration guidance for upgrading to SLDS 2.

### Metadata Toolset

For sample prompts that invoke the core DX MCP tools, see [Use the Core Salesforce DX MCP Tools](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_mcp_use_core_tools.htm) in the _Salesforce DX Developer Guide_.

- `deploy_metadata` (GA) - Deploys metadata from your DX project to an org.
- `retrieve_metadata` (GA) - Retrieves metadata from your org to your DX project.

### Mobile Toolset

For complete documentation, see [Use the mobile Toolset](https://developer.salesforce.com/docs/atlas.en-us.mobile_offline.meta/mobile_offline/dx_mobile_mcp_toolset_mobile.htm) in the _Mobile and Offline Developer Guide_.

- `create_mobile_lwc_app_review` (GA) - Provides TypeScript API documentation for Salesforce LWC App Review Service, offering expert guidance for implementing app review features in LWC components.
- `create_mobile_lwc_ar_space_capture` (GA) - Provides TypeScript API documentation for Salesforce LWC AR Space Capture, offering expert guidance for implementing AR space capture features in LWC components.
- `create_mobile_lwc_barcode_scanner` (GA) - Provides TypeScript API documentation for Salesforce LWC Barcode Scanner, offering expert guidance for implementing barcode scanning features in LWC components.
- `create_mobile_lwc_biometrics` (GA) - Provides TypeScript API documentation for Salesforce LWC Biometrics Service, offering expert guidance for implementing biometric authentication features in LWC components.
- `create_mobile_lwc_calendar` (GA) - Provides TypeScript API documentation for Salesforce LWC Calendar Service, offering expert guidance for implementing calendar integration features in LWC components.
- `create_mobile_lwc_contacts` (GA) - Provides TypeScript API documentation for Salesforce LWC Contacts Service, offering expert guidance for implementing contacts management features in LWC components.
- `create_mobile_lwc_document_scanner` (GA) - Provides TypeScript API documentation for Salesforce LWC Document Scanner, offering expert guidance for implementing document scanning features in LWC components.
- `create_mobile_lwc_geofencing` (GA) - Provides TypeScript API documentation for Salesforce LWC Geofencing Service, offering expert guidance for implementing geofencing features in LWC components.
- `create_mobile_lwc_location` (GA) - Provides TypeScript API documentation for Salesforce LWC Location Service, offering expert guidance for implementing location services in LWC components.
- `create_mobile_lwc_nfc` (GA) - Provides TypeScript API documentation for Salesforce LWC NFC Service, offering expert guidance for implementing NFC features in LWC components.
- `create_mobile_lwc_payments` - Provides TypeScript API documentation for Salesforce LWC Payments Service, offering expert guidance for implementing payment processing features in LWC components.
- `get_mobile_lwc_offline_analysis` (GA) - Analyzes LWC components for mobile-specific issues and provides detailed recommendations for mobile offline compatibility and performance improvements.
- `get_mobile_lwc_offline_guidance` (GA) - Provides structured review instructions to detect and remediate mobile offline code violations in LWC components for Salesforce mobile apps.

### Mobile-core Toolset

For complete documentation, see [Use the mobile-core Toolset](https://developer.salesforce.com/docs/atlas.en-us.mobile_offline.meta/mobile_offline/dx_mobile_mcp_toolset_core.htm) in the _Mobile and Offline Developer Guide_.

- `create_mobile_lwc_barcode_scanner` (GA) - Provides TypeScript API documentation for Salesforce LWC Barcode Scanner, offering expert guidance for implementing barcode scanning features in LWC components.
- `create_mobile_lwc_biometrics` (GA) - Provides TypeScript API documentation for Salesforce LWC Biometrics Service, offering expert guidance for implementing biometric authentication features in LWC components.
- `create_mobile_lwc_location` (GA) - Provides TypeScript API documentation for Salesforce LWC Location Service, offering expert guidance for implementing location services in LWC components.
- `get_mobile_lwc_offline_analysis` (GA) - Analyzes LWC components for mobile-specific issues and provides detailed recommendations for mobile offline compatibility and performance improvements.
- `get_mobile_lwc_offline_guidance` (GA) - Provides structured review instructions to detect and remediate mobile offline code violations in LWC components for Salesforce mobile apps.

### Orgs Toolset

For sample prompts that invoke the core DX MCP tools, see [Use the Core Salesforce DX MCP Tools](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_mcp_use_core_tools.htm) in the _Salesforce DX Developer Guide_.

- `create_org_snapshot` (NON-GA) - Create a scratch org snapshot.
- `create_scratch_org` (NON-GA) - Create a scratch org.
- `delete_org` (NON-GA) - Delete a locally-authorized Salesforce scratch org or sandbox.
- `list_all_orgs` (GA) - List all configured Salesforce orgs, with optional connection status checking.
- `open_org` (NON-GA) - Open an org in a browser.

### Scale Products Toolset

For complete documentation, see the [README](./packages/mcp-provider-scale-products/README.md) in the `mcp-provider-scale-products` subdirectory.

- `scan_apex_class_for_antipatterns` - (NON-GA) Analyzes Apex class files for performance antipatterns and provides recommendations for fixing them.

### Testing Toolset

For sample prompts that invoke the core DX MCP tools, see [Use the Core Salesforce DX MCP Tools](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_mcp_use_core_tools.htm) in the _Salesforce DX Developer Guide_.

- `run_agent_test` (GA) - Executes agent tests in your org.
- `run_apex_test` (GA) - Executes Apex tests in your org.

### Users Toolset

For sample prompts that invoke the core DX MCP tools, see [Use the Core Salesforce DX MCP Tools](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_mcp_use_core_tools.htm) in the _Salesforce DX Developer Guide_.

- `assign_permission_set` (GA) - Assigns a permission set to the user or on behalf of another user.
