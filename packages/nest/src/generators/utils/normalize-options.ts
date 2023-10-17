import type { Tree } from '@nx/devkit';
import { names, readProjectConfiguration } from '@nx/devkit';
import type {
  NestGeneratorOptions,
  NormalizedOptions,
  UnitTestRunner,
} from './types';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export async function normalizeOptions(
  tree: Tree,
  artifactType: string,
  callingGenerator: string,
  options: NestGeneratorOptions
): Promise<NormalizedOptions> {
  const { directory, fileName, nameAndDirectoryFormat } =
    await determineArtifactNameAndDirectoryOptions(tree, {
      callingGenerator,
      artifactType,
      name: options.name,
      directory: options.directory,
      project: options.project,
      flat: options.flat,
      nameAndDirectoryFormat: options.nameAndDirectoryFormat ?? 'derived',
      derivedDirectory: options.directory,
    });

  const normalizedOptions: NormalizedOptions = {
    ...options,
    flat: true,
    name: fileName,
    skipFormat: options.skipFormat,
    sourceRoot: directory,
  };

  return normalizedOptions;
}

export function unitTestRunnerToSpec(
  unitTestRunner: UnitTestRunner | undefined
): boolean | undefined {
  return unitTestRunner !== undefined ? unitTestRunner === 'jest' : undefined;
}
