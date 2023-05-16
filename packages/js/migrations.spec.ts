import json = require('./migrations.json');

import { assertValidMigrationPaths } from '@nx/devkit/internal-testing-utils';
import { MigrationsJson } from '@nx/devkit';

describe('js migrations', () => {
  assertValidMigrationPaths(json as MigrationsJson, __dirname);
});
