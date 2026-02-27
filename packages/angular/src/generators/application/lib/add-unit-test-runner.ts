import type { Tree } from '@nx/devkit';
import { UnitTestRunner } from '../../../utils/test-runners';
import { addJest } from '../../utils/add-jest';
import { addVitestAnalog, addVitestAngular } from '../../utils/add-vitest';
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
        runtimeTsconfigFileName: 'tsconfig.app.json',
        zoneless: options.zoneless,
      });
      break;
    case UnitTestRunner.VitestAngular:
      await addVitestAngular(host, {
        name: options.name,
        projectRoot: options.appProjectRoot,
        skipPackageJson: options.skipPackageJson,
      });
      break;
    case UnitTestRunner.VitestAnalog:
      await addVitestAnalog(host, {
        name: options.name,
        projectRoot: options.appProjectRoot,
        skipFormat: options.skipFormat,
        skipPackageJson: options.skipPackageJson,
        strict: options.strict,
        addPlugin: options.addPlugin,
        zoneless: options.zoneless,
      });
      break;
  }
}
