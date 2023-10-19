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

export type ClassGeneratorOptions = NestGeneratorWithLanguageOption &
  NestGeneratorWithTestOption;

export async function classGenerator(
  tree: Tree,
  rawOptions: ClassGeneratorOptions
) {
  await classGeneratorInternal(tree, {
    nameAndDirectoryFormat: 'derived',
    ...rawOptions,
  });
}

export async function classGeneratorInternal(
  tree: Tree,
  rawOptions: ClassGeneratorOptions
): Promise<any> {
  const options = await normalizeClassOptions(tree, rawOptions);

  return runNestSchematic(tree, 'class', options);
}

export default classGenerator;

async function normalizeClassOptions(
  tree: Tree,
  options: ClassGeneratorOptions
): Promise<NormalizedOptions> {
  const normalizedOptions = await normalizeOptions(
    tree,
    'class',
    '@nx/nest:class',
    options
  );
  return {
    ...normalizedOptions,
    language: options.language,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
