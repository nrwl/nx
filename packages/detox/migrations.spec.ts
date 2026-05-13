import json = require('./migrations.json');

import { assertValidMigrationPaths } from 'nx/src/internal-testing-utils/assert-valid-migrations';

describe('Detox migrations', () => {
  assertValidMigrationPaths(json, __dirname);
});
