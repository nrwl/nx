import type { Tree } from '@nx/devkit';
import { convertNxGenerator } from '@nx/devkit';
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

export function providerGenerator(
  tree: Tree,
  rawOptions: ProviderGeneratorOptions
): Promise<any> {
  const options = normalizeProviderOptions(tree, rawOptions);

  return runNestSchematic(tree, 'provider', options);
}

export default providerGenerator;

export const providerSchematic = convertNxGenerator(providerGenerator);

function normalizeProviderOptions(
  tree: Tree,
  options: ProviderGeneratorOptions
): NormalizedOptions {
  return {
    ...normalizeOptions(tree, options),
    language: options.language,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
