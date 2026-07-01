import { assertGeneratorsEnforceVersionFloor } from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';

describe('@nx/jest generators enforce supported version floor', () => {
  assertGeneratorsEnforceVersionFloor({
    packageRoot: join(__dirname, '..', '..'),
    packageName: 'jest',
    subFloorVersion: '~28.0.0',
  });
});
