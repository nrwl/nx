import type { Tree } from '@nx/devkit';
import { joinPathFragments, names, readJson } from '@nx/devkit';
import { checkAndCleanWithSemver } from '@nx/devkit/internal';
import { dirname } from 'path';
import { major } from 'semver';
import { rxjsVersion as defaultRxjsVersion } from '../../../utils/versions';
import type { Schema } from '../schema';

export type NormalizedNgRxFeatureStoreGeneratorOptions = Schema & {
  parentDirectory: string;
  subdirectory: string | undefined;
  route: string;
  rxjsVersion: string;
  rxjsMajorVersion: number;
};

export function normalizeOptions(
  tree: Tree,
  options: Schema
): NormalizedNgRxFeatureStoreGeneratorOptions {
  let rxjsVersion: string;
  try {
    rxjsVersion = checkAndCleanWithSemver(
      tree,
      'rxjs',
      readJson(tree, 'package.json').dependencies['rxjs']
    );
  } catch {
    rxjsVersion = checkAndCleanWithSemver(tree, 'rxjs', defaultRxjsVersion);
  }
  const rxjsMajorVersion = major(rxjsVersion);

  const { subdirectory, name } = determineSubdirectoryAndName(options.name);

  return {
    ...options,
    name,
    subdirectory,
    parentDirectory: dirname(options.parent),
    route: options.route === '' ? `''` : (options.route ?? `''`),
    directory: names(options.directory).fileName,
    rxjsVersion,
    rxjsMajorVersion,
  };
}

function determineSubdirectoryAndName(name: string) {
  if (name.includes('/')) {
    const parts = name.split('/');
    const storeName = parts[parts.length - 1];
    const subdirectory = joinPathFragments(...parts.slice(0, -1));
    return { subdirectory, name: storeName };
  } else {
    return { subdirectory: undefined, name };
  }
}
