import { assertGeneratorsEnforceVersionFloor } from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';

describe('@nx/storybook generators enforce supported version floor', () => {
  assertGeneratorsEnforceVersionFloor({
    packageRoot: join(__dirname, '..', '..'),
    packageName: 'storybook',
    subFloorVersion: '~7.6.0',
    // `migrate-8` lifts sub-floor workspaces (v6/v7) onto the v8 floor;
    // gating it on the current floor would block its only use case.
    excludeGenerators: ['migrate-8'],
  });
});
