import { assertGeneratorsEnforceVersionFloor } from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';

describe('@nx/vite generators enforce supported version floor', () => {
  assertGeneratorsEnforceVersionFloor({
    packageRoot: join(__dirname, '..', '..'),
    packageName: 'vite',
    subFloorVersion: '~4.5.0',
  });
});
