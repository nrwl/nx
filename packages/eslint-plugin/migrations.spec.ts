import json = require('./migrations.json');

import { assertValidMigrationPaths } from '@nx/devkit/internal-testing-utils';

describe('eslint-plugin migrations', () => {
  assertValidMigrationPaths(json, __dirname);
});
