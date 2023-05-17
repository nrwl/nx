import json = require('./migrations.json');

import { assertValidMigrationPaths } from '@nx/devkit/internal-testing-utils';

describe('Cypress migrations', () => {
  assertValidMigrationPaths(json, __dirname);
});
