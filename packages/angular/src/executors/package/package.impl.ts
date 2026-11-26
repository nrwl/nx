import type { ExecutorContext } from '@nx/devkit';
import { eachValueFrom } from '@nx/devkit/internal';
import {
  calculateProjectBuildableDependencies,
  createTmpTsConfig,
  type DependentBuildableProjectNode,
} from '@nx/js/internal';
import type { NgPackagr } from 'ng-packagr';
import { join, resolve } from 'path';
import { from } from 'rxjs';
import { mapTo, switchMap } from 'rxjs/operators';
import { parseRemappedTsConfigAndMergeDefaults } from '../utilities/typescript';
import { getNgPackagrInstance } from './ng-packagr-adjustments/ng-packagr';
import type { BuildAngularLibraryExecutorOptions } from './schema';

export type NormalizedLibraryExecutorOptions =
  BuildAngularLibraryExecutorOptions & { project: string };

async function initializeNgPackagr(
  options: NormalizedLibraryExecutorOptions,
  context: ExecutorContext,
  projectDependencies: DependentBuildableProjectNode[],
  projectRoot: string
): Promise<NgPackagr> {
  const ngPackagr = await getNgPackagrInstance();
  ngPackagr.forProject(resolve(context.root, options.project));

  if (options.tsConfig) {
    const remappedTsConfigFilePath = createTmpTsConfig(
      join(context.root, options.tsConfig),
      context.root,
      projectRoot,
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

/**
 * Creates an executor function that executes the library build of an Angular
 * package using ng-packagr.
 * @param initializeNgPackagr function that returns an ngPackagr instance to use for the build.
 */
export function createLibraryExecutor(
  initializeNgPackagr: (
    options: NormalizedLibraryExecutorOptions,
    context: ExecutorContext,
    projectDependencies: DependentBuildableProjectNode[],
    projectRoot: string
  ) => Promise<NgPackagr>
) {
  return async function* (
    rawOptions: BuildAngularLibraryExecutorOptions,
    context: ExecutorContext
  ) {
    const { projectName, targetName } = context;
    if (!projectName || !targetName) {
      throw new Error('The library executor must be run for a project target.');
    }
    const projectRoot =
      context.projectsConfigurations.projects[projectName].root;
    const options: NormalizedLibraryExecutorOptions = {
      ...rawOptions,
      project: rawOptions.project ?? join(projectRoot, 'ng-package.json'),
    };

    const { dependencies } = calculateProjectBuildableDependencies(
      context.taskGraph,
      context.projectGraph,
      context.root,
      projectName,
      targetName,
      context.configurationName
    );

    if (options.watch) {
      return yield* eachValueFrom(
        from(
          initializeNgPackagr(options, context, dependencies, projectRoot)
        ).pipe(
          switchMap((packagr) => packagr.watch()),
          mapTo({ success: true })
        )
      );
    }

    return from(
      initializeNgPackagr(options, context, dependencies, projectRoot)
    )
      .pipe(
        switchMap((packagr) => packagr.build()),
        mapTo({ success: true })
      )
      .toPromise();
  };
}

export const packageExecutor = createLibraryExecutor(initializeNgPackagr);

export default packageExecutor;
