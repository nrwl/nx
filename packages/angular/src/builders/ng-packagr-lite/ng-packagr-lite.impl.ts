import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import * as ng from '@angular/compiler-cli';
import { resolve } from 'path';
import {
  DependentBuildableProjectNode,
  updatePaths,
} from '@nrwl/workspace/src/utils/buildable-libs-utils';
import {
  NX_PACKAGE_PROVIDERS,
  NX_PACKAGE_TRANSFORM,
} from './ng-packagr-adjustments/package.di';
import { NgPackagr } from 'ng-packagr';
import { NX_ENTRY_POINT_PROVIDERS } from './ng-packagr-adjustments/entry-point.di';
import {
  BuildAngularLibraryBuilderOptions,
  createLibraryBuilder,
} from '../package/package.impl';

async function initializeNgPackgrLite(
  options: BuildAngularLibraryBuilderOptions & JsonObject,
  context: BuilderContext,
  projectDependencies: DependentBuildableProjectNode[]
): Promise<import('ng-packagr').NgPackagr> {
  // const packager = (await import('ng-packagr')).ngPackagr();
  const packager = new NgPackagr([
    // Add default providers to this list.
    ...NX_PACKAGE_PROVIDERS,
    ...NX_ENTRY_POINT_PROVIDERS,
  ]);
  packager.forProject(resolve(context.workspaceRoot, options.project));
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

export default createBuilder<Record<string, string> & any>(
  createLibraryBuilder(initializeNgPackgrLite)
);
