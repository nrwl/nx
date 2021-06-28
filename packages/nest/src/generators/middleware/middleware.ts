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

export type MiddlewareGeneratorOptions = NestGeneratorWithLanguageOption &
  NestGeneratorWithTestOption;

export function middlewareGenerator(
  tree: Tree,
  rawOptions: MiddlewareGeneratorOptions
): Promise<any> {
  const options = normalizeMiddlewareOptions(tree, rawOptions);

  return runNestSchematic(tree, 'middleware', options);
}

export default middlewareGenerator;

export const middlewareSchematic = convertNxGenerator(middlewareGenerator);

function normalizeMiddlewareOptions(
  tree: Tree,
  options: MiddlewareGeneratorOptions
): NormalizedOptions {
  return {
    ...normalizeOptions(tree, options),
    language: options.language,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
