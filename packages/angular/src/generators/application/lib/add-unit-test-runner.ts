import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import { jestProjectGenerator } from '@nrwl/jest';

import { UnitTestRunner } from '../../../utils/test-runners';
import karmaProjectGenerator from '../../karma-project/karma-project';

export async function addUnitTestRunner(host: Tree, options: NormalizedSchema) {
  if (options.unitTestRunner === UnitTestRunner.Jest) {
    await jestProjectGenerator(host, {
      project: options.name,
      setupFile: 'angular',
      supportTsx: false,
      skipSerializers: false,
    });
  } else if (options.unitTestRunner === UnitTestRunner.Karma) {
    await karmaProjectGenerator(host, {
      project: options.name,
    });
  }
}
