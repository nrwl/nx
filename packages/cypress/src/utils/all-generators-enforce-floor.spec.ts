import { assertGeneratorsEnforceVersionFloor } from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';

describe('@nx/cypress generators enforce supported version floor', () => {
  assertGeneratorsEnforceVersionFloor({
    packageRoot: join(__dirname, '..', '..'),
    packageName: 'cypress',
    subFloorVersion: '~12.17.0',
    // Migrate-to-cypress-11 exists to migrate sub-floor (v8-v10) workspaces to
    // v11; gating it on the current floor (v13) would block its only use case.
    excludeGenerators: ['migrate-to-cypress-11'],
  });
});
