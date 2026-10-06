import { assertGeneratorsEnforceVersionFloor } from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';

describe('@nx/angular generators enforce supported version floor', () => {
  assertGeneratorsEnforceVersionFloor({
    packageRoot: join(__dirname, '..', '..'),
    packageName: '@angular/core',
    subFloorVersion: '~19.2.0',
  });
});
