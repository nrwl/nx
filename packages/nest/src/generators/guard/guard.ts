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

export type GuardGeneratorOptions = NestGeneratorWithLanguageOption &
  NestGeneratorWithTestOption;

export function guardGenerator(
  tree: Tree,
  rawOptions: GuardGeneratorOptions
): Promise<any> {
  const options = normalizeGuardOptions(tree, rawOptions);

  return runNestSchematic(tree, 'guard', options);
}

export default guardGenerator;

export const guardSchematic = convertNxGenerator(guardGenerator);

function normalizeGuardOptions(
  tree: Tree,
  options: GuardGeneratorOptions
): NormalizedOptions {
  return {
    ...normalizeOptions(tree, options),
    language: options.language,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
