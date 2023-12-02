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

export type GatewayGeneratorOptions = NestGeneratorWithLanguageOption &
  NestGeneratorWithTestOption;

export async function gatewayGenerator(
  tree: Tree,
  rawOptions: GatewayGeneratorOptions
) {
  await gatewayGeneratorInternal(tree, {
    nameAndDirectoryFormat: 'derived',
    ...rawOptions,
  });
}

export async function gatewayGeneratorInternal(
  tree: Tree,
  rawOptions: GatewayGeneratorOptions
): Promise<any> {
  const options = await normalizeGatewayOptions(tree, rawOptions);

  return runNestSchematic(tree, 'gateway', options);
}

export default gatewayGenerator;

async function normalizeGatewayOptions(
  tree: Tree,
  options: GatewayGeneratorOptions
): Promise<NormalizedOptions> {
  const normalizedOptions = await normalizeOptions(
    tree,
    'gateway',
    '@nx/nest:gateway',
    options
  );
  return {
    ...normalizedOptions,
    language: options.language,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
