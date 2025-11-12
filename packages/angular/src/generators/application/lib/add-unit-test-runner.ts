import { Tree } from '@nx/devkit';
import { UnitTestRunner } from '../../../utils/test-runners.js';
import { addJest } from '../../utils/add-jest.js';
import { addVitest } from '../../utils/add-vitest.js';
import type { NormalizedSchema } from './normalized-schema';

export async function addUnitTestRunner(host: Tree, options: NormalizedSchema) {
  switch (options.unitTestRunner) {
    case UnitTestRunner.Jest:
      await addJest(host, {
        name: options.name,
        projectRoot: options.appProjectRoot,
        skipPackageJson: options.skipPackageJson,
        strict: options.strict,
        addPlugin: options.addPlugin,
      });
      break;
    case UnitTestRunner.Vitest:
      await addVitest(host, {
        name: options.name,
        projectRoot: options.appProjectRoot,
        skipPackageJson: options.skipPackageJson,
        strict: options.strict,
        addPlugin: options.addPlugin,
      });
      break;
  }
}
