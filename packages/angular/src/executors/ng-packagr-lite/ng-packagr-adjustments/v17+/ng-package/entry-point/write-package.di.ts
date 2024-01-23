/**
 * Adapted from the original ng-packagr source.
 *
 * Changes made:
 * - Provide our own writePackageTransform function.
 */

import {
  provideTransform,
  TransformProvider,
} from 'ng-packagr/lib/graph/transform.di';
import { WRITE_PACKAGE_TRANSFORM_TOKEN } from 'ng-packagr/lib/ng-package/entry-point/write-package.di';
import { OPTIONS_TOKEN } from 'ng-packagr/lib/ng-package/options.di';
import { nxWritePackageTransform } from './write-package.transform';

export const WRITE_PACKAGE_TRANSFORM: TransformProvider = provideTransform({
  provide: WRITE_PACKAGE_TRANSFORM_TOKEN,
  useFactory: nxWritePackageTransform,
  deps: [OPTIONS_TOKEN],
});
