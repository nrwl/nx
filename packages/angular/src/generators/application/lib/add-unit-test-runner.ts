import { Tree } from '@nx/devkit';
import { UnitTestRunner } from '../../../utils/test-runners';
import { addJest } from '../../utils/add-jest';
import type { NormalizedSchema } from './normalized-schema';

export async function addUnitTestRunner(host: Tree, options: NormalizedSchema) {
  if (options.unitTestRunner === UnitTestRunner.Jest) {
    await addJest(host, {
      name: options.name,
      projectRoot: options.appProjectRoot,
      skipPackageJson: options.skipPackageJson,
      strict: options.strict,
    });
  }
}
