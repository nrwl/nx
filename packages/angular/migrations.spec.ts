import path from 'path';
import json from './migrations.json';

import { assertValidMigrationPaths } from '@nx/devkit/internal-testing-utils';

describe('Angular migrations', () => {
  assertValidMigrationPaths(json, __dirname);
});
