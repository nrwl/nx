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

export type ResourceGeneratorOptions = NestGeneratorWithLanguageOption &
  NestGeneratorWithTestOption;

export function resourceGenerator(
  tree: Tree,
  rawOptions: ResourceGeneratorOptions
): Promise<any> {
  const options = normalizeResourceOptions(tree, rawOptions);

  return runNestSchematic(tree, 'resource', options);
}

export default resourceGenerator;

export const resourceSchematic = convertNxGenerator(resourceGenerator);

function normalizeResourceOptions(
  tree: Tree,
  options: ResourceGeneratorOptions
): NormalizedOptions {
  return {
    ...normalizeOptions(tree, options),
    language: options.language,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
