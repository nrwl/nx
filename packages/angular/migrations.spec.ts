import path = require('path');
import json = require('./migrations.json');

import { assertValidMigrationPaths } from 'nx/src/internal-testing-utils/assert-valid-migrations';

describe('Angular migrations', () => {
  assertValidMigrationPaths(json, __dirname);
});
