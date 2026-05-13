import json = require('./migrations.json');

import { assertValidMigrationPaths } from 'nx/src/internal-testing-utils/assert-valid-migrations';
import { MigrationsJson } from '@nx/devkit';

describe('gradle migrations', () => {
  assertValidMigrationPaths(json as MigrationsJson, __dirname);
});
