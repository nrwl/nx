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

export type GuardGeneratorOptions = NestGeneratorWithLanguageOption &
  NestGeneratorWithTestOption;

export async function guardGenerator(
  tree: Tree,
  rawOptions: GuardGeneratorOptions
): Promise<any> {
  const options = await normalizeGuardOptions(tree, rawOptions);

  return runNestSchematic(tree, 'guard', options);
}

export default guardGenerator;

async function normalizeGuardOptions(
  tree: Tree,
  options: GuardGeneratorOptions
): Promise<NormalizedOptions> {
  const normalizedOptions = await normalizeOptions(tree, options);
  return {
    ...normalizedOptions,
    language: options.language,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
