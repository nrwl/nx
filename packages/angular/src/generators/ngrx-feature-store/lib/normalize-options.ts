import type { Tree } from '@nx/devkit';
import { joinPathFragments, names, readJson } from '@nx/devkit';
import { checkAndCleanWithSemver } from '@nx/devkit/src/utils/semver';
import { dirname } from 'path';
import { rxjsVersion as defaultRxjsVersion } from '../../../utils/versions';
import type { Schema } from '../schema';

export type NormalizedNgRxFeatureStoreGeneratorOptions = Schema & {
  parentDirectory: string;
  subdirectory: string;
  rxjsVersion: string;
};

export function normalizeOptions(
  tree: Tree,
  options: Schema
): NormalizedNgRxFeatureStoreGeneratorOptions {
  let rxjsVersion: string;
  try {
    rxjsVersion = checkAndCleanWithSemver(
      'rxjs',
      readJson(tree, 'package.json').dependencies['rxjs']
    );
  } catch {
    rxjsVersion = checkAndCleanWithSemver('rxjs', defaultRxjsVersion);
  }

  const { subdirectory, name } = determineSubdirectoryAndName(options.name);

  return {
    ...options,
    name,
    subdirectory,
    parentDirectory: options.parent ? dirname(options.parent) : undefined,
    route: options.route === '' ? `''` : options.route ?? `''`,
    directory: names(options.directory).fileName,
    rxjsVersion,
  };
}

function determineSubdirectoryAndName(name: string) {
  if (name.includes('/')) {
    const parts = name.split('/');
    const storeName = parts.pop();
    const subdirectory = joinPathFragments(...parts);
    return { subdirectory, name: storeName };
  } else {
    return { name };
  }
}
