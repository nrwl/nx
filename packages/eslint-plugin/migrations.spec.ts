import json = require('./migrations.json');

import { assertValidMigrationPaths } from 'nx/src/internal-testing-utils/assert-valid-migrations';

describe('eslint-plugin migrations', () => {
  assertValidMigrationPaths(json, __dirname);
});
