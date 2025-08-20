import pkg from '../package.json' with { type: 'json' };

const packageJson: {version: string} = pkg as {version: string};

export const MCP_PROVIDER_API_VERSION: string = packageJson.version;