import json = require('./migrations.json');

import { assertValidMigrationPaths } from '@nx/devkit/internal-testing-utils';

describe('esbuild migrations', () => {
  assertValidMigrationPaths(json, __dirname);
});
