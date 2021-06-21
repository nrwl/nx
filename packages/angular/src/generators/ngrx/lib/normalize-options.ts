import { names } from '@nrwl/devkit';
import type { NgRxGeneratorOptions } from '../schema';

export function normalizeOptions(
  options: NgRxGeneratorOptions
): NgRxGeneratorOptions {
  const normalizedOptions = {
    ...options,
    directory: names(options.directory).fileName,
  };

  if (options.minimal) {
    normalizedOptions.onlyEmptyRoot = true;
  }
  if (options.skipImport) {
    normalizedOptions.onlyAddFiles = true;
  }

  return normalizedOptions;
}
