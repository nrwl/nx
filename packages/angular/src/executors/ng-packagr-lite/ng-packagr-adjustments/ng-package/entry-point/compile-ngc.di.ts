import { InjectionToken, Provider } from 'injection-js';
import type { Transform } from 'ng-packagr/lib/graph/transform';
import { provideTransform } from 'ng-packagr/lib/graph/transform.di';
import { OPTIONS_TOKEN } from 'ng-packagr/lib/ng-package/options.di';
import {
  STYLESHEET_PROCESSOR,
  STYLESHEET_PROCESSOR_TOKEN,
} from 'ng-packagr/lib/styles/stylesheet-processor.di';
import { nxCompileNgcTransformFactory } from './compile-ngc.transform';

export const NX_COMPILE_NGC_TOKEN = new InjectionToken<Transform>(
  `nx.v1.compileNgc`
);
export const NX_COMPILE_NGC_TRANSFORM = provideTransform({
  provide: NX_COMPILE_NGC_TOKEN,
  useFactory: nxCompileNgcTransformFactory,
  deps: [STYLESHEET_PROCESSOR_TOKEN, OPTIONS_TOKEN],
});
export const NX_COMPILE_NGC_PROVIDERS: Provider[] = [
  STYLESHEET_PROCESSOR,
  NX_COMPILE_NGC_TRANSFORM,
];
