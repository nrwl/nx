/**
 * Adapted from the original ng-packagr.
 *
 * Changes made:
 * - Removed bundling altogether.
 * - Write the ESM2022 outputs to the file system.
 * - Fake the FESM2022 outputs pointing them to the ESM2022 outputs.
 */

import type { NgEntryPoint } from 'ng-packagr/src/lib/ng-package/entry-point/entry-point';
import type { NgPackagrOptions } from 'ng-packagr/src/lib/ng-package/options.di';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { getNgPackagrVersionInfo } from '../../../../utilities/ng-packagr/ng-packagr-version';
import { importNgPackagrPath } from '../../../../utilities/ng-packagr/package-imports';
import { createNgEntryPoint } from './entry-point';

export const writeBundlesTransform = (_options: NgPackagrOptions) => {
  const { major: ngPackagrMajorVersion } = getNgPackagrVersionInfo();

  const { BuildGraph } = importNgPackagrPath<
    typeof import('ng-packagr/src/lib/graph/build-graph')
  >('ng-packagr/src/lib/graph/build-graph', ngPackagrMajorVersion);
  const { transformFromPromise } = importNgPackagrPath<
    typeof import('ng-packagr/src/lib/graph/transform')
  >('ng-packagr/src/lib/graph/transform', ngPackagrMajorVersion);
  const { isEntryPoint, isPackage } = importNgPackagrPath<
    typeof import('ng-packagr/src/lib/ng-package/nodes')
  >('ng-packagr/src/lib/ng-package/nodes', ngPackagrMajorVersion);
  const { NgPackage } = importNgPackagrPath<
    typeof import('ng-packagr/src/lib/ng-package/package')
  >('ng-packagr/src/lib/ng-package/package', ngPackagrMajorVersion);

  return transformFromPromise(async (graph) => {
    const updatedGraph = new BuildGraph();

    for (const entry of graph.entries()) {
      if (isEntryPoint(entry)) {
        const entryPoint = toCustomNgEntryPoint(entry.data.entryPoint);
        entry.data.entryPoint = entryPoint;
        entry.data.destinationFiles = entryPoint.destinationFiles;

        for (const [path, outputCache] of entry.cache.outputCache.entries()) {
          // write the outputs to the file system
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, outputCache.content);
        }
      } else if (isPackage(entry)) {
        entry.data = new NgPackage(
          entry.data.src,
          toCustomNgEntryPoint(entry.data.primary),
          entry.data.secondaries.map((secondary) =>
            toCustomNgEntryPoint(secondary)
          )
        );
      }
      updatedGraph.put(entry);
    }

    return updatedGraph;
  });
};

function toCustomNgEntryPoint(entryPoint: NgEntryPoint): NgEntryPoint {
  return createNgEntryPoint(
    entryPoint.packageJson,
    entryPoint.ngPackageJson,
    entryPoint.basePath,
    // @ts-expect-error this is a TS private property, but it can be accessed at runtime
    entryPoint.secondaryData
  );
}
