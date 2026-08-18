import { assertGeneratorsEnforceVersionFloor } from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';

describe('@nx/nuxt generators enforce supported version floor', () => {
  assertGeneratorsEnforceVersionFloor({
    packageRoot: join(__dirname, '..', '..'),
    packageName: 'nuxt',
    // Floor is the v3 major (3.0.0); Nuxt 2 is below it. Last v2 was 2.18.x.
    subFloorVersion: '~2.18.0',
  });
});
