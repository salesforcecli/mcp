#!/usr/bin/env node

if (process.argv.includes('--debug')) {
  process.env.DEBUG = 'sf*';
  process.env.SF_LOG_COLORIZE = 'false';
  process.env.SF_LOG_STDERR = 'true';
  process.env.SF_LOG_LEVEL = 'trace';
}

import { execute } from '@oclif/core';

await execute({ dir: import.meta.url });
