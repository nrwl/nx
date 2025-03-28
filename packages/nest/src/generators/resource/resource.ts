import type { Tree } from '@nx/devkit';
import type {
  NestGeneratorWithResourceOption,
  NestGeneratorWithTestOption,
  NormalizedOptions,
} from '../utils';
import {
  normalizeOptions,
  runNestSchematic,
  unitTestRunnerToSpec,
} from '../utils';

export type ResourceGeneratorOptions = NestGeneratorWithTestOption &
  NestGeneratorWithResourceOption;

export async function resourceGenerator(
  tree: Tree,
  rawOptions: ResourceGeneratorOptions
): Promise<any> {
  const options = await normalizeResourceOptions(tree, rawOptions);

  return runNestSchematic(tree, 'resource', options);
}

export default resourceGenerator;

async function normalizeResourceOptions(
  tree: Tree,
  options: ResourceGeneratorOptions
): Promise<NormalizedOptions> {
  const normalizedOptions = await normalizeOptions(tree, options, {
    skipLanguageOption: true,
  });
  return {
    ...normalizedOptions,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
