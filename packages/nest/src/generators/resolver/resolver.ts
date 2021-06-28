import type { Tree } from '@nrwl/devkit';
import { convertNxGenerator } from '@nrwl/devkit';
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

export type ResolverGeneratorOptions = NestGeneratorWithLanguageOption &
  NestGeneratorWithTestOption;

export function resolverGenerator(
  tree: Tree,
  rawOptions: ResolverGeneratorOptions
): Promise<any> {
  const options = normalizeResolverOptions(tree, rawOptions);

  return runNestSchematic(tree, 'resolver', options);
}

export default resolverGenerator;

export const resolverSchematic = convertNxGenerator(resolverGenerator);

function normalizeResolverOptions(
  tree: Tree,
  options: ResolverGeneratorOptions
): NormalizedOptions {
  return {
    ...normalizeOptions(tree, options),
    language: options.language,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
