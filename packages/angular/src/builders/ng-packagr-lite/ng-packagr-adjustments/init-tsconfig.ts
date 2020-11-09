/**
 * Adapted from the original ngPackagr source.
 *
 * This initialization however does not print a warning when Ivy is disabled,
 * since the incremental build packages are not intended for distribution
 */

import { msg } from 'ng-packagr/lib/utils/log';
import {
  Transform,
  transformFromPromise,
} from 'ng-packagr/lib/graph/transform';
import { EntryPointNode, isEntryPoint } from 'ng-packagr/lib/ng-package/nodes';
import { initializeTsConfig } from 'ng-packagr/lib/ts/tsconfig';
import {
  provideTransform,
  TransformProvider,
} from 'ng-packagr/lib/graph/transform.di';
import {
  DEFAULT_TS_CONFIG_TOKEN,
  INIT_TS_CONFIG_TOKEN,
} from 'ng-packagr/lib/ng-package/entry-point/init-tsconfig.di';
import { ParsedConfiguration } from '@angular/compiler-cli';

export const initTsConfigTransformFactory = (
  defaultTsConfig: ParsedConfiguration
): Transform =>
  transformFromPromise(async (graph) => {
    // Initialize tsconfig for each entry point
    const entryPoints = graph.filter(isEntryPoint) as EntryPointNode[];
    initializeTsConfig(defaultTsConfig, entryPoints);

    return graph;
  });

export const NX_INIT_TS_CONFIG_TRANSFORM: TransformProvider = provideTransform({
  provide: INIT_TS_CONFIG_TOKEN,
  useFactory: initTsConfigTransformFactory,
  deps: [DEFAULT_TS_CONFIG_TOKEN],
});
