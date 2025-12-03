import type { Tree } from '@nx/devkit';
import { UnitTestRunner } from '../../../utils/test-runners';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { Schema } from '../schema';

export function validateOptions(tree: Tree, options: Schema) {
  const { major: angularMajorVersion, version: angularVersion } =
    getInstalledAngularVersionInfo(tree);

  if (angularMajorVersion < 21) {
    if (options.zoneless) {
      throw new Error(
        `The "zoneless" option is only supported for Angular versions >= 21.0.0. You are using Angular ${angularVersion}.`
      );
    }
  }

  if (options.unitTestRunner === UnitTestRunner.VitestAngular) {
    if (angularMajorVersion < 21) {
      throw new Error(
        `The "vitest-angular" unit test runner requires Angular v21 or higher. ` +
          `Detected Angular v${angularVersion}. Use "vitest-analog" or "jest" instead.`
      );
    }
    // Only fail if bundler is explicitly set to a non-esbuild value.
    // If bundler is undefined, it will default to 'esbuild' for Angular v21+.
    if (options.bundler && options.bundler !== 'esbuild') {
      throw new Error(
        `The "vitest-angular" unit test runner requires the "esbuild" bundler ` +
          `which uses the "@angular/build:application" executor. ` +
          `Use "vitest-analog" or "jest" instead. Or use the "esbuild" bundler.`
      );
    }
  }
}
