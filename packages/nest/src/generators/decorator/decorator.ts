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
) {
  await decoratorGeneratorInternal(tree, {
    nameAndDirectoryFormat: 'derived',
    ...rawOptions,
  });
}

export async function decoratorGeneratorInternal(
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
  const normalizedOptions = await normalizeOptions(
    tree,
    'decorator',
    '@nx/nest:decorator',
    options
  );
  return {
    ...normalizedOptions,
    language: options.language,
  };
}
