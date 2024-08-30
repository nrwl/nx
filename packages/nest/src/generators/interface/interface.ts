import type { Tree } from '@nx/devkit';
import type { NestGeneratorOptions } from '../utils';
import { normalizeOptions, runNestSchematic } from '../utils';

export type InterfaceGeneratorOptions = NestGeneratorOptions;

export async function interfaceGenerator(
  tree: Tree,
  rawOptions: InterfaceGeneratorOptions
): Promise<any> {
  const options = await normalizeOptions(tree, rawOptions);

  return runNestSchematic(tree, 'interface', options);
}

export default interfaceGenerator;
