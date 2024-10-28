import type { Tree } from '@nx/devkit';
import type {
  NestGeneratorWithLanguageOption,
  NormalizedOptions,
} from '../utils';
import { normalizeOptions, runNestSchematic } from '../utils';

export type DecoratorGeneratorOptions = NestGeneratorWithLanguageOption;

export async function decoratorGenerator(
  tree: Tree,
  rawOptions: DecoratorGeneratorOptions
): Promise<any> {
  const options = await normalizeDecoratorOptions(tree, rawOptions);

  return runNestSchematic(tree, 'decorator', options);
}

export default decoratorGenerator;

async function normalizeDecoratorOptions(
  tree: Tree,
  options: DecoratorGeneratorOptions
): Promise<NormalizedOptions> {
  const normalizedOptions = await normalizeOptions(tree, options);
  return {
    ...normalizedOptions,
    language: options.language,
  };
}
