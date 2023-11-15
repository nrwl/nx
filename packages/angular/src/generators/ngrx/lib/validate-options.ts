import type { Tree } from '@nx/devkit';
import type { NgRxGeneratorOptions } from '../schema';

export function validateOptions(
  tree: Tree,
  options: NgRxGeneratorOptions
): void {
  if (!options.module && !options.parent) {
    throw new Error('Please provide a value for "--parent"!');
  }
  if (options.module && !tree.exists(options.module)) {
    throw new Error(`Module does not exist: ${options.module}.`);
  }
  if (options.parent && !tree.exists(options.parent)) {
    throw new Error(`Parent does not exist: ${options.parent}.`);
  }
}
