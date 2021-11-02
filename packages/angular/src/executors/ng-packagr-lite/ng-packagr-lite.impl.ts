import * as ng from '@angular/compiler-cli';
import type { ExecutorContext } from '@nrwl/devkit';
import type { DependentBuildableProjectNode } from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { updatePaths } from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { NgPackagr } from 'ng-packagr';
import { resolve } from 'path';
import { createLibraryExecutor } from '../package/package.impl';
import type { BuildAngularLibraryExecutorOptions } from '../package/schema';
import { NX_ENTRY_POINT_PROVIDERS } from './ng-packagr-adjustments/entry-point.di';
import {
  NX_PACKAGE_PROVIDERS,
  NX_PACKAGE_TRANSFORM,
} from './ng-packagr-adjustments/package.di';

async function initializeNgPackgrLite(
  options: BuildAngularLibraryExecutorOptions,
  context: ExecutorContext,
  projectDependencies: DependentBuildableProjectNode[]
): Promise<NgPackagr> {
  const packager = new NgPackagr([
    // Add default providers to this list.
    ...NX_PACKAGE_PROVIDERS,
    ...NX_ENTRY_POINT_PROVIDERS,
  ]);
  packager.forProject(resolve(context.root, options.project));
  packager.withBuildTransform(NX_PACKAGE_TRANSFORM.provide);

  if (options.tsConfig) {
    // read the tsconfig and modify its path in memory to
    // pass it on to ngpackagr
    const parsedTSConfig = ng.readConfiguration(options.tsConfig);
    updatePaths(projectDependencies, parsedTSConfig.options.paths);
    packager.withTsConfig(parsedTSConfig);
  }

  return packager;
}

export const ngPackagrLiteExecutor = createLibraryExecutor(
  initializeNgPackgrLite
);

export default ngPackagrLiteExecutor;
