import type { Tree } from '@nx/devkit';
import type {
  NestGeneratorOptions,
  NormalizedOptions,
  UnitTestRunner,
} from './types';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export async function normalizeOptions(
  tree: Tree,
  options: NestGeneratorOptions
): Promise<NormalizedOptions> {
  const { directory, fileName } =
    await determineArtifactNameAndDirectoryOptions(tree, {
      name: options.name,
      path: options.path,
    });

  return {
    ...options,
    flat: true,
    name: fileName,
    skipFormat: options.skipFormat,
    sourceRoot: directory,
  };
}

export function unitTestRunnerToSpec(
  unitTestRunner: UnitTestRunner | undefined
): boolean | undefined {
  return unitTestRunner !== undefined ? unitTestRunner === 'jest' : undefined;
}
