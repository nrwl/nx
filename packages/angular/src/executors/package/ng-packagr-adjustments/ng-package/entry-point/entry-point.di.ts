/**
 * Adapted from the original ng-packagr source.
 *
 * Changes made:
 * - Use NX_COMPILE_NGC_TOKEN instead of COMPILE_NGC_TOKEN.
 * - Use NX_COMPILE_NGC_PROVIDERS instead of COMPILE_NGC_PROVIDERS.
 */

import { InjectionToken, Provider } from 'injection-js';
import { Transform } from 'ng-packagr/lib/graph/transform';
import {
  provideTransform,
  TransformProvider,
} from 'ng-packagr/lib/graph/transform.di';
import { entryPointTransformFactory } from 'ng-packagr/lib/ng-package/entry-point/entry-point.transform';
import {
  WRITE_BUNDLES_TRANSFORM,
  WRITE_BUNDLES_TRANSFORM_TOKEN,
} from 'ng-packagr/lib/ng-package/entry-point/write-bundles.di';
import {
  WRITE_PACKAGE_TRANSFORM,
  WRITE_PACKAGE_TRANSFORM_TOKEN,
} from 'ng-packagr/lib/ng-package/entry-point/write-package.di';
import {
  NX_COMPILE_NGC_PROVIDERS,
  NX_COMPILE_NGC_TOKEN,
} from './compile-ngc.di';

export const NX_ENTRY_POINT_TRANSFORM_TOKEN = new InjectionToken<Transform>(
  `nx.v1.entryPointTransform`
);

export const NX_ENTRY_POINT_TRANSFORM: TransformProvider = provideTransform({
  provide: NX_ENTRY_POINT_TRANSFORM_TOKEN,
  useFactory: entryPointTransformFactory,
  deps: [
    NX_COMPILE_NGC_TOKEN,
    WRITE_BUNDLES_TRANSFORM_TOKEN,
    WRITE_PACKAGE_TRANSFORM_TOKEN,
  ],
});

export const NX_ENTRY_POINT_PROVIDERS: Provider[] = [
  NX_ENTRY_POINT_TRANSFORM,
  ...NX_COMPILE_NGC_PROVIDERS,
  WRITE_BUNDLES_TRANSFORM,
  WRITE_PACKAGE_TRANSFORM,
];
