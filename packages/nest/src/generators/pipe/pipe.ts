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

export type PipeGeneratorOptions = NestGeneratorWithLanguageOption &
  NestGeneratorWithTestOption;

export async function pipeGenerator(
  tree: Tree,
  rawOptions: PipeGeneratorOptions
): Promise<any> {
  const options = await normalizePipeOptions(tree, rawOptions);

  return runNestSchematic(tree, 'pipe', options);
}

export default pipeGenerator;

async function normalizePipeOptions(
  tree: Tree,
  options: PipeGeneratorOptions
): Promise<NormalizedOptions> {
  const normalizedOptions = await normalizeOptions(tree, options);
  return {
    ...normalizedOptions,
    language: options.language,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
