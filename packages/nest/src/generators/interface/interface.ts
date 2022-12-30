import type { Tree } from '@nrwl/devkit';
import { convertNxGenerator } from '@nrwl/devkit';
import type { NestGeneratorOptions } from '../utils';
import { normalizeOptions, runNestSchematic } from '../utils';

export type InterfaceGeneratorOptions = NestGeneratorOptions;

export function interfaceGenerator(
  tree: Tree,
  rawOptions: InterfaceGeneratorOptions
): Promise<any> {
  const options = normalizeOptions(tree, rawOptions);

  return runNestSchematic(tree, 'interface', options);
}

export default interfaceGenerator;

export const interfaceSchematic = convertNxGenerator(interfaceGenerator);
