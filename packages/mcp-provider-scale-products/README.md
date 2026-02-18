# MCP Provider - Scale Products

**For Internal Use Only**

This npm package is currently for internal use only. Its contents may change at any time with no guarantee of compatibility with prior versions.

## Overview

This package provides MCP tools that scan Apex code for performance antipatterns and deliver actionable fix recommendations. When connected to a Salesforce org with ApexGuru enabled, detections are enriched with production runtime metrics so severity reflects real-world impact rather than static heuristics alone.

## Tools

### `scan_apex_class_for_antipatterns`

Scans an Apex class file (`.cls` or `.trigger`) and returns detected antipatterns grouped by type, each with severity and fix instructions.

**Detected Antipatterns:**

| Antipattern | What it detects | Example |
|---|---|---|
| **GGD** | `Schema.getGlobalDescribe()` calls (higher severity inside loops) | Replace with `Type.forName()` or direct SObject token |
| **SOQL_NO_WHERE_LIMIT** | SOQL queries missing both `WHERE` and `LIMIT` clauses | Add filtering or row limits to prevent governor limit issues |
| **SOQL_UNUSED_FIELDS** | SOQL queries selecting fields that are never referenced in code | Remove unused fields to reduce query cost |

**Input Parameters:**

| Parameter | Required | Description |
|---|---|---|
| `className` | Yes | Name of the Apex class (e.g., `AccountController`) |
| `apexFilePath` | Yes | Absolute path to the `.cls` or `.trigger` file |
| `directory` | Yes | Absolute path to the working directory (your SFDX project root) |
| `usernameOrAlias` | No | Salesforce org username or alias for runtime insights (see [Org Setup](#org-setup-for-runtime-insights)) |
| `identifier` | No | Unique identifier for this scan (defaults to `className`) |

**Output:**

The tool returns detections grouped by antipattern type. Each group contains a `fixInstruction` (how to fix the antipattern) and an array of `detectedInstances`:

```json
{
  "antipatternResults": [
    {
      "antipatternType": "GGD",
      "fixInstruction": "## Fix Schema.getGlobalDescribe() ...",
      "detectedInstances": [
        {
          "className": "MyClass",
          "methodName": "myMethod",
          "lineNumber": 5,
          "codeBefore": "Schema.SObjectType t = Schema.getGlobalDescribe().get('Account');",
          "severity": "major"
        }
      ]
    }
  ]
}
```

Each instance includes `severity` (minor / major / critical). When runtime metrics are available, severity is derived from production data and marked with a bulb icon in the formatted output.

## Org Setup for Runtime Insights

Without an org connection the tool runs **static analysis only** — it still detects all antipatterns but assigns severity based on code structure (e.g., inside a loop = higher severity).

To unlock **runtime-aware severity** powered by ApexGuru, the tool needs access to a Salesforce org. You have two options:

1. **Set a default target org** so every invocation uses it automatically:
   ```bash
   sf config set target-org myOrg@example.com
   ```

2. **Pass the org explicitly** by including the username or alias in your prompt when invoking the tool (the `usernameOrAlias` parameter).

> **Prerequisite:** The org must have ApexGuru / the Scale Center suite enabled. If runtime data returns an access-denied error, contact Salesforce Support to enable it.

## Severity Levels

| Level | Meaning |
|---|---|
| **Minor** | Low-impact issue; fix when convenient |
| **Major** | Moderate performance risk; should be addressed |
| **Critical** | High-impact hotspot; fix with priority |

When runtime metrics are available (org connected + ApexGuru enabled), severity is calculated from actual production execution data rather than static heuristics.

## Development

Ensure you are in the monorepo root or the package directory.

```bash
# Install
yarn install

# Build
yarn workspace @salesforce/mcp-provider-scale-products build

# Test
yarn workspace @salesforce/mcp-provider-scale-products test

# Test with coverage
node node_modules/vitest/vitest.mjs run --coverage

# Lint
yarn workspace @salesforce/mcp-provider-scale-products lint

# Clean
yarn workspace @salesforce/mcp-provider-scale-products clean
```

## License

Apache-2.0
