/**
 * Adapted from the original ng-packagr source.
 *
 * Changes made:
 * - Use our own compileNgcTransformFactory instead of the one provided by ng-packagr.
 * - Use NX_STYLESHEET_PROCESSOR instead of STYLESHEET_PROCESSOR.
 * - Use NX_STYLESHEET_PROCESSOR_TOKEN instead of STYLESHEET_PROCESSOR_TOKEN.
 */

import { InjectionToken, Provider } from 'injection-js';
import { Transform } from 'ng-packagr/lib/graph/transform';
import {
  provideTransform,
  TransformProvider,
} from 'ng-packagr/lib/graph/transform.di';
import { OPTIONS_TOKEN } from 'ng-packagr/lib/ng-package/options.di';
import {
  NX_STYLESHEET_PROCESSOR,
  NX_STYLESHEET_PROCESSOR_TOKEN,
} from '../../styles/stylesheet-processor.di';
import { compileNgcTransformFactory } from './compile-ngc.transform';

export const NX_COMPILE_NGC_TOKEN = new InjectionToken<Transform>(
  `nx.v1.compileNgcTransform`
);

export const NX_COMPILE_NGC_TRANSFORM: TransformProvider = provideTransform({
  provide: NX_COMPILE_NGC_TOKEN,
  useFactory: compileNgcTransformFactory,
  deps: [NX_STYLESHEET_PROCESSOR_TOKEN, OPTIONS_TOKEN],
});

export const NX_COMPILE_NGC_PROVIDERS: Provider[] = [
  NX_STYLESHEET_PROCESSOR,
  NX_COMPILE_NGC_TRANSFORM,
];
