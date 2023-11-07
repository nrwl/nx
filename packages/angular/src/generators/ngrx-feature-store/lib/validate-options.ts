import type { Tree } from '@nx/devkit';
import { Schema } from '../schema';

export function validateOptions(tree: Tree, options: Schema): void {
  if (!options.parent) {
    throw new Error('Please provide a value for "--parent"!');
  }

  if (options.parent && !tree.exists(options.parent)) {
    throw new Error(`Parent does not exist: ${options.parent}.`);
  }
}
