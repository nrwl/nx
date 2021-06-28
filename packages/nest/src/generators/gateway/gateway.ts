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

export type GatewayGeneratorOptions = NestGeneratorWithLanguageOption &
  NestGeneratorWithTestOption;

export function gatewayGenerator(
  tree: Tree,
  rawOptions: GatewayGeneratorOptions
): Promise<any> {
  const options = normalizeGatewayOptions(tree, rawOptions);

  return runNestSchematic(tree, 'gateway', options);
}

export default gatewayGenerator;

export const gatewaySchematic = convertNxGenerator(gatewayGenerator);

function normalizeGatewayOptions(
  tree: Tree,
  options: GatewayGeneratorOptions
): NormalizedOptions {
  return {
    ...normalizeOptions(tree, options),
    language: options.language,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
