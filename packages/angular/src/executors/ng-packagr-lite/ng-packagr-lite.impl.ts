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
import { getNgPackagrInstance } from './ng-packagr-adjustments/ng-packagr';

async function initializeNgPackgrLite(
  options: BuildAngularLibraryExecutorOptions,
  context: ExecutorContext,
  projectDependencies: DependentBuildableProjectNode[]
): Promise<NgPackagr> {
  const ngPackagr = await getNgPackagrInstance(options);
  ngPackagr.forProject(resolve(context.root, options.project));

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
    ngPackagr.withTsConfig(tsConfig);
  }

  return ngPackagr;
}

export const ngPackagrLiteExecutor = createLibraryExecutor(
  initializeNgPackgrLite
);

export default ngPackagrLiteExecutor;
