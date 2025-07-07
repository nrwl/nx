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
  let appMainPath =
    project.targets.build.options.main ?? project.targets.build.options.browser;
  if (!appMainPath) {
    const sourceRoot =
      project.sourceRoot ?? joinPathFragments(project.root, 'src');
    appMainPath = joinPathFragments(sourceRoot, 'main.ts');
  }

  /** If NgModule App
   * -> Use App Module
   * If Standalone
   * -> Check Config File exists (v16+)
   * --> If so, use that
   * --> If not, use main.ts
   */
  let ngModulePath = joinPathFragments(project.sourceRoot, 'app/app.module.ts');
  if (!tree.exists(ngModulePath)) {
    ngModulePath = joinPathFragments(project.sourceRoot, 'app/app-module.ts');
  }
  const parent =
    !isStandalone && tree.exists(ngModulePath)
      ? ngModulePath
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
