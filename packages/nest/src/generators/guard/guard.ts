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

export type GuardGeneratorOptions = NestGeneratorWithLanguageOption &
  NestGeneratorWithTestOption;

export async function guardGenerator(
  tree: Tree,
  rawOptions: GuardGeneratorOptions
) {
  await guardGeneratorInternal(tree, {
    nameAndDirectoryFormat: 'derived',
    ...rawOptions,
  });
}

export async function guardGeneratorInternal(
  tree: Tree,
  rawOptions: GuardGeneratorOptions
): Promise<any> {
  const options = await normalizeGuardOptions(tree, rawOptions);

  return runNestSchematic(tree, 'guard', options);
}

export default guardGenerator;

async function normalizeGuardOptions(
  tree: Tree,
  options: GuardGeneratorOptions
): Promise<NormalizedOptions> {
  const normalizedOptions = await normalizeOptions(
    tree,
    'guard',
    '@nx/nest:guard',
    options
  );
  return {
    ...normalizedOptions,
    language: options.language,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
