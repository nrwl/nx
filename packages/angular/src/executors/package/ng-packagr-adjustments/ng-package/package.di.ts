/**
 * Adapted from the original ng-packagr source.
 *
 * Changes made:
 * - Use NX_ENTRY_POINT_TRANSFORM_TOKEN instead of ENTRY_POINT_TRANSFORM_TOKEN.
 * - USE NX_OPTIONS_TOKEN instead of OPTIONS_TOKEN.
 * - USE NX_DEFAULT_OPTIONS_PROVIDER instead of DEFAULT_OPTIONS_PROVIDER.
 */

import { InjectionToken, Provider } from 'injection-js';
import { Transform } from 'ng-packagr/lib/graph/transform';
import {
  provideTransform,
  TransformProvider,
} from 'ng-packagr/lib/graph/transform.di';
import {
  ANALYSE_SOURCES_TOKEN,
  ANALYSE_SOURCES_TRANSFORM,
} from 'ng-packagr/lib/ng-package/entry-point/analyse-sources.di';
import {
  INIT_TS_CONFIG_TOKEN,
  INIT_TS_CONFIG_TRANSFORM,
} from 'ng-packagr/lib/ng-package/entry-point/init-tsconfig.di';
import { packageTransformFactory } from 'ng-packagr/lib/ng-package/package.transform';
import { PROJECT_TOKEN } from 'ng-packagr/lib/project.di';
import { NX_ENTRY_POINT_TRANSFORM_TOKEN } from './entry-point/entry-point.di';
import { NX_DEFAULT_OPTIONS_PROVIDER, NX_OPTIONS_TOKEN } from './options.di';

export const NX_PACKAGE_TRANSFORM_TOKEN = new InjectionToken<Transform>(
  `nx.v1.packageTransform`
);

export const NX_PACKAGE_TRANSFORM: TransformProvider = provideTransform({
  provide: NX_PACKAGE_TRANSFORM_TOKEN,
  useFactory: packageTransformFactory,
  deps: [
    PROJECT_TOKEN,
    NX_OPTIONS_TOKEN,
    INIT_TS_CONFIG_TOKEN,
    ANALYSE_SOURCES_TOKEN,
    NX_ENTRY_POINT_TRANSFORM_TOKEN,
  ],
});

export const NX_PACKAGE_PROVIDERS: Provider[] = [
  NX_PACKAGE_TRANSFORM,
  NX_DEFAULT_OPTIONS_PROVIDER,
  INIT_TS_CONFIG_TRANSFORM,
  ANALYSE_SOURCES_TRANSFORM,
];
