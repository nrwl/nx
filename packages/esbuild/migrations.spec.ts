import json = require('./migrations.json');

import { assertValidMigrationPaths } from 'nx/src/internal-testing-utils/assert-valid-migrations';

describe('esbuild migrations', () => {
  assertValidMigrationPaths(json, __dirname);
});
