import type { ExecutorContext } from '@nx/devkit';
import { FsTree } from '@nx/devkit/internal';
import {
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from '@nx/js/internal';
import { NgPackagr } from 'ng-packagr';
import { join, resolve } from 'path';
import { createLibraryExecutor } from '../package/package.impl';
import type { BuildAngularLibraryExecutorOptions } from '../package/schema';
import { warnOnDeprecatedNgPackagrExecutor } from '../utilities/ng-packagr/deprecation';
import { parseRemappedTsConfigAndMergeDefaults } from '../utilities/typescript';
import { getNgPackagrInstance } from './ng-packagr-adjustments/ng-packagr';

async function initializeNgPackgrLite(
  options: BuildAngularLibraryExecutorOptions,
  context: ExecutorContext,
  projectDependencies: DependentBuildableProjectNode[]
): Promise<NgPackagr> {
  warnOnDeprecatedNgPackagrExecutor(
    '@nx/angular:ng-packagr-lite',
    context.projectName,
    new FsTree(context.root, false)
  );
  const ngPackagr = await getNgPackagrInstance();
  ngPackagr.forProject(resolve(context.root, options.project));

  if (options.tsConfig) {
    const remappedTsConfigFilePath = createTmpTsConfig(
      join(context.root, options.tsConfig),
      context.root,
      context.projectsConfigurations.projects[context.projectName].root,
      projectDependencies
    );
    const tsConfig = await parseRemappedTsConfigAndMergeDefaults(
      context.root,
      options.tsConfig,
      remappedTsConfigFilePath
    );
    ngPackagr.withTsConfig(tsConfig);
  }

  return ngPackagr;
}

export const ngPackagrLiteExecutor = createLibraryExecutor(
  initializeNgPackgrLite
);

export default ngPackagrLiteExecutor;
