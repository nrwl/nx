import json = require('./migrations.json');

import { assertValidMigrationPaths } from '@nx/devkit/internal-testing-utils';
import { MigrationsJson } from '@nx/devkit';

vi.mock('vite', () => ({
  loadConfigFromFile: vi.fn().mockImplementation(() => {
    return Promise.resolve({
      path: 'vite.config.ts',
      config: {},
      dependencies: [],
    });
  }),
}));

describe('vite migrations', () => {
  assertValidMigrationPaths(json as MigrationsJson, __dirname);
});
