/**
 * Adapted from the original ng-packagr.
 *
 * Changes made:
 * - Removed bundling altogether.
 * - Write the ESM2022 outputs to the file system.
 * - Fake the FESM2022 outputs pointing them to the ESM2022 outputs.
 */

import { BuildGraph } from 'ng-packagr/lib/graph/build-graph';
import { transformFromPromise } from 'ng-packagr/lib/graph/transform';
import type { NgEntryPoint as NgEntryPointBase } from 'ng-packagr/lib/ng-package/entry-point/entry-point';
import { isEntryPoint, isPackage } from 'ng-packagr/lib/ng-package/nodes';
import type { NgPackagrOptions } from 'ng-packagr/lib/ng-package/options.di';
import { NgPackage } from 'ng-packagr/lib/ng-package/package';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { NgEntryPoint } from './entry-point';

export const writeBundlesTransform = (_options: NgPackagrOptions) =>
  transformFromPromise(async (graph) => {
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

function toCustomNgEntryPoint(entryPoint: NgEntryPointBase): NgEntryPoint {
  return new NgEntryPoint(
    entryPoint.packageJson,
    entryPoint.ngPackageJson,
    entryPoint.basePath,
    // @ts-expect-error this is a TS private property, but it can be accessed at runtime
    entryPoint.secondaryData
  );
}
