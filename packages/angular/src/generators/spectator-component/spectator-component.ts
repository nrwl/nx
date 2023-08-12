import type { Tree } from '@nx/devkit';
import { names } from '@nx/devkit';
import { normalizeOptions, validateOptions, createFiles } from './lib';
import type { Schema } from './schema';
import { componentGenerator } from '../component/component';

export async function spectatorComponentGenerator(
  tree: Tree,
  rawOptions: Schema
) {
  validateOptions(rawOptions);
  const options = normalizeOptions(tree, rawOptions);

  const componentNames = names(options.name);
  const typeNames = names(options.type);

  await componentGenerator(tree, rawOptions);

  createFiles(tree, options, componentNames, typeNames);
}

export default spectatorComponentGenerator;
