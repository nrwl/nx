import type { Tree } from '@nx/devkit';
import { UnitTestRunner } from '../../../utils/test-runners';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { Schema } from '../schema';

export function validateOptions(tree: Tree, options: Schema): void {
  if (!options.routing && options.lazy) {
    throw new Error(`To use "--lazy" option, "--routing" must also be set.`);
  }

  if (options.publishable === true && !options.importPath) {
    throw new Error(
      `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
    );
  }

  if (options.addTailwind && !options.buildable && !options.publishable) {
    throw new Error(
      `To use "--addTailwind" option, you have to set either "--buildable" or "--publishable".`
    );
  }

  if (options.unitTestRunner === UnitTestRunner.VitestAngular) {
    const { major: angularMajorVersion, version: angularVersion } =
      getInstalledAngularVersionInfo(tree);

    if (angularMajorVersion < 21) {
      throw new Error(
        `The "vitest-angular" unit test runner requires Angular v21 or higher. ` +
          `Detected Angular v${angularVersion}. Use "vitest-analog" or "jest" instead.`
      );
    }

    if (!options.buildable && !options.publishable) {
      throw new Error(
        `The "vitest-angular" unit test runner requires the library to be buildable or publishable. ` +
          `Use "vitest-analog" or "jest" instead.`
      );
    }
  }
}
