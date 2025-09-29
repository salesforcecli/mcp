# mcp

MCP Server for Interacting with Salesforce Orgs

[![NPM](https://img.shields.io/npm/v/@salesforce/mcp.svg?label=@salesforce/mcp)](https://www.npmjs.com/package/@salesforce/mcp) [![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/license/apache-2-0)

## Feedback

 Report bugs and issues [here](https://github.com/forcedotcom/mcp/issues).  
For feature requests and other related topics, start a Discussion [here](https://github.com/forcedotcom/mcp/discussions).  

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

### Agentforce for Developers Includes the Salesforce DX MCP Server

Agentforce for Developers is an AI-powered Salesforce developer tool that's available as an easy-to-install Visual Studio Code (VS Code) extension. It includes Dev Agent (developer preview), an intelligent coding partner that provides information and, most importantly, can take action. Through agentic chat powered by MCP, Dev Agent can execute commands and perform complex workflows automatically, right from within VS Code.

The Salesforce DX MCP server is pre-configured in Agentforce for Developers, so you can start using the DX MCP tools immediately after you install the extension in VS Code. 

See [Set Up Agentforce for Developers](https://developer.salesforce.com/docs/platform/einstein-for-devs/guide/einstein-setup.html) and [Chat with Dev Agent (Dev Preview)](https://developer.salesforce.com/docs/platform/einstein-for-devs/guide/devagent-overview.html) for more information. 

## Get Started Using VS Code as the Client

Want to jump in and see what all the fuss is about? Read on!

This example uses Visual Studio Code (VS Code) as the MCP client. After you configure it with the Salesforce DX MCP Server, you then use GitHub Copilot and natural language to easily execute typical Salesforce DX development tasks, such as listing your authorized orgs, viewing org records, and deploying or retrieving metadata.

But you're not limited to using only VS Code and Copilot as the MCP client! As already mentioned, you can use [Agentforce for Developers](README.md#agentforce-for-developers-includes-the-salesforce-dx-mcp-server), which is pre-configured with the DX MCP server.  Or you can [configure many other clients](README.md#configure-other-clients-to-use-the-salesforce-dx-mcp-server) to use the Salesforce DX MCP Server, such as Cursor, Cline, Claude Desktop, Zed, Windsurf, and more. 

**Before You Begin**

For the best getting-started experience, make sure that you have a Salesforce DX environment set up on your computer. In particular:

- [Install Salesforce CLI](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_intro.htm) on your computer.
- [Install VS Code](https://code.visualstudio.com/docs) on your computer.
- [Create a Salesforce DX project](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_create_new.htm) and open it in VS Code. You can also clone an example repo, such as [dreamhouse-lwc](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_intro_sample_repo.htm), which is a ready-to-use DX project that contains a simple Salesforce application, with metadata and test data.
- [Authorize at least one Salesforce org](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_web_flow.htm) to use with your DX project. You can also create a scratch org.

**Let's Do It**

1. Create a `.vscode/mcp.json` file at the root of your DX project and add this JSON:

   ```json
   {
     "servers": {
       "Salesforce DX": {
         "type": "stdio",
         "command": "npx",
         "args": ["-y", "@salesforce/mcp", "--orgs", "DEFAULT_TARGET_ORG", "--toolsets", "all"]
       }
     }
   }
   ```

   You can also configure the MCP server globally by editing the VS Code [settings.json](https://code.visualstudio.com/docs/configure/settings#_settings-file-locations) file and adding a similar JSON snippet but contained in an `mcp:servers` section.

   The `--orgs` flag is required and specifies the authorized orgs you're allowing the MCP server to access. The `--toolsets` and `--tools` flags are used to specify which tools the server will start with. See [Configure the DX MCP Server](README.md#configure-the-dx-mcp-server) for the available values for these flags.

1. Open VS Code, go to **View -> Command Palette** and enter **MCP: List Servers**.

   TIP: You can also get to the command palette by pressing press Ctrl+Shift+P (Windows or Linux) or Command-Shift-P (macOS).

1. Click `Salesforce DX`, then **Start Server**.

   Check the Output tab for the server status.

1. Run **Chat: Open Chat (Agent)** from the command palette to start a new GitHub Copilot chat session.

   Be sure your Copilot chat window is in `Agent` mode; if you're in `Ask` or `Edit` mode, use the [little drop-down](https://github.blog/ai-and-ml/github-copilot/copilot-ask-edit-and-agent-modes-what-they-do-and-when-to-use-them/) to switch.

1. In the GitHub Copilot chat window, use natural language to explain what you want to do. The MCP server determines which configured tool to use, and then shows it to you along with other information. Click **Continue** to run the tool and see the results of your request.

   Try out these examples:

   - List all my orgs.
   - Which are my active scratch orgs?
   - Show me all the accounts in the org with alias my-org.
   - Deploy everything in my project to the org with alias my-org.
   - Do you see any performance or security issues with the Apex code in the `MyApexClass.cls` file?
   - I see that my Apex code violates the pmd:ApexCRUDViolation rule; can you give me more information about this rule?

1. To stop, restart, or view the MCP server configuration, run the **MCP: List Servers** command, click `Salesforce DX`, then click the appropriate option.

## Configure the DX MCP Server

Configure the Salesforce DX MCP Server by passing flags to the `args` option. Surround the flag name and its value each in double quotes, and separate all flags and values with commas. Some flags are Boolean and don't take a value. 

This example shows two flags that take a string value (`--orgs` and `--toolsets`) and one Boolean flag (`--allow-non-ga-tools`):

```
     "servers": {
       "Salesforce DX": {
         "type": "stdio",
         "command": "npx",
         "args": ["-y", "@salesforce/mcp", "--orgs", "DEFAULT_TARGET_ORG", "--toolsets", "all", "--allow-non-ga-tools"]
       }
     }
```
The `"-y", "@salesforce/mcp"` part tells `npx` to automatically install the `@salesforce/mcp` package instead of asking permission. Don't change this. 

These are the available flags that you can pass to the `args` option. 

| Flag Name | Description | Required? |Notes |
| -----------------| -------| ------- | ----- |
| `--orgs` | One or more orgs that you've locally authorized. | Yes | You must specify at least one org. <br/> <br/>See [Configure Orgs](README.md#configure-orgs) for the values you can pass to this flag. |
| `--toolsets` | Sets of tools, based on functionality, that you want to enable. | No | Set to "all" to enable every tool in every toolset. <br/> <br/>See [Configure Toolsets](README.md#configure-toolsets) for the values you can pass to this flag.|
| `--tools` | Individual tool names that you want to enable. | No | You can use this flag in combination with the `--toolsets` flag. For example, you can enable all tools in one toolset, and just one tool in a different toolset. |
| `--no-telemetry` | Boolean flag to disable telemetry, the automatic collection of data for monitoring and analysis. | No | Telemetry is enabled by default, so specify this flag to disable it.  |
| `--debug` | Boolean flag that requests that the DX MCP Server print debug logs. | No | Debug mode is disabled by default. <br/> <br/>**NOTE:** Not all MCP clients expose MCP logs, so this flag might not work for all IDEs. |
| `--allow-non-ga-tools` | Boolean flag to allow the DX MCP Server to use both the generally available (GA) and NON-GA tools that are in the toolsets or tools you specify. | No | By default, the DX MCP server uses only the tools marked GA. |
| `--dynamic-tools` | (experimental) Boolean flag that enables dynamic tool discovery and loading. When specified, the DX MCP server starts with a minimal set of core tools and loads new tools as needed. | No| This flag is useful for reducing the initial context size and improving LLM performance. Dynamic tool discovery is disabled by default.<br/> <br/>**NOTE:** This feature works in VSCode and Cline but may not work in other environments.|

### Configure Orgs

The Salesforce MCP tools require an org, and so you must include the required `--orgs` flag to specify at least one authorized org when you configure the MCP server. Separate multiple values with commas.

You must explicitly [authorize the orgs](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_web_flow.htm) on your computer before the MCP server can access them. Use the `org login web` Salesforce CLI command or the VS Code **SFDX: Authorize an Org** command from the command palette.

These are the available values for the `--orgs` flag:

- `DEFAULT_TARGET_ORG` - Allow access to your default org. If you've set a local default org in your DX project, the MCP server uses it. If not, the server uses a globally-set default org.
- `DEFAULT_TARGET_DEV_HUB` - Allow access to your default Dev Hub org. If you've set a local default Dev Hub org in your DX project, the MCP server uses it. If not, the server uses a globally-set default Dev Hub org.
- `ALLOW_ALL_ORGS` - Allow access to all authorized orgs. Use this value with caution.
- `<username or alias>` - Allow access to a specific org by specifying its username or alias.

This example shows how to specify that the MCP tools run against your default org when you configure the MCP server for VS Code:

```json
       "servers": {
         "Salesforce DX": {
           "type": "stdio",
           "command": "npx",
           "args": ["-y", "@salesforce/mcp", "--orgs", "DEFAULT_TARGET_ORG"]
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

Use the `--toolsets` flag to specify the toolsets when you configure the Salesforce DX MCP Server. Separate multiple toolsets with commas. Set `--toolsets` to `all` to register every available toolset.

These are the available toolsets.

| Toolset| Description|
| ----- | ----- |
| `all` | Enables all available tools from all toolsets. |
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

This example shows how to enable the `data`, `orgs`, `metadata`, and `other` toolsets when configuring the MCP server for VS Code:

```json
       "servers": {
         "Salesforce DX": {
           "type": "stdio",
           "command": "npx",
           "args": ["-y", "@salesforce/mcp", "--orgs", "DEFAULT_TARGET_ORG", "--toolsets", "data,orgs,metadata,other"]
         }
       }
```

### Configure Tools

The Salesforce DX MCP Server also supports registering individual **tools**. This can be used in combination with **toolsets** to further fine-tune registered tools.

Use the `--tools` flag to enable specific tools when you configure the Salesforce DX MCP Server. Separate multiple tools with commas. The `--tools` flag is optional.

This example shows how to enable the `orgs` and `metadata` toolsets, as well as the `run_soql_query` and `run_apex_test` tools when configuring the MCP server for VS Code:

```json
       "servers": {
         "Salesforce DX": {
           "type": "stdio",
           "command": "npx",
           "args": [
              "-y",
              "@salesforce/mcp", 
              "--orgs", 
              "DEFAULT_TARGET_ORG", 
              "--toolsets",
              "orgs,metadata"
              "--tools",
              "run_soql_query,run_apex_test"
            ]
         }
       }
```


#### Core Toolset (always enabled)

Includes these tools:

- `get_username` - Determines the appropriate username or alias for Salesforce operations, handling both default orgs and Dev Hubs.
- `resume_tool_operation` - Resumes a long-running operation that wasn't completed by another tool.

#### Orgs Toolset

Includes these tools:

- `list_all_orgs` - Lists all configured Salesforce orgs, with optional connection status checking.
- `create_org_snapshot` - (NON-GA) Create a scratch org snapshot. 
- `create_scratch_org` - (NON-GA) Create a scratch org. 
- `delete_org` - (NON-GA) Delete a locally-authorized Salesforce scratch org or sandbox.
- `org_open` - (NON-GA) Open an org in a browser. 

**NOTE:** The tools marked NON-GA are not yet generally available, specify the `--allow-non-ga-tools` flag to use them. 

#### Data Toolset

Includes this tool:

- `run_soql_query` - Runs a SOQL query against a Salesforce org.

#### Users Toolset

Includes this tool:

- `assign_permission_set` - Assigns a permission set to the user or on behalf of another user.

#### Metadata Toolset

Includes these tools:

- `deploy_metadata` - Deploys metadata from your DX project to an org.
- `retrieve_metadata` - Retrieves metadata from your org to your DX project.

#### Testing Toolset

Includes these tools:

- `run_agent_test` - Executes agent tests in your org.
- `run_apex_test` - Executes apex tests in your org.

#### Mobile Toolset

Includes these tools, which aren't yet generally available:

- `create_mobile_lwc_app_review` - (NON-GA) Provides TypeScript API documentation for Salesforce LWC App Review Service, offering expert guidance for implementing app review features in Lightning Web Components.
- `create_mobile_lwc_ar_space_capture` - (NON-GA) Provides TypeScript API documentation for Salesforce L    WC AR Space Capture, offering expert guidance for implementing AR space capture features in Lightning Web Components.
- `create_mobile_lwc_barcode_scanner` - (NON-GA) Provides TypeScript API documentation for Salesforce LWC Barcode Scanner, offering expert guidance for implementing barcode scanning features in Lightning Web Components.
- `create_mobile_lwc_biometrics` - (NON-GA) Provides TypeScript API documentation for Salesforce LWC Biometrics Service, offering expert guidance for implementing biometric authentication features in Lightning Web Components.
- `create_mobile_lwc_calendar` - (NON-GA) Provides TypeScript API documentation for Salesforce LWC Calendar Service, offering expert guidance for implementing calendar integration features in Lightning Web Components.
- `create_mobile_lwc_contacts` - (NON-GA) Provides TypeScript API documentation for Salesforce LWC Contacts Service, offering expert guidance for implementing contacts management features in Lightning Web Components.
- `create_mobile_lwc_document_scanner` - (NON-GA) Provides TypeScript API documentation for Salesforce LWC Document Scanner, offering expert guidance for implementing document scanning features in Lightning Web Components.
- `create_mobile_lwc_geofencing` - (NON-GA) Provides TypeScript API documentation for Salesforce LWC Geofencing Service, offering expert guidance for implementing geofencing features in Lightning Web Components.
- `create_mobile_lwc_location` - (NON-GA) Provides TypeScript API documentation for Salesforce LWC Location Service, offering expert guidance for implementing location services in Lightning Web Components.
- `create_mobile_lwc_nfc` - (NON-GA) Provides TypeScript API documentation for Salesforce LWC NFC Service, offering expert guidance for implementing NFC features in Lightning Web Components.
- `create_mobile_lwc_payments` - (NON-GA) Provides TypeScript API documentation for Salesforce LWC Payments Service, offering expert guidance for implementing payment processing features in Lightning Web Components.
- `get_mobile_lwc_offline_analysis` - (NON-GA) Analyzes Lightning Web Components for mobile-specific issues and provides detailed recommendations for mobile offline compatibility and performance improvements.
- `get_mobile_lwc_offline_guidance` - (NON-GA) Provides structured review instructions to detect and remediate mobile offline code violations in Lightning Web Components for Salesforce Mobile Apps.

**NOTE:** The tools marked NON-GA are not yet generally available, specify the `--allow-non-ga-tools` flag to use them. 

#### Mobile-core Toolset

Includes these essential mobile tools, which aren't yet generally available:

- `create_mobile_lwc_barcode_scanner` - (NON-GA) Provides TypeScript API documentation for Salesforce LWC Barcode Scanner, offering expert guidance for implementing barcode scanning features in Lightning Web Components.
- `create_mobile_lwc_biometrics` - (NON-GA) Provides TypeScript API documentation for Salesforce LWC Biometrics Service, offering expert guidance for implementing biometric authentication features in Lightning Web Components.
- `create_mobile_lwc_location` - (NON-GA) Provides TypeScript API documentation for Salesforce LWC Location Service, offering expert guidance for implementing location services in Lightning Web Components.
- `get_mobile_lwc_offline_analysis` - (NON-GA) Analyzes Lightning Web Components for mobile-specific issues and provides detailed recommendations for mobile offline compatibility and performance improvements.
- `get_mobile_lwc_offline_guidance` - (NON-GA) Provides structured review instructions to detect and remediate mobile offline code violations in Lightning Web Components for Salesforce Mobile Apps.

**NOTE:** The tools marked NON-GA are not yet generally available, specify the `--allow-non-ga-tools` flag to use them. 

#### Aura Experts Toolset

 - `create_aura_blueprint_draft` - (GA)
Creates a comprehensive Product Requirements Document (PRD) blueprint for Aura component migration. Analyzes Aura component files and generates framework-agnostic specifications suitable for LWC migration, including business requirements, technical patterns, and migration guidelines.

 - `enhance_aura_blueprint_draft` - (GA)
Enhances an existing draft PRD with expert analysis and unknown resolution. Takes a draft blueprint and applies specialized Aura expert knowledge to resolve dependencies, add technical insights, and improve the migration specifications for better LWC implementation guidance.

 - `transition_prd_to_lwc` - (GA)
Provides migration bridge guidance for creating LWC components from Aura specifications. Takes the enhanced PRD and generates specific implementation guidance, platform service mappings, and step-by-step instructions for building the equivalent LWC component.

 - `orchestrate_aura_migration` - (GA)
Orchestrates the complete Aura to LWC migration workflow. Provides end-to-end guidance for the entire migration process, from initial analysis through final implementation, including best practices, tooling recommendations, and quality assurance steps.

**NOTE:** The tools marked NON-GA are not yet generally available, specify the `--allow-non-ga-tools` flag to use them. 

#### Lwc Experts Toolset

##### Component Development
 - `create_lwc_component` - (GA) Creates complete LWC components from PRD specifications with proper structure and best practices
 - `create_lwc_jest_tests` - (GA) Generates comprehensive Jest test suites for LWC components with coverage and mocking
 - `review_lwc_jest_tests` - (GA) Reviews and validates Jest test implementations for LWC components

##### Development Guidelines
 - `guide_lwc_accessibility` - (GA) Provides accessibility guidelines and testing instructions for LWC components
 - `guide_lwc_best_practices` - (GA) Offers LWC development best practices and coding standards guidance
 - `guide_lwc_development` - (GA) Comprehensive LWC development workflow and implementation guidelines
 - `guide_lwc_rtl_support` - (GA) Right-to-Left internationalization support and RTL development guidance
 - `guide_lwc_slds2_uplift_linter_fixes` - (GA) Analyzes the given LWC code along with the slds-linter output to fix issues using the SLDS2 knowledge
 - `guide_lwc_security` - (GA) Comprehensive security analysis in accordance with Product Security Guidelines and Lightning Web Security Guidelines

##### Workflow Tools
 - `orchestrate_lwc_component_creation` - (GA) Step-by-step component creation workflow guidance
 - `orchestrate_lwc_component_optimization` - (GA)  Performance optimization and best practices for LWC components
 - `orchestrate_lwc_component_testing` - (GA) Comprehensive testing workflow and test generation guidance
 - `orchestrate_lwc_slds2_uplift` - (GA) Migration guidance for upgrading to SLDS2 design system

##### LDS (Lightning Design System) Tools
 - `explore_lds_uiapi` - (GA) Explores and documents Lightning Design System UI API capabilities
 - `guide_lds_data_consistency` - (GA) Data consistency patterns and best practices for LDS components
 - `guide_lds_development` - (GA) LDS development guidelines and component integration
 - `guide_lds_referential_integrity` - (GA) Referential integrity patterns for LDS data management
 - `orchestrate_lds_data_requirements` - (GA) Step-by-step guidance for analyzing and clarifying LDS data requirements to produce PRD-ready specifications.

##### Migration & Integration Tools
 - `verify_aura_migration_completeness` - (GA) Aura to LWC migration completeness checklist and validation
 - `guide_figma_to_lwc_conversion` - (GA) Converts Figma designs to LWC component specifications
 - `run_lwc_accessibility_jest_tests` - (GA) Accessibility testing utilities and Jest integration for LWC components

**NOTE:** The tools marked NON-GA are not yet generally available, specify the `--allow-non-ga-tools` flag to use them. 

#### Code-Analyzer Toolset

Includes these tools, which aren't yet generally available:

- `run_code_analyzer` - (NON-GA) Performs a static analysis of your code using Salesforce Code Analyzer. Includes validating that the code conforms to best practices, checking for security vulnerabilities, and identifying possible performance issues.
- `describe_code_analyzer_rule` - (NON-GA) Gets the description of a Salesforce Code Analyzer rule, including the engine it belongs to, its severity, and associated tags.


**NOTE:** The tools marked NON-GA are not yet generally available, specify the `--allow-non-ga-tools` flag to use them. 

## Configure Other Clients to Use the Salesforce DX MCP Server

**Cursor**

To configure [Cursor](https://www.cursor.com/) to work with Salesforce DX MCP Server, add this snippet to your Cursor `mcp.json` file:

```json
{
  "mcpServers": {
    "Salesforce DX": {
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
    "Salesforce DX": {
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
