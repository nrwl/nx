import type { Tree } from '@nrwl/devkit';
import { convertNxGenerator } from '@nrwl/devkit';
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

export function controllerGenerator(
  tree: Tree,
  rawOptions: ControllerGeneratorOptions
): Promise<any> {
  const options = normalizeControllerOptions(tree, rawOptions);

  return runNestSchematic(tree, 'controller', options);
}

export default controllerGenerator;

export const controllerSchematic = convertNxGenerator(controllerGenerator);

function normalizeControllerOptions(
  tree: Tree,
  options: ControllerGeneratorOptions
): NormalizedOptions {
  return {
    ...normalizeOptions(tree, options),
    language: options.language,
    module: options.module,
    skipImport: options.skipImport,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
