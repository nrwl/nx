/**
 * Adapted from the original ng-packagr source.
 *
 * Changes made:
 * - Provide our own writePackageTransform function.
 * - USE NX_OPTIONS_TOKEN instead of OPTIONS_TOKEN.
 */

import { InjectionToken } from 'injection-js';
import type { Transform } from 'ng-packagr/lib/graph/transform';
import {
  provideTransform,
  TransformProvider,
} from 'ng-packagr/lib/graph/transform.di';
import { NX_OPTIONS_TOKEN } from '../options.di';
import { nxWritePackageTransform } from './write-package.transform';

export const NX_WRITE_PACKAGE_TRANSFORM_TOKEN = new InjectionToken<Transform>(
  `nx.v1.writePackageTransform`
);
export const NX_WRITE_PACKAGE_TRANSFORM: TransformProvider = provideTransform({
  provide: NX_WRITE_PACKAGE_TRANSFORM_TOKEN,
  useFactory: nxWritePackageTransform,
  deps: [NX_OPTIONS_TOKEN],
});
