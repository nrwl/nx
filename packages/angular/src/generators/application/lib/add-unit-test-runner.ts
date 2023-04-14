import type { Tree } from '@nx/devkit';
import type { NormalizedSchema } from './normalized-schema';

import { jestProjectGenerator } from '@nx/jest';

import { UnitTestRunner } from '../../../utils/test-runners';

export async function addUnitTestRunner(host: Tree, options: NormalizedSchema) {
  if (options.unitTestRunner === UnitTestRunner.Jest) {
    await jestProjectGenerator(host, {
      project: options.name,
      setupFile: 'angular',
      supportTsx: false,
      skipSerializers: false,
      skipPackageJson: options.skipPackageJson,
      skipFormat: true,
    });
  }
}
