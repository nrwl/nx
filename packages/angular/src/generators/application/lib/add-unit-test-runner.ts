import { Tree, joinPathFragments } from '@nx/devkit';
import { configurationGenerator } from '@nx/jest';
import { UnitTestRunner } from '../../../utils/test-runners';
import type { NormalizedSchema } from './normalized-schema';

export async function addUnitTestRunner(host: Tree, options: NormalizedSchema) {
  if (options.unitTestRunner === UnitTestRunner.Jest) {
    await configurationGenerator(host, {
      ...options,
      project: options.name,
      setupFile: 'angular',
      supportTsx: false,
      skipSerializers: false,
      skipPackageJson: options.skipPackageJson,
      skipFormat: true,
    });
    const setupFile = joinPathFragments(
      options.appProjectRoot,
      'src',
      'test-setup.ts'
    );
    if (options.strict && host.exists(setupFile)) {
      const contents = host.read(setupFile, 'utf-8');
      host.write(
        setupFile,
        `// @ts-expect-error https://thymikee.github.io/jest-preset-angular/docs/getting-started/test-environment
globalThis.ngJest = {
  testEnvironmentOptions: {
    errorOnUnknownElements: true,
    errorOnUnknownProperties: true,
  },
};
${contents}`
      );
    }
  }
}
