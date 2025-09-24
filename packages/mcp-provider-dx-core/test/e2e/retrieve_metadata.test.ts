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
import fs from 'node:fs';
import { expect, assert } from 'chai';
import { McpTestClient, DxMcpTransport } from '@salesforce/mcp-test-client';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { z } from 'zod';
import { ensureString } from '@salesforce/ts-types';
import { retrieveMetadataParams } from '../../src/tools/retrieve_metadata.js';

describe('retrieve_metadata', () => {
  const client = new McpTestClient({
    timeout: 60000,
  });

  let testSession: TestSession;
  let orgUsername: string;

  const retrieveMetadataSchema = {
    name: z.literal('retrieve_metadata'),
    params: retrieveMetadataParams,
  };

  before(async () => {
    testSession = await TestSession.create({
      project: { gitClone: 'https://github.com/trailheadapps/dreamhouse-lwc' },
      scratchOrgs: [{ setDefault: true, config: path.join('config', 'project-scratch-def.json') }],
      devhubAuthStrategy: 'AUTO',
    });

    execCmd('project deploy start', {
      cli: 'sf',
      ensureExitCode: 0,
    });

    orgUsername = [...testSession.orgs.keys()][0];

    const transport = DxMcpTransport({
      orgUsername: ensureString(orgUsername),
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

  it('should fail if both sourceDir and manifest params are set', async () => {
    const result = await client.callTool(retrieveMetadataSchema, {
      name: 'retrieve_metadata',
      params: {
        sourceDir: ['force-app/main/default/classes/GeocodingService.cls'],
        manifest: '/some/path/package.xml',
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
      },
    });

    expect(result.isError).to.be.true;
    expect(result.content.length).to.equal(1);
    if (result.content[0].type !== 'text') assert.fail();

    const responseText = result.content[0].text;
    expect(responseText).to.contain("You can't specify both `sourceDir` and `manifest` parameters.");
  });

  it('should retrieve just 1 apex class', async () => {
    const apexClassPath = path.join('force-app', 'main', 'default', 'classes', 'GeocodingService.cls');

    const result = await client.callTool(retrieveMetadataSchema, {
      name: 'retrieve_metadata',
      params: {
        sourceDir: [apexClassPath],
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
      },
    });

    expect(result.isError).to.equal(false);
    expect(result.content.length).to.equal(1);
    if (result.content[0].type !== 'text') assert.fail();

    const responseText = result.content[0].text;
    expect(responseText).to.contain('Retrieve result:');

    // Parse the retrieve result JSON
    const retrieveMatch = responseText.match(/Retrieve result: ({.*})/);
    expect(retrieveMatch).to.not.be.null;

    const retrieveResult = JSON.parse(retrieveMatch![1]) as {
      success: boolean;
      done: boolean;
      fileProperties: Array<{
        type: string;
        fullName: string;
        fileName: string;
      }>;
    };
    expect(retrieveResult.success).to.be.true;
    expect(retrieveResult.done).to.be.true;
    expect(retrieveResult.fileProperties.length).to.equal(2); // Updated to match the response

    // Check the properties of the retrieved ApexClass
    const apexClass = retrieveResult.fileProperties.find(
      (fp: { type: string; fullName: string }) => fp.type === 'ApexClass',
    );
    if (!apexClass) assert.fail();
    expect(apexClass.fullName).to.equal('GeocodingService');
    expect(apexClass.fileName).to.equal('unpackaged/classes/GeocodingService.cls');
  });

  it('should retrieve a manifest', async () => {
    // Create a package.xml that includes all apex classes
    const packageXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>*</members>
        <name>ApexClass</name>
    </types>
    <version>61.0</version>
</Package>`;

    const manifestPath = path.join(testSession.project.dir, 'package.xml');
    fs.writeFileSync(manifestPath, packageXmlContent);

    const result = await client.callTool(retrieveMetadataSchema, {
      name: 'retrieve_metadata',
      params: {
        manifest: manifestPath,
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
      },
    });

    expect(result.isError).to.equal(false);
    expect(result.content.length).to.equal(1);
    if (result.content[0].type !== 'text') assert.fail();

    const responseText = result.content[0].text;
    expect(responseText).to.contain('Retrieve result:');

    // Parse the retrieve result JSON
    const retrieveMatch = responseText.match(/Retrieve result: ({.*})/);
    expect(retrieveMatch).to.not.be.null;

    const retrieveResult = JSON.parse(retrieveMatch![1]) as {
      success: boolean;
      done: boolean;
      fileProperties: Array<{
        type: string;
      }>;
    };
    expect(retrieveResult.success).to.be.true;
    expect(retrieveResult.done).to.be.true;
    // Should retrieve all apex classes (there are multiple in dreamhouse) + package.xml
    expect(retrieveResult.fileProperties.length).to.equal(10);

    // Verify we got 9 Apex classes and 1 package.xml
    const apexClasses = retrieveResult.fileProperties.filter((fp) => fp.type === 'ApexClass');
    const packageXml = retrieveResult.fileProperties.filter((fp) => fp.type === 'Package');
    expect(apexClasses.length).to.equal(9);
    expect(packageXml.length).to.equal(1);
  });
});
