import type { Tree } from '@nrwl/devkit';
import { convertNxGenerator } from '@nrwl/devkit';
import type {
  NestGeneratorWithLanguageOption,
  NormalizedOptions,
} from '../utils';
import { normalizeOptions, runNestSchematic } from '../utils';

export type DecoratorGeneratorOptions = NestGeneratorWithLanguageOption;

export function decoratorGenerator(
  tree: Tree,
  rawOptions: DecoratorGeneratorOptions
): Promise<any> {
  const options = normalizeDecoratorOptions(tree, rawOptions);

  return runNestSchematic(tree, 'decorator', options);
}

export default decoratorGenerator;

export const decoratorSchematic = convertNxGenerator(decoratorGenerator);

function normalizeDecoratorOptions(
  tree: Tree,
  options: DecoratorGeneratorOptions
): NormalizedOptions {
  return {
    ...normalizeOptions(tree, options),
    language: options.language,
  };
}
