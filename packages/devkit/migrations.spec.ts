import json = require('./migrations.json');

import { assertValidMigrationPaths } from './internal-testing-utils';

describe('Devkit migrations', () => {
  assertValidMigrationPaths(json, __dirname);
});
