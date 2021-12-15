import type { Tree } from '@nrwl/devkit';
import { names, readProjectConfiguration } from '@nrwl/devkit';
import type {
  FastifyGeneratorOptions,
  NormalizedOptions,
  UnitTestRunner,
} from './types';

export function normalizeOptions(
  tree: Tree,
  options: FastifyGeneratorOptions
): NormalizedOptions {
  const { sourceRoot } = readProjectConfiguration(tree, options.project);

  const normalizedOptions: NormalizedOptions = {
    flat: options.flat,
    name: names(options.name).fileName,
    path: options.directory,
    skipFormat: options.skipFormat,
    sourceRoot,
  };

  return normalizedOptions;
}

export function unitTestRunnerToSpec(
  unitTestRunner: UnitTestRunner | undefined
): boolean | undefined {
  return unitTestRunner !== undefined ? unitTestRunner === 'jest' : undefined;
}
