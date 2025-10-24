# MCP Test Client

A type-safe MCP (Model Context Protocol) client designed specifically for testing scenarios. This library provides a simplified interface for calling MCP tools with Zod schema validation, making it easy to write robust tests without built-in assertions.

## Features

- **Type-safe tool calling**: Use Zod schemas to define tool parameters with full TypeScript support
- **Test runner agnostic**: No built-in assertions - works with any test framework (Jest, Vitest, Mocha, etc.)
- **DxMcpTransport**: Helper transport wrapper for Salesforce DX MCP server

## Installation

Add `@salesforce/mcp-test-client` as a dev dependency in your tool provider package.

## Quick Start

### Salesforce E2E Testing with TestKit

```typescript
import path from 'node:path';
import { expect } from 'chai';
import { McpTestClient, DxMcpTransport } from '@salesforce/mcp-test-client';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { z } from 'zod';
import { ensureString } from '@salesforce/ts-types';

describe('Salesforce Tool E2E Test', () => {
  const client = new McpTestClient({
    timeout: 300_000 // 5 minutes
  });

  let testSession: TestSession;
  let orgUsername: string;

  const toolSchema = {
    name: z.literal('sf-deploy-metadata'),
    params: z.object({
      usernameOrAlias: z.string(),
      directory: z.string()
    })
  };

  before(async () => {
    // Create test session with Salesforce project and scratch org
    testSession = await TestSession.create({
      project: { gitClone: 'https://github.com/trailheadapps/dreamhouse-lwc' },
      scratchOrgs: [{ setDefault: true, config: path.join('config', 'project-scratch-def.json') }],
      devhubAuthStrategy: 'AUTO',
    });

    orgUsername = [...testSession.orgs.keys()][0];

    // Connect MCP client with DX MCP transport helper
    const transport = DxMcpTransport({
      orgUsername: ensureString(orgUsername)
    });

    await client.connect(transport);
  });

  after(async () => {
    if (client?.connected) {
      await client.disconnect();
    }
    if (testSession) {
      await testSession.clean();
    }
  });

  it('should deploy metadata', async () => {
    const result = await client.callTool(toolSchema, {
      name: 'sf-deploy-metadata',
      params: {
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir
      }
    });

    expect(result.isError).to.equal(false);
    expect(result.content[0].text).to.contain('Deploy result:');
  });
});
```

## License

Apache-2.0
