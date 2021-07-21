/**
 * Adapted from the original ng-packagr
 *
 * Wires everything together and provides it to the DI, but exchanges the parts
 * we want to implement with Nx specific functions
 */

import type { Provider } from 'injection-js';
import { InjectionToken } from 'injection-js';
import type { Transform } from 'ng-packagr/lib/graph/transform';
import { provideTransform } from 'ng-packagr/lib/graph/transform.di';
import {
  ANALYSE_SOURCES_TOKEN,
  ANALYSE_SOURCES_TRANSFORM,
} from 'ng-packagr/lib/ng-package/entry-point/analyse-sources.di';
import {
  DEFAULT_TS_CONFIG_PROVIDER,
  INIT_TS_CONFIG_TOKEN,
} from 'ng-packagr/lib/ng-package/entry-point/init-tsconfig.di';
import {
  DEFAULT_OPTIONS_PROVIDER,
  OPTIONS_TOKEN,
} from 'ng-packagr/lib/ng-package/options.di';
import { packageTransformFactory } from 'ng-packagr/lib/ng-package/package.transform';
import { PROJECT_TOKEN } from 'ng-packagr/lib/project.di';
import { STYLESHEET_PROCESSOR } from 'ng-packagr/lib/styles/stylesheet-processor.di';
import { NX_ENTRY_POINT_TRANSFORM_TOKEN } from './entry-point.di';
import { NX_INIT_TS_CONFIG_TRANSFORM } from './init-tsconfig';

export const PACKAGE_TRANSFORM_TOKEN = new InjectionToken<Transform>(
  `nx.v1.packageTransform`
);

export const NX_PACKAGE_TRANSFORM = provideTransform({
  provide: PACKAGE_TRANSFORM_TOKEN,
  useFactory: packageTransformFactory,
  deps: [
    PROJECT_TOKEN,
    OPTIONS_TOKEN,
    INIT_TS_CONFIG_TOKEN,
    ANALYSE_SOURCES_TOKEN,
    NX_ENTRY_POINT_TRANSFORM_TOKEN,
  ],
});

export const NX_PACKAGE_PROVIDERS: Provider[] = [
  NX_PACKAGE_TRANSFORM,
  DEFAULT_OPTIONS_PROVIDER,
  DEFAULT_TS_CONFIG_PROVIDER,
  STYLESHEET_PROCESSOR,
  NX_INIT_TS_CONFIG_TRANSFORM,
  ANALYSE_SOURCES_TRANSFORM,
];
