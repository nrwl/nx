import { assertGeneratorsEnforceVersionFloor } from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';

describe('@nx/vue generators enforce supported version floor', () => {
  assertGeneratorsEnforceVersionFloor({
    packageRoot: join(__dirname, '..', '..'),
    packageName: 'vue',
    // Vue 2 is below the supported floor (v3); the last v2 release was 2.7.x.
    subFloorVersion: '~2.7.0',
  });
});
