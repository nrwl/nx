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

export type ServiceGeneratorOptions = NestGeneratorWithLanguageOption &
  NestGeneratorWithTestOption;

export async function serviceGenerator(
  tree: Tree,
  rawOptions: ServiceGeneratorOptions
): Promise<any> {
  const options = await normalizeServiceOptions(tree, rawOptions);

  return runNestSchematic(tree, 'service', options);
}

export default serviceGenerator;

async function normalizeServiceOptions(
  tree: Tree,
  options: ServiceGeneratorOptions
): Promise<NormalizedOptions> {
  const normalizedOptions = await normalizeOptions(tree, options);
  return {
    ...normalizedOptions,
    language: options.language,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
