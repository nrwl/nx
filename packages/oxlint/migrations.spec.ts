import { assertValidMigrationPaths } from '@nx/devkit/internal-testing-utils';
import { MigrationsJson } from '@nx/devkit';

import json from './migrations.json' with { type: 'json' };

describe('oxlint migrations', () => {
  assertValidMigrationPaths(json as MigrationsJson, __dirname);
});
