/**
 * Adapted from original ng-packagr
 *
 * Exclude the UMD bundling and minification
 * which is not needed for incremental compilation
 */

import { InjectionToken } from 'injection-js';
import {
  Transform,
  transformFromPromise,
} from 'ng-packagr/lib/graph/transform';
import {
  provideTransform,
  TransformProvider,
} from 'ng-packagr/lib/graph/transform.di';
import {
  EntryPointNode,
  isEntryPoint,
  isEntryPointInProgress,
} from 'ng-packagr/lib/ng-package/nodes';
import { NgEntryPoint } from 'ng-packagr/lib/ng-package/entry-point/entry-point';
import { rollupBundleFile } from 'ng-packagr/lib/flatten/rollup';
import * as log from 'ng-packagr/lib/utils/log';
import { DependencyList } from 'ng-packagr/lib/flatten/external-module-id-strategy';
import { BuildGraph } from 'ng-packagr/lib/graph/build-graph';
import { unique } from 'ng-packagr/lib/utils/array';

export const nxWriteBundlesTransform: Transform = transformFromPromise(
  async (graph) => {
    const entryPoint = graph.find(isEntryPointInProgress()) as EntryPointNode;
    const {
      destinationFiles,
      entryPoint: ngEntryPoint,
      tsConfig,
    } = entryPoint.data;
    const cache = entryPoint.cache;

    // Add UMD module IDs for dependencies
    const dependencyUmdIds = entryPoint
      .filter(isEntryPoint)
      .map((ep) => ep.data.entryPoint)
      .reduce((prev, ep: NgEntryPoint) => {
        prev[ep.moduleId] = ep.umdId;

        return prev;
      }, {});

    const { fesm2015, esm2015 } = destinationFiles;

    const opts = {
      sourceRoot: tsConfig.options.sourceRoot,
      amd: { id: ngEntryPoint.amdId },
      umdModuleIds: {
        ...ngEntryPoint.umdModuleIds,
        ...dependencyUmdIds,
      },
      entry: esm2015,
      dependencyList: getDependencyListForGraph(graph),
    };

    log.info('Bundling to FESM2015');
    // @ts-ignore
    cache.rollupFESMCache = await rollupBundleFile({
      ...opts,
      moduleName: ngEntryPoint.moduleId,
      format: 'es',
      dest: fesm2015,
      // @ts-ignore
      cache: cache.rollupFESMCache,
    });
  }
);

/** Get all list of dependencies for the entire 'BuildGraph' */
function getDependencyListForGraph(graph: BuildGraph): DependencyList {
  // We need to do this because if A dependency on bundled B
  // And A has a secondary entry point A/1 we want only to bundle B if it's used.
  // Also if A/1 depends on A we don't want to bundle A thus we mark this a dependency.

  const dependencyList: DependencyList = {
    dependencies: [],
    bundledDependencies: [],
  };

  for (const entry of graph.filter(isEntryPoint)) {
    const {
      bundledDependencies = [],
      dependencies = {},
      peerDependencies = {},
    } = entry.data.entryPoint.packageJson;
    dependencyList.bundledDependencies = unique(
      dependencyList.bundledDependencies.concat(bundledDependencies)
    );
    dependencyList.dependencies = unique(
      dependencyList.dependencies.concat(
        Object.keys(dependencies),
        Object.keys(peerDependencies),
        entry.data.entryPoint.moduleId
      )
    );
  }

  if (dependencyList.bundledDependencies.length) {
    log.warn(
      `Inlining of 'bundledDependencies' has been deprecated in version 5 and will be removed in future versions.` +
        '\n' +
        `List the dependency in the 'peerDependencies' section instead.`
    );
  }

  return dependencyList;
}

export const NX_WRITE_BUNDLES_TRANSFORM_TOKEN = new InjectionToken<Transform>(
  `nx.v1.writeBundlesTransform`
);
export const NX_WRITE_BUNDLES_TRANSFORM: TransformProvider = provideTransform({
  provide: NX_WRITE_BUNDLES_TRANSFORM_TOKEN,
  useFactory: () => nxWriteBundlesTransform,
});
