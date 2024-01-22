import { names, readJson, Tree } from '@nx/devkit';
import { checkAndCleanWithSemver } from '@nx/devkit/src/utils/semver';
import { dirname } from 'path';
import { rxjsVersion as defaultRxjsVersion } from '../../../utils/versions';
import type { NgRxGeneratorOptions } from '../schema';

export type NormalizedNgRxGeneratorOptions = NgRxGeneratorOptions & {
  parentDirectory: string;
  rxjsVersion: string;
};

export function normalizeOptions(
  tree: Tree,
  options: NgRxGeneratorOptions
): NormalizedNgRxGeneratorOptions {
  let rxjsVersion: string;
  try {
    rxjsVersion = checkAndCleanWithSemver(
      'rxjs',
      readJson(tree, 'package.json').dependencies['rxjs']
    );
  } catch {
    rxjsVersion = checkAndCleanWithSemver('rxjs', defaultRxjsVersion);
  }

  return {
    ...options,
    parentDirectory: options.module
      ? dirname(options.module)
      : options.parent
      ? dirname(options.parent)
      : undefined,
    route: options.route === '' ? `''` : options.route ?? `''`,
    directory: names(options.directory).fileName,
    rxjsVersion,
  };
}
