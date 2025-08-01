#!/usr/bin/env -S node --loader ts-node/esm --disable-warning=ExperimentalWarning

import { dirname } from 'node:path';
import { execute } from '@oclif/core';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Disable TLS verification for local testing
await execute({
  development: true,
  dir: import.meta.url,
  loadOptions: {
    root: dirname(import.meta.dirname),
    pjson: {
      name: 'mcp-test',
      version: '1.0.0',
      oclif: {
        bin: 'mcp-test',
        dirname: 'mcp-test',
        commands: './lib/commands',
        topicSeparator: ' ',
      },
    },
  },
});
