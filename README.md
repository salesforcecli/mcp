# mcp

MCP Server for Interacting with Salesforce Orgs

[![NPM](https://img.shields.io/npm/v/@salesforce/mcp.svg?label=@salesforce/mcp)](https://www.npmjs.com/package/@salesforce/mcp) [![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/license/apache-2-0)

## Feedback

Report bugs and issues [here](https://github.com/forcedotcom/mcp/issues).  
For feature requests and other related topics, start a Discussion [here](https://github.com/forcedotcom/mcp/discussions).  

## Documentation

For complete documentation about the Salesforce DX MCP Server, see [this section](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_mcp.htm) in the _Salesforce DX Developer Guide_. The docs include:

* Comprehensive overview, including details about the security features.
* Quick start guide.
* Multiple examples of configuring the server in your MCP client.
* Sample prompts for invoking the core DX MCP tools.

[Here are the release notes.](https://github.com/forcedotcom/mcp/tree/main/releasenotes)

## Overview of the Salesforce DX MCP Server (Beta)

The Salesforce DX MCP Server is a specialized Model Context Protocol (MCP) implementation designed to facilitate seamless interaction between large language models (LLMs) and Salesforce orgs. This MCP server provides a robust set of tools and capabilities that enable LLMs to read, manage, and operate Salesforce resources securely.

> [!NOTE]
> _Salesforce DX MCP Server is a pilot or beta service that is subject to the Beta Services Terms at [Agreements - Salesforce.com](https://www.salesforce.com/company/legal/) or a written Unified Pilot Agreement if executed by Customer, and applicable terms in the [Product Terms Directory](https://ptd.salesforce.com/). Use of this pilot or beta service is at the Customer's sole discretion._

## Configure the DX MCP Server

Configure the Salesforce DX MCP Server for your MCP client by updating its associated MCP JSON file; each client is slightly different, so check your MCP client documentation for details. See [MCP Client Configurations](./README.md#mcp-client-configurations) for more examples. 

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

The `args` format shown in the preceding example is the same for all MCP clients; it's how you customize the DX MCP Server for your particular environment. Notes:

- The `"-y", "@salesforce/mcp"` part tells `npx` to automatically install the `@salesforce/mcp` package instead of asking permission. Don't change this. 
- See the *Reference* sections below for the possible flags you can pass the `args` option, and possible values you can pass to the `--orgs`, `--toolsets`, and `--tools` flags. 
- When writing the `args` option, surround both the flag names and their values in double quotes, and separate all flags and values with commas. Some flags are Boolean and don't take a value.
- The preceding example shows three flags that take a string value (`--orgs`, `--toolsets`, and `--tools`) and one Boolean flag (`--allow-non-ga-tools`).  This configuration starts a DX MCP Server that enables all the MCP tools in the `orgs`, `metadata`, `data`, and `users` toolsets and a specific tool called `run_apex_tests`.  It also enables tools in these configured toolsets that aren't yet generally available. 

<details>
<summary>Reference: MCP Client Configurations</summary>

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
### Cursor

To configure [Cursor](https://cursor.com/docs/context/mcp) to work with Salesforce DX MCP Server, add this snippet to your Cursor `mcp.json` file:

```json
{
  "mcpServers": {
    "Salesforce DX": {
      "command": "npx",
      "args": ["-y", "@salesforce/mcp@latest", 
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
      "args": ["-y", "@salesforce/mcp@latest", 
               "--orgs", "DEFAULT_TARGET_ORG",
               "--toolsets", "orgs,metadata,data,users",
               "--tools", "run_apex_test",
               "--allow-non-ga-tools" ]
    }
  }
}
```

### Other MCP Clients

For these other clients, refer to their documentation for adding MCP servers and follow the same pattern as in the preceding examples to configure the Salesforce DX MCP Server:

- [Windsurf](https://docs.windsurf.com/windsurf/cascade/mcp)
- [Zed](https://github.com/zed-industries/zed)
- [Trae](https://docs.trae.ai/ide/model-context-protocol?_lang=en)

</details>
<details>
<summary>Reference: Available Flags for the `args` Option</summary>

## Available Flags for the "args" Option

These are the flags that you can pass to the `args` option. 

| Flag Name | Description | Required? |Notes |
| -----------------| -------| ------- | ----- |
| `--orgs` | One or more orgs that you've locally authorized. | Yes | You must specify at least one org. <br/> <br/>See [Configure Orgs](./README.md#configure-orgs) for the values you can pass to this flag. |
| `--toolsets` | Sets of tools, based on functionality, that you want to enable. | No | Set to "all" to enable every tool in every toolset. <br/> <br/>See [Configure Toolsets](./README.md#configure-toolsets) for the values you can pass to this flag.|
| `--tools` | Individual tool names that you want to enable. | No | You can use this flag in combination with the `--toolsets` flag. For example, you can enable all tools in one toolset, and just one tool in a different toolset. |
| `--no-telemetry` | Boolean flag to disable telemetry, the automatic collection of data for monitoring and analysis. | No | Telemetry is enabled by default, so specify this flag to disable it.  |
| `--debug` | Boolean flag that requests that the DX MCP Server print debug logs. | No | Debug mode is disabled by default. <br/> <br/>**NOTE:** Not all MCP clients expose MCP logs, so this flag might not work for all IDEs. |
| `--allow-non-ga-tools` | Boolean flag to allow the DX MCP Server to use both the generally available (GA) and NON-GA tools that are in the toolsets or tools you specify. | No | By default, the DX MCP server uses only the tools marked GA. |
| `--dynamic-tools` | (experimental) Boolean flag that enables dynamic tool discovery and loading. When specified, the DX MCP server starts with a minimal set of core tools and loads new tools as needed. | No| This flag is useful for reducing the initial context size and improving LLM performance. Dynamic tool discovery is disabled by default.<br/> <br/>**NOTE:** This feature works in VSCode and Cline but may not work in other environments.|

</details>
<details>

<summary>Reference: Configure Orgs</summary>

## Configure Orgs

The Salesforce MCP tools require an org, and so you must include the required `--orgs` flag to specify at least one authorized org when you configure the MCP server. Separate multiple values with commas.

You must explicitly [authorize the orgs](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_web_flow.htm) on your computer before the MCP server can access them. Use the `org login web` Salesforce CLI command or the VS Code **SFDX: Authorize an Org** command from the command palette.

These are the available values for the `--orgs` flag:

| --orgs Value | Description |
| -------- | ---------- |
| `DEFAULT_TARGET_ORG` | Allow access to your default org. If you've set a local default org in your DX project, the MCP server uses it. If not, the server uses a globally-set default org.|
| `DEFAULT_TARGET_DEV_HUB` | Allow access to your default Dev Hub org. If you've set a local default Dev Hub org in your DX project, the MCP server uses it. If not, the server uses a globally-set default Dev Hub org.|
| `ALLOW_ALL_ORGS` | Allow access to all authorized orgs. Use this value with caution.|
| `<username or alias>` | Allow access to a specific org by specifying its username or alias.|

</details>

<details>
<summary>Reference: Configure Toolsets and Tools</summary>

## Configure Toolsets

The Salesforce DX MCP Server supports **toolsets** - a way to selectively enable different groups of MCP tools based on your needs. This allows you to run the MCP server with only the tools you require, which in turn reduces the context.

Use the `--toolsets` flag to specify the toolsets when you configure the Salesforce DX MCP Server. Separate multiple toolsets with commas. 

These are the available toolsets.

| Toolset| Description|
| ----- | ----- |
| `all` | Enables all available tools from all toolsets. Use caution, this will load over 60 tools. |
| `orgs` | [Tools to manage your authorized orgs.](README.md#orgs-toolset)|
| `data` | [Tools to manage the data in your org, such as listing all accounts.](README.md#data-toolset)|
| `users` | [Tools to manage org users, such as assigning a permission set.](README.md#users-toolset)|
| `metadata` | [Tools to deploy and retrieve metadata to and from your org and your DX project.](README.md#metadata-toolset)|
| `testing` | [Tools to test your code and features](README.md#testing-toolset)|
| `other` | [Other useful tools, such as tools for static analysis of your code using Salesforce Code Analyzer.](README.md#other-toolset)|
| `mobile` | [Tools for mobile development and capabilities.](README.md#mobile-toolset)|
| `mobile-core` | [A subset of mobile tools focused on essential mobile capabilities.](README.md#mobile-core-toolset)|
| `aura-experts` | [Tools which provides Aura component analysis, blueprinting, and migration expertise.](README.md#aura-experts-toolset)|
| `lwc-experts`  | [Tools to assist with LWC development, testing, optimization, and best practices.](README.md#lwc-experts-toolset)|

## Configure Tools

The Salesforce DX MCP Server also supports registering individual **tools**. This can be used in combination with **toolsets** to further fine-tune registered tools.

Use the `--tools` flag to enable specific tools when you configure the Salesforce DX MCP Server. Separate multiple tools with commas. The `--tools` flag is optional.

The following sections list all the tools that are included in a specific toolset. The tools marked NON-GA are not yet generally available, specify the `--allow-non-ga-tools` flag to use them. 

### Core Toolset (always enabled)

- `get_username` - Determines the appropriate username or alias for Salesforce operations, handling both default orgs and Dev Hubs.
- `resume_tool_operation` - Resumes a long-running operation that wasn't completed by another tool.

### Orgs Toolset

- `list_all_orgs` - Lists all configured Salesforce orgs, with optional connection status checking.
- `create_org_snapshot` - (NON-GA) Create a scratch org snapshot. 
- `create_scratch_org` - (NON-GA) Create a scratch org. 
- `delete_org` - (NON-GA) Delete a locally-authorized Salesforce scratch org or sandbox.
- `org_open` - (NON-GA) Open an org in a browser. 

**NOTE:** The tools marked NON-GA are not yet generally available, specify the `--allow-non-ga-tools` flag to use them. 

### Data Toolset

- `run_soql_query` - Runs a SOQL query against a Salesforce org.

### Users Toolset

- `assign_permission_set` - Assigns a permission set to the user or on behalf of another user.

### Metadata Toolset

- `deploy_metadata` - Deploys metadata from your DX project to an org.
- `retrieve_metadata` - Retrieves metadata from your org to your DX project.

### Testing Toolset

- `run_agent_test` - Executes agent tests in your org.
- `run_apex_test` - Executes apex tests in your org.

### Mobile Toolset

- `create_mobile_lwc_app_review` - Provides TypeScript API documentation for Salesforce LWC App Review Service, offering expert guidance for implementing app review features in Lightning Web Components.
- `create_mobile_lwc_ar_space_capture` - Provides TypeScript API documentation for Salesforce L    WC AR Space Capture, offering expert guidance for implementing AR space capture features in Lightning Web Components.
- `create_mobile_lwc_barcode_scanner` - Provides TypeScript API documentation for Salesforce LWC Barcode Scanner, offering expert guidance for implementing barcode scanning features in Lightning Web Components.
- `create_mobile_lwc_biometrics` - Provides TypeScript API documentation for Salesforce LWC Biometrics Service, offering expert guidance for implementing biometric authentication features in Lightning Web Components.
- `create_mobile_lwc_calendar` - Provides TypeScript API documentation for Salesforce LWC Calendar Service, offering expert guidance for implementing calendar integration features in Lightning Web Components.
- `create_mobile_lwc_contacts` - Provides TypeScript API documentation for Salesforce LWC Contacts Service, offering expert guidance for implementing contacts management features in Lightning Web Components.
- `create_mobile_lwc_document_scanner` - Provides TypeScript API documentation for Salesforce LWC Document Scanner, offering expert guidance for implementing document scanning features in Lightning Web Components.
- `create_mobile_lwc_geofencing` - Provides TypeScript API documentation for Salesforce LWC Geofencing Service, offering expert guidance for implementing geofencing features in Lightning Web Components.
- `create_mobile_lwc_location` - Provides TypeScript API documentation for Salesforce LWC Location Service, offering expert guidance for implementing location services in Lightning Web Components.
- `create_mobile_lwc_nfc` - Provides TypeScript API documentation for Salesforce LWC NFC Service, offering expert guidance for implementing NFC features in Lightning Web Components.
- `create_mobile_lwc_payments` - Provides TypeScript API documentation for Salesforce LWC Payments Service, offering expert guidance for implementing payment processing features in Lightning Web Components.
- `get_mobile_lwc_offline_analysis` - Analyzes Lightning Web Components for mobile-specific issues and provides detailed recommendations for mobile offline compatibility and performance improvements.
- `get_mobile_lwc_offline_guidance` - Provides structured review instructions to detect and remediate mobile offline code violations in Lightning Web Components for Salesforce Mobile Apps.

### Mobile-core Toolset

- `create_mobile_lwc_barcode_scanner` - Provides TypeScript API documentation for Salesforce LWC Barcode Scanner, offering expert guidance for implementing barcode scanning features in Lightning Web Components.
- `create_mobile_lwc_biometrics` - Provides TypeScript API documentation for Salesforce LWC Biometrics Service, offering expert guidance for implementing biometric authentication features in Lightning Web Components.
- `create_mobile_lwc_location` - Provides TypeScript API documentation for Salesforce LWC Location Service, offering expert guidance for implementing location services in Lightning Web Components.
- `get_mobile_lwc_offline_analysis` - Analyzes Lightning Web Components for mobile-specific issues and provides detailed recommendations for mobile offline compatibility and performance improvements.
- `get_mobile_lwc_offline_guidance` - Provides structured review instructions to detect and remediate mobile offline code violations in Lightning Web Components for Salesforce Mobile Apps.

### Aura Experts Toolset

 - `create_aura_blueprint_draft` - (GA)
Creates a comprehensive Product Requirements Document (PRD) blueprint for Aura component migration. Analyzes Aura component files and generates framework-agnostic specifications suitable for LWC migration, including business requirements, technical patterns, and migration guidelines.

 - `enhance_aura_blueprint_draft` - (GA)
Enhances an existing draft PRD with expert analysis and unknown resolution. Takes a draft blueprint and applies specialized Aura expert knowledge to resolve dependencies, add technical insights, and improve the migration specifications for better LWC implementation guidance.

 - `transition_prd_to_lwc` - (GA)
Provides migration bridge guidance for creating LWC components from Aura specifications. Takes the enhanced PRD and generates specific implementation guidance, platform service mappings, and step-by-step instructions for building the equivalent LWC component.

 - `orchestrate_aura_migration` - (GA)
Orchestrates the complete Aura to LWC migration workflow. Provides end-to-end guidance for the entire migration process, from initial analysis through final implementation, including best practices, tooling recommendations, and quality assurance steps.

### Lwc Experts Toolset

#### Component Development

 - `create_lwc_component_from_prd` - (GA) Creates complete LWC components from PRD specifications with proper structure and best practices
 - `create_lwc_jest_tests` - (GA) Generates comprehensive Jest test suites for LWC components with coverage and mocking
 - `review_lwc_jest_tests` - (GA) Reviews and validates Jest test implementations for LWC components

#### Development Guidelines

 - `guide_lwc_accessibility` - (GA) Provides accessibility guidelines and testing instructions for LWC components
 - `guide_lwc_best_practices` - (GA) Offers LWC development best practices and coding standards guidance
 - `guide_lwc_development` - (GA) Comprehensive LWC development workflow and implementation guidelines
 - `guide_lwc_rtl_support` - (GA) Right-to-Left internationalization support and RTL development guidance
 - `guide_lwc_slds2_uplift_linter_fixes` - (NON-GA) Analyzes the given LWC code along with the slds-linter output to fix issues using the SLDS2 knowledge
 - `guide_lwc_security` - (GA) Comprehensive security analysis in accordance with Product Security Guidelines and Lightning Web Security Guidelines
 - `guide_design_general` - (GA) Comprehensive SLDS guidelines and best practices for Lightning Web Components with accessibility, responsive design, and component usage patterns

#### Workflow Tools

 - `orchestrate_lwc_component_creation` - (GA) Step-by-step component creation workflow guidance
 - `orchestrate_lwc_component_optimization` - (GA)  Performance optimization and best practices for LWC components
 - `orchestrate_lwc_component_testing` - (GA) Comprehensive testing workflow and test generation guidance
 - `orchestrate_lwc_slds2_uplift` - (NON-GA) Migration guidance for upgrading to SLDS2 design system

#### LDS (Lightning Data Service) Tools

 - `explore_lds_uiapi` - (GA) Explores and documents Lightning Data Service UI API capabilities
 - `guide_lds_data_consistency` - (GA) Data consistency patterns and best practices for LDS components
 - `guide_lds_development` - (GA) LDS development guidelines and component integration
 - `guide_lds_referential_integrity` - (GA) Referential integrity patterns for LDS data management
 - `orchestrate_lds_data_requirements` - (GA) Step-by-step guidance for analyzing and clarifying LDS data requirements to produce PRD-ready specifications.
 - `create_lds_graphql_read_query` - (GA) Create GraphQL read queries for LDS
 - `explore_lds_graphql_schema` - (GA) Explore GraphQL schema structure for Salesforce LDS
 - `guide_lds_graphql` - (GA) LDS GraphQL usage patterns and guidelines

#### Migration & Integration Tools

 - `verify_aura_migration_completeness` - (GA) Aura to LWC migration completeness checklist and validation
 - `guide_figma_to_lwc_conversion` - (GA) Converts Figma designs to LWC component specifications
 - `run_lwc_accessibility_jest_tests` - (GA) Accessibility testing utilities and Jest integration for LWC components

### Code-Analysis Toolset

- `run_code_analyzer` - (NON-GA) Performs a static analysis of your code using Salesforce Code Analyzer. Includes validating that the code conforms to best practices, checking for security vulnerabilities, and identifying possible performance issues.
- `describe_code_analyzer_rule` - (NON-GA) Gets the description of a Salesforce Code Analyzer rule, including the engine it belongs to, its severity, and associated tags.

</details>
