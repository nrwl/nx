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

export type ControllerGeneratorOptions = NestGeneratorWithLanguageOption &
  NestGeneratorWithTestOption & {
    module?: string;
    skipImport?: boolean;
  };

export async function controllerGenerator(
  tree: Tree,
  rawOptions: ControllerGeneratorOptions
): Promise<any> {
  const options = await normalizeControllerOptions(tree, rawOptions);

  return runNestSchematic(tree, 'controller', options);
}

export default controllerGenerator;

async function normalizeControllerOptions(
  tree: Tree,
  options: ControllerGeneratorOptions
): Promise<NormalizedOptions> {
  const normalizedOptions = await normalizeOptions(tree, options);
  return {
    ...normalizedOptions,
    language: options.language,
    module: options.module,
    skipImport: options.skipImport,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
