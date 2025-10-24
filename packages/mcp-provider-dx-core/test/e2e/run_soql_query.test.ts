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
import { QueryResult, Record as jsforceRecord } from '@jsforce/jsforce-node';
import { expect, assert } from 'chai';
import { McpTestClient, DxMcpTransport } from '@salesforce/mcp-test-client';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { z } from 'zod';
import { ensureString } from '@salesforce/ts-types';
import { queryOrgParamsSchema } from '../../src/tools/run_soql_query.js';

describe('run_soql_query', () => {
  const client = new McpTestClient();

  let testSession: TestSession;
  let orgUsername: string;

  const queryOrgSchema = {
    name: z.literal('run_soql_query'),
    params: queryOrgParamsSchema,
  };

  before(async () => {
    try {
      testSession = await TestSession.create({
        project: { gitClone: 'https://github.com/trailheadapps/dreamhouse-lwc' },
        scratchOrgs: [{ setDefault: true, config: path.join('config', 'project-scratch-def.json') }],
        devhubAuthStrategy: 'AUTO',
      });

      execCmd('project deploy start', {
        cli: 'sf',
        ensureExitCode: 0,
      });

      execCmd('org assign permset -n dreamhouse', {
        cli: 'sf',
        ensureExitCode: 0,
      });

      execCmd(`data tree import -p ${path.join(testSession.project.dir, 'data', 'sample-data-plan.json')}`, {
        cli: 'sf',
        ensureExitCode: 0,
      });

      testSession.orgs.get('')?.orgId;
      orgUsername = [...testSession.orgs.keys()][0];

      const transport = DxMcpTransport({
        orgUsername: ensureString(orgUsername),
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
      name: 'run_soql_query',
      params: {
        query: 'SELECT Name FROM Broker__c ORDER BY Name',
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
        useToolingApi: false,
      },
    });

    expect(result.isError).to.equal(false);
    expect(result.content.length).to.equal(1);
    if (result.content[0].type !== 'text') assert.fail();

    const responseText = result.content[0].text;
    expect(responseText).to.contain('SOQL query results:');

    // Parse the query result JSON
    const queryMatch = responseText.match(/SOQL query results:\s*({[\s\S]*})/);
    expect(queryMatch).to.not.be.null;

    const queryResult = JSON.parse(queryMatch![1]) as QueryResult<jsforceRecord & { Name: string }>;
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
      'Victor Ochoa',
    ];

    const actualBrokerNames = queryResult.records.map((record) => record.Name).sort();
    expect(actualBrokerNames).to.deep.equal(expectedBrokerNames.sort());
  });

  it('should query ApexClass using the Tooling API', async () => {
    const result = await client.callTool(queryOrgSchema, {
      name: 'run_soql_query',
      params: {
        query: "SELECT SymbolTable from ApexClass where name='FileUtilities'",
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
        useToolingApi: true,
      },
    });

    expect(result.isError).to.equal(false);
    expect(result.content.length).to.equal(1);
    if (result.content[0].type !== 'text') assert.fail();

    const responseText = result.content[0].text;
    expect(responseText).to.contain('SOQL query results:');

    // Parse the query result JSON
    const queryMatch = responseText.match(/SOQL query results:\s*({[\s\S]*})/);
    expect(queryMatch).to.not.be.null;

    const queryResult = JSON.parse(queryMatch![1]) as QueryResult<jsforceRecord>;
    expect(queryResult.done).to.be.true;
    expect(queryResult.records).to.be.an('array');
    expect(queryResult.records.length).to.equal(1);
    expect(queryResult.totalSize).to.equal(1);

    // Verify FileUtilities ApexClass record
    const fileUtilitiesClass = queryResult.records[0] as {
      attributes: { type: string; url: string };
      SymbolTable: {
        id: string;
        name: string;
        methods: Array<{
          name: string;
          returnType: string;
          parameters: Array<{ name: string; type: string }>;
        }>;
        variables: Array<{ name: string; type: string }>;
      };
    };
    expect(fileUtilitiesClass).to.have.nested.property('attributes.type', 'ApexClass');
    expect(fileUtilitiesClass).to.have.nested.property('attributes.url').that.is.a('string');
    expect(fileUtilitiesClass).to.have.nested.property('SymbolTable.id', 'FileUtilities');
    expect(fileUtilitiesClass).to.have.nested.property('SymbolTable.name', 'FileUtilities');
    expect(fileUtilitiesClass).to.have.nested.property('SymbolTable.methods').that.is.an('array').with.lengthOf(1);

    const method = fileUtilitiesClass.SymbolTable.methods[0];
    expect(method).to.have.property('name', 'createFile');
    expect(method).to.have.property('returnType', 'String');
    expect(method.parameters).to.be.an('array').with.lengthOf(3);
    expect(method.parameters[0]).to.deep.include({ name: 'base64data', type: 'String' });
    expect(method.parameters[1]).to.deep.include({ name: 'filename', type: 'String' });
    expect(method.parameters[2]).to.deep.include({ name: 'recordId', type: 'String' });

    const variables = fileUtilitiesClass.SymbolTable.variables;
    expect(variables).to.be.an('array').with.lengthOf(5);
    expect(variables[0]).to.deep.include({ name: 'base64data', type: 'String' });
    expect(variables[1]).to.deep.include({ name: 'filename', type: 'String' });
    expect(variables[2]).to.deep.include({ name: 'recordId', type: 'String' });
    expect(variables[3]).to.deep.include({
      name: 'contentVersion',
      type: 'ContentVersion',
    });
    expect(variables[4]).to.deep.include({
      name: 'contentDocumentLink',
      type: 'ContentDocumentLink',
    });
  });

  it('should handle SOQL query errors', async () => {
    const result = await client.callTool(queryOrgSchema, {
      name: 'run_soql_query',
      params: {
        query: 'SELECT InvalidField FROM NonExistentObject',
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
        useToolingApi: false,
      },
    });

    expect(result.isError).to.be.true;
    expect(result.content.length).to.equal(1);
    expect(result.content[0].type).to.equal('text');

    const responseText = result.content[0].text;
    expect(responseText).to.contain('Failed to query org:');
  });

  it('should handle missing usernameOrAlias parameter', async () => {
    const result = await client.callTool(queryOrgSchema, {
      name: 'run_soql_query',
      params: {
        query: 'SELECT Id FROM User LIMIT 1',
        usernameOrAlias: '', // Empty username
        directory: testSession.project.dir,
      },
    });

    expect(result.isError).to.be.true;
    expect(result.content.length).to.equal(1);
    expect(result.content[0].type).to.equal('text');

    const responseText = result.content[0].text;
    expect(responseText).to.equal(
      'The usernameOrAlias parameter is required, if the user did not specify one use the #get_username tool',
    );
  });
});
