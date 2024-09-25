import type { Tree } from '@nx/devkit';
import type {
  NestGeneratorWithLanguageOption,
  NormalizedOptions,
} from '../utils';
import { normalizeOptions, runNestSchematic } from '../utils';

export type ModuleGeneratorOptions = NestGeneratorWithLanguageOption & {
  module?: string;
  skipImport?: boolean;
};

export async function moduleGenerator(
  tree: Tree,
  rawOptions: ModuleGeneratorOptions
): Promise<any> {
  const options = await normalizeModuleOptions(tree, rawOptions);

  return runNestSchematic(tree, 'module', options);
}

export default moduleGenerator;

async function normalizeModuleOptions(
  tree: Tree,
  options: ModuleGeneratorOptions
): Promise<NormalizedOptions> {
  const normalizedOption = await normalizeOptions(tree, options);
  return {
    ...normalizedOption,
    language: options.language,
    module: options.module,
    skipImport: options.skipImport,
  };
}
