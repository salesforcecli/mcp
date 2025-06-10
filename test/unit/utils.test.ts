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
import { sep } from 'node:path';
import { platform } from 'node:os';
import { expect } from 'chai';
import sinon from 'sinon';
import { textResponse, getEnabledToolsets, sanitizePath } from '../../src/shared/utils.js';

// Create a mock version of availableToolsets for testing instead of importing from index.js
// This avoids the error with parseArgs when running tests
const MOCK_AVAILABLE_TOOLSETS = ['all', 'orgs', 'data', 'users', 'metadata'];

describe('utilities tests', () => {
  // Common test setup
  const sandbox = sinon.createSandbox();
  let processExitStub: sinon.SinonStub;
  let consoleErrorStub: sinon.SinonStub;

  beforeEach(() => {
    // Set up common stubs used by multiple tests
    processExitStub = sandbox.stub(process, 'exit');
    consoleErrorStub = sandbox.stub(console, 'error');
  });

  afterEach(() => {
    // Clean up common stubs
    sandbox.restore();
  });

  describe('textResponse', () => {
    it('should return a properly formatted response object with default isError=false', () => {
      const message = 'Test message';
      const result = textResponse(message);

      expect(result).to.deep.equal({
        isError: false,
        content: [
          {
            type: 'text',
            text: message,
          },
        ],
      });
    });

    it('should return a response object with isError=true when specified', () => {
      const errorMessage = 'Error occurred';
      const result = textResponse(errorMessage, true);

      expect(result).to.deep.equal({
        isError: true,
        content: [
          {
            type: 'text',
            text: errorMessage,
          },
        ],
      });
    });

    it('should throw an error when given an empty string', () => {
      expect(() => textResponse('')).to.throw('textResponse error: "text" cannot be empty');
    });

    it('should handle very long string input', () => {
      const longString = 'a'.repeat(1000);
      const result = textResponse(longString);

      expect(result.content[0].text).to.equal(longString);
      expect(result.content[0].text.length).to.equal(1000);
      expect(result.isError).to.be.false;
    });
  });

  describe('getEnabledToolsets', () => {
    it('should return a Set of enabled toolsets when all inputs are valid', () => {
      const toolsetsInput = 'orgs,data';

      const result = getEnabledToolsets(MOCK_AVAILABLE_TOOLSETS, toolsetsInput);

      expect(result).to.be.instanceOf(Set);
      expect(Array.from(result)).to.deep.equal(['orgs', 'data']);
      expect(processExitStub.called).to.be.false;
    });

    it('should handle a single toolset input', () => {
      const toolsetsInput = 'orgs';

      const result = getEnabledToolsets(MOCK_AVAILABLE_TOOLSETS, toolsetsInput);

      expect(Array.from(result)).to.deep.equal(['orgs']);
    });

    it('should handle spaces in the input string', () => {
      const toolsetsInput = 'orgs, data , users';

      const result = getEnabledToolsets(MOCK_AVAILABLE_TOOLSETS, toolsetsInput);

      expect(Array.from(result)).to.deep.equal(['orgs', 'data', 'users']);
    });

    it('should exit with code 1 when an invalid toolset is provided', () => {
      const toolsetsInput = 'orgs,invalid';

      getEnabledToolsets(MOCK_AVAILABLE_TOOLSETS, toolsetsInput);

      expect(processExitStub.calledWith(1)).to.be.true;
      expect(consoleErrorStub.calledWithMatch(/not in the allowed toolset list/)).to.be.true;
      expect(consoleErrorStub.calledWithMatch(/invalid/)).to.be.true;
    });

    it('should display the appropriate error message when invalid toolset is provided', () => {
      const toolsetsInput = 'invalid';

      getEnabledToolsets(MOCK_AVAILABLE_TOOLSETS, toolsetsInput);

      expect(consoleErrorStub.calledWithMatch(/not in the allowed toolset list/)).to.be.true;
      expect(consoleErrorStub.calledWithMatch(/orgs, data, users/)).to.be.true;
      expect(consoleErrorStub.neverCalledWithMatch(/all \(default\), all/)).to.be.true;
    });

    it('should log enabled toolsets to console.error', () => {
      const toolsetsInput = 'data,users';

      getEnabledToolsets(MOCK_AVAILABLE_TOOLSETS, toolsetsInput);

      expect(consoleErrorStub.calledWith('Enabling toolsets:', 'data, users')).to.be.true;
    });
  });

  describe('sanitizePath', () => {
    it('should return true for valid absolute paths', () => {
      expect(sanitizePath(`${sep}valid${sep}path`)).to.be.true;
      expect(sanitizePath(`${sep}another${sep}valid${sep}path`)).to.be.true;

      if (platform() === 'win32') {
        expect(sanitizePath('c:\\Users\\johndoe\\projects\\ebikes-lwc')).to.be.true;
      }
    });

    it('should return false for relative paths', () => {
      expect(sanitizePath('relative/path')).to.be.false;
      expect(sanitizePath('./relative/path')).to.be.false;

      if (platform() === 'win32') {
        expect(sanitizePath('\\Users\\johndoe\\projects\\ebikes-lwc')).to.be.false;
      }
    });

    it('should detect path traversal attempts', () => {
      expect(sanitizePath(`${sep}path${sep}..${sep}file`)).to.be.false;
      expect(sanitizePath(`${sep}path${sep}\\..${sep}file`)).to.be.false;
      expect(sanitizePath(`${sep}path${sep}../file`)).to.be.false;
      expect(sanitizePath(`${sep}path${sep}..\\file`)).to.be.false;

      if (platform() === 'win32') {
        expect(sanitizePath('c:\\Users\\johndoe\\projects\\ebikes-lwc\\..\\dreamhouse-lwc')).to.be.false;
      }
    });

    it('should handle URL-encoded sequences', () => {
      expect(sanitizePath(`${sep}path${sep}%2e%2e${sep}file`)).to.be.false;
      expect(sanitizePath(`${sep}valid${sep}%20path`)).to.be.true;
    });

    it('should handle Unicode characters', () => {
      expect(sanitizePath(`${sep}path${sep}\u2025file`)).to.be.false;
      expect(sanitizePath(`${sep}path${sep}\u2026file`)).to.be.false;
      expect(sanitizePath(`${sep}valid${sep}path\u00e9`)).to.be.true;
    });

    it('should handle mixed path separators', () => {
      expect(sanitizePath(`${sep}path\\subpath${sep}file`)).to.be.true;
      expect(sanitizePath(`${sep}path${sep}..\\file`)).to.be.false;
    });
  });
});
