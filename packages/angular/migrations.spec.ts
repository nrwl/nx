import path = require('path');
import json = require('./migrations.json');

import { assertValidMigrationPaths } from '@nx/devkit/internal-testing-utils';

describe('Angular migrations', () => {
  assertValidMigrationPaths(json, __dirname);
});
