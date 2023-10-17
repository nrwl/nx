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

export type FilterGeneratorOptions = NestGeneratorWithLanguageOption &
  NestGeneratorWithTestOption;

export async function filterGenerator(
  tree: Tree,
  rawOptions: FilterGeneratorOptions
) {
  await filterGeneratorInternal(tree, {
    nameAndDirectoryFormat: 'derived',
    ...rawOptions,
  });
}

export async function filterGeneratorInternal(
  tree: Tree,
  rawOptions: FilterGeneratorOptions
): Promise<any> {
  const options = await normalizeFilterOptions(tree, rawOptions);

  return runNestSchematic(tree, 'filter', options);
}

export default filterGenerator;

async function normalizeFilterOptions(
  tree: Tree,
  options: FilterGeneratorOptions
): Promise<NormalizedOptions> {
  const normalizedOptions = await normalizeOptions(
    tree,
    'filter',
    '@nx/nest:filter',
    options
  );
  return {
    ...normalizedOptions,
    language: options.language,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
