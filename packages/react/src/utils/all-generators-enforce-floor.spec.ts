import { assertGeneratorsEnforceVersionFloor } from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';

describe('@nx/react generators enforce supported version floor', () => {
  assertGeneratorsEnforceVersionFloor({
    packageRoot: join(__dirname, '..', '..'),
    packageName: 'react',
    // React 17 is below the supported floor (v18); the last v17 release was 17.0.2.
    subFloorVersion: '~17.0.0',
  });
});
