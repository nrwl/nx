import json = require('./migrations.json');

import { assertValidMigrationPaths } from './internal-testing-utils/assert-valid-migrations';
import { MigrationsJson } from './src/config/misc-interfaces';

describe('nx migrations', () => {
  assertValidMigrationPaths(json as MigrationsJson, __dirname);
});
