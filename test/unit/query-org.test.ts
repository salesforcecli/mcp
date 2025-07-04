import { expect } from 'chai';
import { queryOrgParamsSchema } from '../../src/tools/data/sf-query-org.js';

describe('sf-query-org params', () => {
  it('allows optional useToolingApi flag', () => {
    const parsed = queryOrgParamsSchema.parse({
      query: 'SELECT Id FROM Account',
      usernameOrAlias: 'foo',
      directory: '/tmp',
      useToolingApi: true,
    });

    expect(parsed.useToolingApi).to.equal(true);
  });

  it('parses when useToolingApi is omitted', () => {
    const parsed = queryOrgParamsSchema.parse({
      query: 'SELECT Id FROM Account',
      usernameOrAlias: 'foo',
      directory: '/tmp',
    });

    expect(parsed.useToolingApi).to.equal(undefined);
  });
});
