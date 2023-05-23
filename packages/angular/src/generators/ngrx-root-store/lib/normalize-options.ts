import type { Tree } from '@nx/devkit';
import {
  joinPathFragments,
  names,
  readJson,
  readProjectConfiguration,
} from '@nx/devkit';
import { checkAndCleanWithSemver } from '@nx/devkit/src/utils/semver';
import { rxjsVersion as defaultRxjsVersion } from '../../../utils/versions';
import type { Schema } from '../schema';
import { isNgStandaloneApp } from '../../../utils/nx-devkit/ast-utils';

export type NormalizedNgRxRootStoreGeneratorOptions = Schema & {
  parent: string;
  rxjsVersion: string;
};

export function normalizeOptions(
  tree: Tree,
  options: Schema
): NormalizedNgRxRootStoreGeneratorOptions {
  let rxjsVersion: string;
  try {
    rxjsVersion = checkAndCleanWithSemver(
      'rxjs',
      readJson(tree, 'package.json').dependencies['rxjs']
    );
  } catch {
    rxjsVersion = checkAndCleanWithSemver('rxjs', defaultRxjsVersion);
  }

  const project = readProjectConfiguration(tree, options.project);
  const isStandalone = isNgStandaloneApp(tree, options.project);
  const appConfigPath = joinPathFragments(
    project.sourceRoot,
    'app/app.config.ts'
  );
  const appMainPath = project.targets.build.options.main;

  /** If NgModule App
   * -> Use App Module
   * If Standalone
   * -> Check Config File exists (v16+)
   * --> If so, use that
   * --> If not, use main.ts
   */
  const parent = !isStandalone
    ? joinPathFragments(project.sourceRoot, 'app/app.module.ts')
    : tree.exists(appConfigPath)
    ? appConfigPath
    : appMainPath;

  options.directory = options.directory ?? '+state';

  return {
    ...options,
    parent,
    directory: names(options.directory).fileName,
    rxjsVersion,
  };
}
