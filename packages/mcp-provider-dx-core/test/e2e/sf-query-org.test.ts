/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import path from 'node:path';
import { expect } from 'chai';
import { McpTestClient, TransportFactory } from '@salesforce/mcp-test-client';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { z } from 'zod';
import { queryOrgParamsSchema } from '../../src/tools/sf-query-org.js';

describe('sf-query-org', () => {
  const client = new McpTestClient({
    name: 'sf-query-org-e2e-test',
    version: '1.0.0',
    timeout: 120_000 // 2 minutes for query operations
  });

  let testSession: TestSession;
  let orgUsername: string;

  const queryOrgSchema = {
    name: z.literal('sf-query-org'),
    params: queryOrgParamsSchema
  };

  before(async () => {
    try {
      testSession = await TestSession.create({
        project: { gitClone: 'https://github.com/trailheadapps/dreamhouse-lwc' },
        scratchOrgs: [{ setDefault: true, config: path.join('config', 'project-scratch-def.json') }],
        devhubAuthStrategy: 'AUTO',
      });

      execCmd(`project deploy start`, {
        cli: 'sf',
        ensureExitCode: 0
      })

      execCmd('org assign permset -n dreamhouse', {
        cli: 'sf',
        ensureExitCode: 0
      })

      execCmd(`data tree import -p ${path.join(testSession.project.dir, 'data','sample-data-plan.json')}`, {
        cli: 'sf',
        ensureExitCode: 0
      })

      orgUsername = [...testSession.orgs.keys()][0];

      // Create stdio transport to start the MCP server
      const transport = TransportFactory.createStdio({
        command: process.env.SF_MCP_SERVER_BIN ?? 'sf-mcp-server',
        args: ['--orgs', 'ALLOW_ALL_ORGS','--toolsets','all' ],
        // args: [path.join(process.cwd(), '..', '..', '..', 'mcp', 'bin', 'run.js'), '-o', orgUsername, '--no-telemetry'],
        // this is needed because testkit sets it when transferring the hub auth and creating a scratch.
        // Without it you get a keychain error/silent failure because the server will look for orgUsername
        // in the OS keychain but testkit modifies the home dir in the process so all auth is in the test dir.
        // TODO: this should be a default (and customizable)
        env: {
          SF_USE_GENERIC_UNIX_KEYCHAIN: 'true'
        }
      });

      await client.connect(transport);
    } catch (error) {
      console.error('Setup failed:', error);
      throw error;
    }
  });

  after(async () => {
    await testSession.clean();

    if (client.connected) {
      await client.disconnect();
    }
  });

  it('should query standard objects using regular API', async () => {
    const result = await client.callTool(queryOrgSchema, {
      name: 'sf-query-org',
      params: {
        query: 'SELECT Name FROM Broker__c ORDER BY Name',
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
        useToolingApi: false
      }
    });

    expect(result.isError).to.equal(false);
    expect(result.content.length).to.equal(1);
    expect(result.content[0].type).to.equal('text');
    
    const responseText = result.content[0].text;
    expect(responseText).to.contain('SOQL query results:');
    
    // Parse the query result JSON
    // @ts-ignore
    const queryMatch = responseText.match(/SOQL query results:\s*({[\s\S]*})/);
    expect(queryMatch).to.not.be.null;
    
    const queryResult = JSON.parse(queryMatch![1]);
    expect(queryResult.totalSize).to.equal(8);
    expect(queryResult.done).to.be.true;
    expect(queryResult.records).to.be.an('array');
    expect(queryResult.records.length).to.equal(8);
    
    // Verify all broker names are exactly as expected
    const expectedBrokerNames = [
      'Caroline Kingsley',
      'Jennifer Wu', 
      'Jonathan Bradley',
      'Michael Jones',
      'Michelle Lambert',
      'Miriam Aupont',
      'Olivia Green',
      'Victor Ochoa'
    ];
    
    const actualBrokerNames = queryResult.records.map((record: any) => record.Name).sort();
    expect(actualBrokerNames).to.deep.equal(expectedBrokerNames.sort());
  });

  it('should query ApexClass using the Tooling API', async () => {
    const result = await client.callTool(queryOrgSchema, {
      name: 'sf-query-org',
      params: {
        query: "SELECT Status FROM ApexClass WHERE Name='FileUtilities'",
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
        useToolingApi: true
      }
    });

    console.log(JSON.stringify(result,null,2))
    expect(result.isError).to.equal(false);
    expect(result.content.length).to.equal(1);
    expect(result.content[0].type).to.equal('text');
    
    const responseText = result.content[0].text;
    expect(responseText).to.contain('SOQL query results:');
    
    // Parse the query result JSON
    // @ts-ignore
    const queryMatch = responseText.match(/SOQL query results:\s*({[\s\S]*})/);
    expect(queryMatch).to.not.be.null;
    
    const queryResult = JSON.parse(queryMatch![1]);
    expect(queryResult.done).to.be.true;
    expect(queryResult.records).to.be.an('array');
    expect(queryResult.records.length).to.equal(1);
    expect(queryResult.totalSize).to.equal(1);
    
    // Verify FileUtilities ApexClass record
    const fileUtilitiesClass = queryResult.records[0];
    expect(fileUtilitiesClass).to.have.property('Status');
    expect(fileUtilitiesClass.Status).to.equal('Active');
  });

  it.skip('should handle invalid SOQL query gracefully', async () => {
    const result = await client.callTool(queryOrgSchema, {
      name: 'sf-query-org',
      params: {
        query: 'SELECT InvalidField FROM NonExistentObject',
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
        useToolingApi: false
      }
    });

    expect(result.content.length).to.equal(1);
    expect(result.content[0].type).to.equal('text');
    
    const responseText = result.content[0].text;
    expect(responseText).to.contain('Failed to query org:');
    expect(result.isError).to.be.true;
  });

  it.skip('should handle missing usernameOrAlias parameter', async () => {
    const result = await client.callTool(queryOrgSchema, {
      name: 'sf-query-org',
      params: {
        query: 'SELECT Id FROM User LIMIT 1',
        usernameOrAlias: '', // Empty username
        directory: testSession.project.dir
      }
    });

    expect(result.content.length).to.equal(1);
    expect(result.content[0].type).to.equal('text');
    
    const responseText = result.content[0].text;
    expect(responseText).to.contain('The usernameOrAlias parameter is required');
    expect(responseText).to.contain('#sf-get-username tool');
    expect(result.isError).to.be.true;
  });
});
