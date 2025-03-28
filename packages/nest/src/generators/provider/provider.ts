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

export type ProviderGeneratorOptions = NestGeneratorWithLanguageOption &
  NestGeneratorWithTestOption;

export async function providerGenerator(
  tree: Tree,
  rawOptions: ProviderGeneratorOptions
): Promise<any> {
  const options = await normalizeProviderOptions(tree, rawOptions);

  return runNestSchematic(tree, 'provider', options);
}

export default providerGenerator;

async function normalizeProviderOptions(
  tree: Tree,
  options: ProviderGeneratorOptions
): Promise<NormalizedOptions> {
  const normalizedOptions = await normalizeOptions(tree, options);
  return {
    ...normalizedOptions,
    language: options.language,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
