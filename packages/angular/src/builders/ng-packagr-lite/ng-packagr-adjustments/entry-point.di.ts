/**
 * Wires everything together and provides it to the DI system, taking what
 * we still want from the original ng-packagr library and replacing those
 * where Nx takes over with Nx specific functions
 */

import {
  COMPILE_NGC_TOKEN,
  COMPILE_NGC_TRANSFORM,
} from 'ng-packagr/lib/ng-package/entry-point/compile-ngc.di';
import {
  NX_WRITE_BUNDLES_TRANSFORM,
  NX_WRITE_BUNDLES_TRANSFORM_TOKEN,
} from './write-bundles';
import {
  WRITE_PACKAGE_TRANSFORM,
  WRITE_PACKAGE_TRANSFORM_TOKEN,
} from 'ng-packagr/lib/ng-package/entry-point/write-package.di';
import { InjectionToken, Provider } from 'injection-js';
import { Transform } from 'ng-packagr/lib/graph/transform';
import {
  provideTransform,
  TransformProvider,
} from 'ng-packagr/lib/graph/transform.di';
import { entryPointTransformFactory } from 'ng-packagr/lib/ng-package/entry-point/entry-point.transform';

export const NX_ENTRY_POINT_TRANSFORM_TOKEN = new InjectionToken<Transform>(
  `nx.v1.entryPointTransform`
);

export const NX_ENTRY_POINT_TRANSFORM: TransformProvider = provideTransform({
  provide: NX_ENTRY_POINT_TRANSFORM_TOKEN,
  useFactory: entryPointTransformFactory,
  deps: [
    COMPILE_NGC_TOKEN,
    NX_WRITE_BUNDLES_TRANSFORM_TOKEN,
    WRITE_PACKAGE_TRANSFORM_TOKEN,
  ],
});

export const NX_ENTRY_POINT_PROVIDERS: Provider[] = [
  NX_ENTRY_POINT_TRANSFORM,
  COMPILE_NGC_TRANSFORM,
  NX_WRITE_BUNDLES_TRANSFORM,
  WRITE_PACKAGE_TRANSFORM,
];
