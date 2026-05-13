import json = require('./migrations.json');

import { assertValidMigrationPaths } from '@nx/devkit/internal-testing-utils';

describe('Detox migrations', () => {
  assertValidMigrationPaths(json, __dirname);
});
