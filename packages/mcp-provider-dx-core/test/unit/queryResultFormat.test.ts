/*
 * Copyright 2026, Salesforce, Inc.
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
import { expect } from 'chai';
import {
  DEFAULT_MAX_SOQL_RECORDS,
  formatSoqlQueryResult,
} from '../../src/shared/queryResultFormat.js';

describe('formatSoqlQueryResult', () => {
  it('returns legacy full payload for small complete results', () => {
    const result = {
      done: true,
      totalSize: 2,
      records: [
        { Id: '001A', Name: 'Acme' },
        { Id: '001B', Name: 'Beta' },
      ],
    };

    const text = formatSoqlQueryResult(result);
    expect(text.startsWith('SOQL query results:')).to.equal(true);
    expect(text).to.not.include('TRUNCATED');
    expect(text).to.include('"Id": "001A"');
    expect(text).to.include('"totalSize": 2');
  });

  it('truncates when records exceed maxRecords and instructs agents not to retry', () => {
    const records = Array.from({ length: 150 }, (_, i) => ({ Id: `00${i}`, Name: `R${i}` }));
    const result = { done: true, totalSize: 150, records };

    const text = formatSoqlQueryResult(result, { maxRecords: 10 });
    expect(text).to.include('TRUNCATED');
    expect(text).to.include('Do not call run_soql_query again with the identical SOQL');
    expect(text).to.include('totalSize=150');
    expect(text).to.include('returnedRecords=10');
    expect(text).to.include('"truncated": true');
    expect(text).to.not.include('"Id": "0010"'); // 11th zero-padded style; ensure we did not dump all
    const returnedMatch = text.match(/"returnedRecords":\s*(\d+)/);
    expect(returnedMatch?.[1]).to.equal('10');
  });

  it('treats done=false as truncated even when under record cap', () => {
    const result = {
      done: false,
      totalSize: 500,
      nextRecordsUrl: '/services/data/v61.0/query/0r-next',
      records: [{ Id: '001Z', Name: 'Partial' }],
    };

    const text = formatSoqlQueryResult(result, { maxRecords: DEFAULT_MAX_SOQL_RECORDS });
    expect(text).to.include('TRUNCATED');
    expect(text).to.include('apiDone=false');
    expect(text).to.include('nextRecordsUrl');
    expect(text).to.include('Narrow with WHERE');
  });

  it('shrinks payload when over maxChars budget', () => {
    const records = Array.from({ length: 20 }, (_, i) => ({
      Id: `00${i}`,
      Blob: 'x'.repeat(5000),
    }));
    const result = { done: true, totalSize: 20, records };

    const text = formatSoqlQueryResult(result, { maxRecords: 20, maxChars: 8000 });
    expect(text).to.include('TRUNCATED');
    expect(text.length).to.be.lessThan(20_000);
    const returnedMatch = text.match(/"returnedRecords":\s*(\d+)/);
    expect(Number(returnedMatch?.[1])).to.be.lessThan(20);
  });
});
