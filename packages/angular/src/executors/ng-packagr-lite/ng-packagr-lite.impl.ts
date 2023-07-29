import type { ExecutorContext } from '@nx/devkit';
import {
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from '@nx/js/src/utils/buildable-libs-utils';
import { NgPackagr } from 'ng-packagr';
import { resolve } from 'path';
import { createLibraryExecutor } from '../package/package.impl';
import type { BuildAngularLibraryExecutorOptions } from '../package/schema';
import { parseRemappedTsConfigAndMergeDefaults } from '../utilities/typescript';
import { NX_ENTRY_POINT_PROVIDERS } from './ng-packagr-adjustments/ng-package/entry-point/entry-point.di';
import { nxProvideOptions } from './ng-packagr-adjustments/ng-package/options.di';
import {
  NX_PACKAGE_PROVIDERS,
  NX_PACKAGE_TRANSFORM,
} from './ng-packagr-adjustments/ng-package/package.di';

async function initializeNgPackgrLite(
  options: BuildAngularLibraryExecutorOptions,
  context: ExecutorContext,
  projectDependencies: DependentBuildableProjectNode[]
): Promise<NgPackagr> {
  const packager = new NgPackagr([
    // Add default providers to this list.
    ...NX_PACKAGE_PROVIDERS,
    ...NX_ENTRY_POINT_PROVIDERS,
    nxProvideOptions({
      tailwindConfig: options.tailwindConfig,
      watch: options.watch,
    }),
  ]);
  packager.forProject(resolve(context.root, options.project));
  packager.withBuildTransform(NX_PACKAGE_TRANSFORM.provide);

  if (options.tsConfig) {
    const remappedTsConfigFilePath = createTmpTsConfig(
      options.tsConfig,
      context.root,
      context.projectsConfigurations.projects[context.projectName].root,
      projectDependencies
    );
    const tsConfig = await parseRemappedTsConfigAndMergeDefaults(
      context.root,
      options.tsConfig,
      remappedTsConfigFilePath
    );
    packager.withTsConfig(tsConfig);
  }

  return packager;
}

export const ngPackagrLiteExecutor = createLibraryExecutor(
  initializeNgPackgrLite
);

export default ngPackagrLiteExecutor;
