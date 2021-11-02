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

export type ClassGeneratorOptions = NestGeneratorWithLanguageOption &
  NestGeneratorWithTestOption;

export function classGenerator(
  tree: Tree,
  rawOptions: ClassGeneratorOptions
): Promise<any> {
  const options = normalizeClassOptions(tree, rawOptions);

  return runNestSchematic(tree, 'class', options);
}

export default classGenerator;

export const classSchematic = convertNxGenerator(classGenerator);

function normalizeClassOptions(
  tree: Tree,
  options: ClassGeneratorOptions
): NormalizedOptions {
  return {
    ...normalizeOptions(tree, options),
    language: options.language,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
