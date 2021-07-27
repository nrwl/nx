/**
 * Wires everything together and provides it to the DI system, taking what
 * we still want from the original ng-packagr library and replacing those
 * where Nx takes over with Nx specific functions
 */

import type { Provider } from 'injection-js';
import { InjectionToken } from 'injection-js';
import type { Transform } from 'ng-packagr/lib/graph/transform';
import { provideTransform } from 'ng-packagr/lib/graph/transform.di';
import { NX_COMPILE_NGC_TOKEN, NX_COMPILE_NGC_TRANSFORM } from './compile-ngc';
import { nxEntryPointTransformFactory } from './entry-point';
import {
  NX_WRITE_PACKAGE_TRANSFORM,
  NX_WRITE_PACKAGE_TRANSFORM_TOKEN,
} from './write-package.di';

export const NX_ENTRY_POINT_TRANSFORM_TOKEN = new InjectionToken<Transform>(
  `nx.v1.entryPointTransform`
);

export const NX_ENTRY_POINT_TRANSFORM = provideTransform({
  provide: NX_ENTRY_POINT_TRANSFORM_TOKEN,
  useFactory: nxEntryPointTransformFactory,
  deps: [NX_COMPILE_NGC_TOKEN, NX_WRITE_PACKAGE_TRANSFORM_TOKEN],
});

export const NX_ENTRY_POINT_PROVIDERS: Provider[] = [
  NX_ENTRY_POINT_TRANSFORM,
  NX_COMPILE_NGC_TRANSFORM,
  NX_WRITE_PACKAGE_TRANSFORM,
];
