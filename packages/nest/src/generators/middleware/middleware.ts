import type { Tree } from '@nx/devkit';
import type {
  NestGeneratorWithLanguageOption,
  NestGeneratorWithTestOption,
  NormalizedOptions,
} from '../utils';
import {
  normalizeOptions,
  runNestSchematic,
  unitTestRunnerToSpec,
} from '../utils';

export type MiddlewareGeneratorOptions = NestGeneratorWithLanguageOption &
  NestGeneratorWithTestOption;

export async function middlewareGenerator(
  tree: Tree,
  rawOptions: MiddlewareGeneratorOptions
): Promise<any> {
  const options = await normalizeMiddlewareOptions(tree, rawOptions);

  return runNestSchematic(tree, 'middleware', options);
}

export default middlewareGenerator;

async function normalizeMiddlewareOptions(
  tree: Tree,
  options: MiddlewareGeneratorOptions
): Promise<NormalizedOptions> {
  const normalizedOptions = await normalizeOptions(tree, options);
  return {
    ...normalizedOptions,
    language: options.language,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
