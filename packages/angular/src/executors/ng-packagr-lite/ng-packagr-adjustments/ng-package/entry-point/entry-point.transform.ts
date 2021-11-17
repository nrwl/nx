/**
 * Adapted from the original ng-packagr source.
 *
 * Changes made:
 * - Removed writing bundles as we don't generate them for incremental builds.
 */

import { logger } from '@nrwl/devkit';
import { STATE_DONE } from 'ng-packagr/lib/graph/node';
import { isInProgress } from 'ng-packagr/lib/graph/select';
import type { Transform } from 'ng-packagr/lib/graph/transform';
import { transformFromPromise } from 'ng-packagr/lib/graph/transform';
import { byEntryPoint } from 'ng-packagr/lib/ng-package/nodes';
import { pipe } from 'rxjs';

/**
 * A re-write of the `transformSources()` script that transforms an entry point from sources to distributable format.
 *
 * Sources are TypeScript source files accompanied by HTML templates and xCSS stylesheets.
 * See the Angular Package Format for a detailed description of what the distributables include.
 *
 * The current transformation pipeline can be thought of as:
 *
 *  - clean
 *  - compileTs
 *  - downlevelTs
 *  - relocateSourceMaps
 *  - writePackage
 *    - copyStagedFiles (esm, dts, sourcemaps)
 *    - writePackageJson
 *
 * The transformation pipeline is pluggable through the dependency injection system.
 * Sub-transformations are passed to this factory function as arguments.
 *
 * @param compileTs Transformation compiling typescript sources to ES2020 modules.
 * @param writePackage Transformation writing a distribution-ready `package.json` (for publishing to npm registry).
 */
export const nxEntryPointTransformFactory = (
  compileTs: Transform,
  writePackage: Transform
): Transform =>
  pipe(
    transformFromPromise(async (graph) => {
      // Peek the first entry point from the graph
      const entryPoint = graph.find(byEntryPoint().and(isInProgress));
      logger.info(
        '\n------------------------------------------------------------------------------'
      );
      logger.info(
        `Building entry point '${entryPoint.data.entryPoint.moduleId}'`
      );
      logger.info(
        '------------------------------------------------------------------------------'
      );
    }),
    // TypeScript sources compilation
    compileTs,
    // After TypeScript: write package
    writePackage,
    transformFromPromise(async (graph) => {
      const entryPoint = graph.find(byEntryPoint().and(isInProgress));
      entryPoint.state = STATE_DONE;
    })
  );
