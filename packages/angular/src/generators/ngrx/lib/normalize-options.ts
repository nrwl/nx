import { names } from '@nrwl/devkit';
import type { NgRxGeneratorOptions } from '../schema';
import { dirname } from 'path';

export type NormalizedNgRxGeneratorOptions = NgRxGeneratorOptions & {
  parentDirectory: string;
};

export function normalizeOptions(
  options: NgRxGeneratorOptions
): NormalizedNgRxGeneratorOptions {
  return {
    ...options,
    parentDirectory: options.module
      ? dirname(options.module)
      : options.parent
      ? dirname(options.parent)
      : undefined,
    route: options.route ?? '',
    directory: names(options.directory).fileName,
  };
}
