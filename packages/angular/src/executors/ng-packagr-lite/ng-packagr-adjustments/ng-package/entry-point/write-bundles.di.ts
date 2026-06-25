import {
  provideTransform,
  type TransformProvider,
} from 'ng-packagr/src/lib/graph/transform.di';
import { WRITE_BUNDLES_TRANSFORM_TOKEN } from 'ng-packagr/src/lib/ng-package/entry-point/write-bundles.di';
import { OPTIONS_TOKEN } from 'ng-packagr/src/lib/ng-package/options.di';
import { writeBundlesTransform } from './write-bundles.transform';

export function getWriteBundlesTransformProvider(): TransformProvider {
  return provideTransform({
    provide: WRITE_BUNDLES_TRANSFORM_TOKEN,
    useFactory: writeBundlesTransform,
    deps: [OPTIONS_TOKEN],
  });
}
